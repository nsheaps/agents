import type { Exec } from "./supervisor-types";

export interface Notice {
  title: string;
  body: string;
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

export async function createNotifier(platform: NodeJS.Platform, exec: Exec): Promise<Notifier> {
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
  if (platform === "linux" && (await exec(["which", "notify-send"])).code === 0) {
    return {
      kind: "notify-send",
      async notify({ title, body }) {
        await exec(["notify-send", "-a", "claude-rc", "--", title, body]).catch(() => {});
      },
    };
  }
  return { kind: "none", async notify() {} };
}
