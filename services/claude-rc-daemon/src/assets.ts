// xterm.js, embedded as text so the compiled single-file binary serves it without touching disk.
// @ts-ignore -- text import (bun); no type declarations for the .js file's raw text
import xtermJs from "@xterm/xterm/lib/xterm.js" with { type: "text" };
// @ts-ignore
import xtermCss from "@xterm/xterm/css/xterm.css" with { type: "text" };
// @ts-ignore
import fitJs from "@xterm/addon-fit/lib/addon-fit.js" with { type: "text" };

export const ASSETS: Record<string, { type: string; body: string }> = {
  "/assets/xterm.js": { type: "text/javascript; charset=utf-8", body: xtermJs as string },
  "/assets/xterm.css": { type: "text/css; charset=utf-8", body: xtermCss as string },
  "/assets/addon-fit.js": { type: "text/javascript; charset=utf-8", body: fitJs as string },
};
