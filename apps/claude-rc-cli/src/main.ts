#!/usr/bin/env bun
import { parseArgs } from "./args";
import { makeCtx, run } from "./commands";

const ctx = makeCtx(
  process.env,
  (s) => console.log(s),
  (s) => console.error(s),
  !!process.stdout.isTTY && !process.env.NO_COLOR,
);

run(parseArgs(process.argv.slice(2)), ctx)
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`claude-rc: ${(e as Error).message}`);
    process.exit(1);
  });
