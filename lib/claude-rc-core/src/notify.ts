import type { Exec } from "./supervisor-types";

export interface Notice {
  title: string;
  body: string;
  /** Also tell every other active desktop user (Linux, only when this process is root). */
  broadcast?: boolean;
}

export interface NotifierOptions {
  /** Effective uid of this process; defaults to process.getuid(). */
  uid?: number;
}

export interface Notifier {
  readonly kind: "osascript" | "notify-send" | "none";
  /** Best effort: never throws. */
  notify(n: Notice): Promise<void>;
}

/** Make text safe inside an AppleScript double-quoted string. */
export function escapeAppleScript(s: string): string {
  return s.replace(/\r?\n/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * `which` is looked up in-process: minimal containers (e.g. Fedora) ship no `which` binary.
 */
export async function createNotifier(
  platform: NodeJS.Platform,
  exec: Exec,
  which: (name: string) => string | null = (n) => Bun.which(n),
  opts: NotifierOptions = {},
): Promise<Notifier> {
  if (platform === "darwin") {
    return {
      kind: "osascript",
      async notify({ title, body }) {
        await exec([
          "osascript",
          "-e",
          `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}"`,
        ]).catch(() => {});
      },
    };
  }
  if (platform === "linux" && which("notify-send") !== null) {
    const uid = opts.uid ?? (typeof process.getuid === "function" ? process.getuid() : undefined);
    const send = (title: string, body: string) =>
      exec(["notify-send", "-a", "claude-rc", "--", title, body]).catch(() => {});
    return {
      kind: "notify-send",
      async notify({ title, body, broadcast }) {
        await send(title, body);
        if (!broadcast || uid !== 0 || !which("loginctl") || !which("runuser")) return;
        for (const u of await activeDesktopUsers(exec)) {
          await exec([
            "runuser",
            "-u",
            u.name,
            "--",
            "env",
            `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${u.uid}/bus`,
            "notify-send",
            "-a",
            "claude-rc",
            "--",
            title,
            body,
          ]).catch(() => {});
        }
      },
    };
  }
  return { kind: "none", async notify() {} };
}

const USER_RE = /^[a-z_][a-z0-9_.-]*\$?$/i; // argv element for runuser: never an option, never shell syntax

/** Non-root users with an active graphical login session (via logind). Best effort. */
async function activeDesktopUsers(exec: Exec): Promise<Array<{ name: string; uid: number }>> {
  const list = await exec(["loginctl", "list-sessions", "--no-legend"]).catch(() => null);
  if (!list || list.code !== 0) return [];
  const users = new Map<number, string>();
  for (const line of list.stdout.split("\n")) {
    const [id, uidStr, name] = line.trim().split(/\s+/);
    if (!id || !name || !/^\d+$/.test(id) || !/^\d+$/.test(uidStr ?? "")) continue;
    const uid = Number(uidStr);
    if (uid === 0 || users.has(uid) || !USER_RE.test(name)) continue;
    const info = await exec(["loginctl", "show-session", id, "-p", "Active", "-p", "Type"]).catch(
      () => null,
    );
    const kv = Object.fromEntries(
      (info?.stdout ?? "").split("\n").map((l) => l.split("=") as [string, string]),
    );
    if (kv.Active === "yes" && ["x11", "wayland", "mir"].includes(kv.Type ?? ""))
      users.set(uid, name);
  }
  return [...users].map(([uid, name]) => ({ uid, name }));
}
