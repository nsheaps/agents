declare const __CLAUDE_RC_VERSION__: string | undefined;
/** Injected at compile time via `bun build --define __CLAUDE_RC_VERSION__='"x.y.z"'`. */
export const VERSION: string =
  typeof __CLAUDE_RC_VERSION__ !== "undefined"
    ? __CLAUDE_RC_VERSION__
    : (process.env.CLAUDE_RC_VERSION ?? "0.0.0-dev");
