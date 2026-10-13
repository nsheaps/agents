import { describe, expect, test } from "bun:test";
import { createNotifier, escapeAppleScript, type NotifierOptions } from "./notify";
import type { Exec } from "./supervisor-types";

const rec = (have: string[] = []) => {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    return { code: 0, stdout: "", stderr: "" };
  };
  return { exec, calls, which: (n: string) => (have.includes(n) ? `/usr/bin/${n}` : null) };
};

describe("escapeAppleScript", () => {
  test("escapes quotes and backslashes so text cannot break out of the string", () => {
    expect(escapeAppleScript('a"b\\c')).toBe('a\\"b\\\\c');
    expect(escapeAppleScript('x" & (do shell script "id") & "')).toBe(
      'x\\" & (do shell script \\"id\\") & \\"',
    );
  });
  test("newlines become spaces", () => {
    expect(escapeAppleScript("a\nb")).toBe("a b");
  });
});

describe("createNotifier", () => {
  test("macOS: osascript display notification, text passed as one argv element", async () => {
    const r = rec();
    const n = await createNotifier("darwin", r.exec, r.which);
    await n.notify({ title: 'T"', body: "B" });
    expect(r.calls).toEqual([["osascript", "-e", 'display notification "B" with title "T\\""']]);
    expect(n.kind).toBe("osascript");
  });
  test("linux: notify-send with -- guard when present", async () => {
    const r = rec(["notify-send"]);
    const n = await createNotifier("linux", r.exec, r.which);
    await n.notify({ title: "-T", body: "B" });
    expect(r.calls.at(-1)).toEqual(["notify-send", "-a", "claude-rc", "--", "-T", "B"]);
    expect(n.kind).toBe("notify-send");
  });
  test("linux without notify-send: kind none, notify is a no-op and never throws", async () => {
    const r = rec([]);
    const n = await createNotifier("linux", r.exec, r.which);
    expect(n.kind).toBe("none");
    await n.notify({ title: "t", body: "b" });
    expect(r.calls.filter((c) => c[0] === "notify-send")).toEqual([]);
  });
  test("a failing notifier does not throw", async () => {
    const exec: Exec = async () => ({ code: 1, stdout: "", stderr: "boom" });
    const n = await createNotifier("darwin", exec);
    await n.notify({ title: "t", body: "b" });
  });
});

describe("broadcast to every active user", () => {
  const SESSIONS =
    "1 1000 alice seat0 tty1\n2 1001 bob seat0 tty2\n3 0 root - -\n4 1002 carol seat0 tty3\n5 1000 alice seat0 -\n";
  const show: Record<string, string> = {
    "1": "Active=yes\nType=wayland",
    "2": "Active=no\nType=x11",
    "3": "Active=yes\nType=tty",
    "4": "Active=yes\nType=x11",
    "5": "Active=yes\nType=x11",
  };
  function box(have = ["notify-send", "runuser", "loginctl"]) {
    const calls: string[][] = [];
    const exec: Exec = async (argv) => {
      calls.push(argv);
      if (argv[0] === "loginctl" && argv[1] === "list-sessions")
        return { code: 0, stdout: SESSIONS, stderr: "" };
      if (argv[0] === "loginctl" && argv[1] === "show-session")
        return { code: 0, stdout: show[argv[2]!] ?? "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    };
    const which = (n: string) => (have.includes(n) ? `/usr/bin/${n}` : null);
    return { exec, calls, which };
  }
  const asRoot: NotifierOptions = { uid: 0 };
  const sends = (calls: string[][]) => calls.filter((c) => c.includes("notify-send"));

  test("as root: self plus each active graphical session, deduped by user", async () => {
    const b = box();
    const n = await createNotifier("linux", b.exec, b.which, asRoot);
    await n.notify({ title: "T", body: "B", broadcast: true });
    const s = sends(b.calls);
    expect(s).toContainEqual(["notify-send", "-a", "claude-rc", "--", "T", "B"]);
    expect(s).toContainEqual([
      "runuser",
      "-u",
      "alice",
      "--",
      "env",
      "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus",
      "notify-send",
      "-a",
      "claude-rc",
      "--",
      "T",
      "B",
    ]);
    expect(s.filter((c) => c.includes("alice")).length).toBe(1); // sessions 1 and 5
    expect(s.filter((c) => c.includes("carol")).length).toBe(1);
    expect(s.some((c) => c.includes("bob"))).toBe(false); // inactive
    expect(s.filter((c) => c[0] === "runuser").length).toBe(2); // tty-only root skipped
  });

  test("not root: only the daemon's own user, loginctl never consulted", async () => {
    const b = box();
    const n = await createNotifier("linux", b.exec, b.which, { uid: 1000 });
    await n.notify({ title: "T", body: "B", broadcast: true });
    expect(b.calls.some((c) => c[0] === "loginctl")).toBe(false);
    expect(sends(b.calls)).toEqual([["notify-send", "-a", "claude-rc", "--", "T", "B"]]);
  });

  test("without the broadcast flag nobody else is notified", async () => {
    const b = box();
    const n = await createNotifier("linux", b.exec, b.which, asRoot);
    await n.notify({ title: "T", body: "B" });
    expect(b.calls.some((c) => c[0] === "loginctl")).toBe(false);
  });

  test("missing runuser or loginctl degrades to the own user, no throw", async () => {
    for (const have of [
      ["notify-send", "loginctl"],
      ["notify-send", "runuser"],
    ]) {
      const b = box(have);
      const n = await createNotifier("linux", b.exec, b.which, asRoot);
      await n.notify({ title: "T", body: "B", broadcast: true });
      expect(sends(b.calls).length).toBe(1);
    }
  });

  test("user names that could be mistaken for options or shell syntax are skipped", async () => {
    const calls: string[][] = [];
    const exec: Exec = async (argv) => {
      calls.push(argv);
      if (argv[1] === "list-sessions")
        return {
          code: 0,
          stdout:
            "1 1000 -evil seat0 -\n2 1001 a;b seat0 -\n3 abc ok seat0 -\n4 1003 fine seat0 -\n",
          stderr: "",
        };
      if (argv[1] === "show-session")
        return { code: 0, stdout: "Active=yes\nType=x11", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    };
    const which = (n: string) => `/usr/bin/${n}`;
    const n = await createNotifier("linux", exec, which, asRoot);
    await n.notify({ title: "T", body: "B", broadcast: true });
    const ru = calls.filter((c) => c[0] === "runuser");
    expect(ru.map((c) => c[2])).toEqual(["fine"]);
  });

  test("macOS ignores the flag: osascript reaches the logged-in user", async () => {
    const r = rec();
    const n = await createNotifier("darwin", r.exec, r.which, asRoot);
    await n.notify({ title: "T", body: "B", broadcast: true });
    expect(r.calls.length).toBe(1);
  });
});
