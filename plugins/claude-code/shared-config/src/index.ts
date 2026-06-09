#!/usr/bin/env bun
/**
 * shared-config — Setup/SessionStart hook (Bun/TypeScript).
 *
 * Clones shared-config source repos and symlinks their rules/skills/commands/
 * agents into the project through a deduped shared cache, bootstraps from an
 * org-level upstream config ($AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM), and
 * optionally merges settings.json fragments. Prefers the github-app token,
 * waiting briefly for it to appear in CLAUDE_ENV_FILE.
 *
 * Run directly with bun (no build step, zero deps — uses Bun.YAML, node:fs,
 * node:crypto, and the git binary). See README.md / docs/design.md.
 *
 * Setup/SessionStart hooks must never break the session: main() always emits
 * SessionStart JSON to stdout and exits 0, even on error.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, relative, resolve as resolvePath } from "node:path";
import { createHash } from "node:crypto";

const PLUGIN_NAME = "shared-config";
const GITHUB_HOST = "github.com";
const RESOURCE_TYPES_DEFAULT = ["rules", "skills", "commands", "agents"] as const;

export interface Settings {
  enabled: boolean;
  resourceTypes: string[];
  defaultSourceDir: string;
  targetBaseDir: string;
  waitForTokenTimeoutSeconds: number;
  mergeSettings: boolean;
  sources: SourceEntry[];
}

export type SourceEntry =
  | string
  | { repo?: string; source?: string; sourceDir?: string; targetDir?: string };

export interface NormalizedSource {
  org: string;
  repo: string;
  sourceDir: string | null;
  targetDir: string | null;
}

const DEFAULTS: Settings = {
  enabled: true,
  resourceTypes: [...RESOURCE_TYPES_DEFAULT],
  defaultSourceDir: ".",
  targetBaseDir: ".claude",
  waitForTokenTimeoutSeconds: 15,
  mergeSettings: false,
  sources: [],
};

const log = (msg: string): void => console.error(`${PLUGIN_NAME}: ${msg}`);

// --------------------------------------------------------------------------- //
// small helpers
// --------------------------------------------------------------------------- //
export function sanitize(part: string): string {
  const trimmed = (part ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed.replace(/[^A-Za-z0-9._-]+/g, "_") || "_";
}

function readYaml(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return Bun.YAML.parse(readFileSync(path, "utf8"));
  } catch (err) {
    log(`failed to parse ${path}: ${(err as Error).message}`);
    return undefined;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Accept a top-level mapping or one nested under `shared-config`. */
function unwrapSettings(data: unknown): Record<string, unknown> {
  if (!isObject(data)) return {};
  if (isObject(data["shared-config"])) return data["shared-config"] as Record<string, unknown>;
  return data;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, val] of Object.entries(source)) {
    if (isObject(val) && isObject(target[key])) {
      deepMerge(target[key] as Record<string, unknown>, val);
    } else {
      target[key] = val;
    }
  }
  return target;
}

// --------------------------------------------------------------------------- //
// repo references + git
// --------------------------------------------------------------------------- //
/** Parse a GitHub uses:-style ref (no @ref) into {org, repo, subpath}. */
export function parseRepoRef(ref: string): { org: string; repo: string; subpath: string } {
  let cleaned = (ref ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (cleaned.includes("@")) cleaned = cleaned.split("@", 1)[0]!.replace(/\/+$/g, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2)
    throw new Error(`invalid repo reference (need org/repo): ${JSON.stringify(ref)}`);
  return { org: parts[0]!, repo: parts[1]!, subpath: parts.slice(2).join("/") };
}

function repoUrl(org: string, repo: string): string {
  const base = (process.env.SHARED_CONFIG_TEST_GIT_BASE ?? "").trim();
  if (base) return join(base, org, repo);
  return `https://${GITHUB_HOST}/${org}/${repo}.git`;
}

function authGitArgs(token: string | undefined): string[] {
  if (!token) return [];
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return ["-c", `http.https://${GITHUB_HOST}/.extraheader=AUTHORIZATION: basic ${basic}`];
}

/**
 * Resolve a runnable command for an external tool. Prefers the binary on PATH;
 * if it's missing but `mise` is available, delegates to `mise exec <tool>@latest`
 * so the tool is auto-installed/run via mise (matching the ai-mktpl plugins).
 * Falls back to the bare name (which then fails loudly) if neither is present.
 */
function onPath(name: string): boolean {
  // Pass PATH explicitly: Bun.which() otherwise uses a startup snapshot and
  // ignores live process.env.PATH (e.g. updates from CLAUDE_ENV_FILE).
  return Boolean(Bun.which(name, { PATH: process.env.PATH ?? "" }));
}

export function toolArgv(name: string, args: string[]): [string, string[]] {
  if (onPath(name)) return [name, args];
  if (onPath("mise")) return ["mise", ["exec", `${name}@latest`, "--", name, ...args]];
  return [name, args];
}

function toolAvailable(name: string): boolean {
  return onPath(name) || onPath("mise");
}

function git(args: string[], token?: string): { ok: boolean; stdout: string; stderr: string } {
  const [cmd, argv] = toolArgv("git", [...authGitArgs(token), ...args]);
  const res = spawnSync(cmd, argv, { encoding: "utf8" });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? "").toString(),
    stderr: (res.stderr ?? "").toString(),
  };
}

export function cloneOrUpdate(
  org: string,
  repo: string,
  sourcesDir: string,
  token?: string,
): string | null {
  const dest = join(sourcesDir, sanitize(org), sanitize(repo));
  const url = repoUrl(org, repo);
  try {
    if (existsSync(join(dest, ".git"))) {
      git(["-C", dest, "remote", "set-url", "origin", url], token);
      const fetch = git(["-C", dest, "fetch", "--prune", "--depth", "1", "origin"], token);
      if (!fetch.ok) throw new Error(fetch.stderr.trim());
      const head = git(["-C", dest, "rev-parse", "--abbrev-ref", "origin/HEAD"], token);
      const branch = head.ok && head.stdout.trim() ? head.stdout.trim() : "origin/HEAD";
      const reset = git(["-C", dest, "reset", "--hard", branch], token);
      if (!reset.ok) throw new Error(reset.stderr.trim());
      log(`updated ${org}/${repo}`);
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      const clone = git(["clone", "--depth", "1", url, dest], token);
      if (!clone.ok) throw new Error(clone.stderr.trim());
      log(`cloned ${org}/${repo}`);
    }
    return dest;
  } catch (err) {
    log(`could not fetch ${org}/${repo}: ${(err as Error).message}`);
    return null;
  }
}

// --------------------------------------------------------------------------- //
// source normalization
// --------------------------------------------------------------------------- //
export function normalizeSource(entry: SourceEntry): NormalizedSource {
  if (typeof entry === "string") {
    const { org, repo, subpath } = parseRepoRef(entry);
    return { org, repo, sourceDir: subpath || null, targetDir: null };
  }
  const ref = entry.repo ?? entry.source ?? "";
  const { org, repo, subpath } = parseRepoRef(ref);
  const sourceDir = entry.sourceDir ?? (subpath || null);
  return { org, repo, sourceDir, targetDir: entry.targetDir ?? null };
}

export function dedupSources(entries: SourceEntry[]): NormalizedSource[] {
  const seen = new Set<string>();
  const out: NormalizedSource[] = [];
  for (const entry of entries) {
    let norm: NormalizedSource;
    try {
      norm = normalizeSource(entry);
    } catch (err) {
      log(`skipping source: ${(err as Error).message}`);
      continue;
    }
    const key = `${norm.org}/${norm.repo} ${norm.sourceDir} ${norm.targetDir}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

// --------------------------------------------------------------------------- //
// source-side root overrides
// --------------------------------------------------------------------------- //
function readSourceRoots(clone: string): Record<string, unknown> {
  const data = readYaml(join(clone, ".claude", "shared-config-roots.yaml"));
  return isObject(data) ? data : {};
}

export function resolveTypeDir(
  clone: string,
  source: NormalizedSource,
  sourceRoots: Record<string, unknown>,
  rtype: string,
  defaultSourceDir: string,
): string | null {
  const rootsMap = isObject(sourceRoots.roots)
    ? (sourceRoots.roots as Record<string, unknown>)
    : null;
  let rel: string;
  if (rootsMap && typeof rootsMap[rtype] === "string") {
    rel = rootsMap[rtype] as string;
  } else {
    let base = source.sourceDir;
    if (base == null && typeof sourceRoots.sourceDir === "string") base = sourceRoots.sourceDir;
    if (base == null) base = defaultSourceDir || ".";
    rel = base === "." || base === "" ? rtype : join(base, rtype);
  }
  const full = normalize(join(clone, rel));
  // Guard against escaping the clone via a malicious sourceDir.
  const realClone = realpathSync(clone);
  const realFull = existsSync(full) ? realpathSync(full) : full;
  if (realFull !== realClone && !realFull.startsWith(realClone + "/")) {
    log(`refusing to link outside clone: ${rel}`);
    return null;
  }
  return existsSync(full) && statSync(full).isDirectory() ? full : null;
}

// --------------------------------------------------------------------------- //
// symlink management
// --------------------------------------------------------------------------- //
function ensureSymlink(linkPath: string, target: string): boolean {
  const abs = resolvePath(target);
  try {
    const st = lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      if (realpathSync(linkPath) === realpathSync(abs)) return true;
      unlinkSync(linkPath);
    } else {
      log(`WARNING: ${linkPath} exists as a real path; not replacing`);
      return false;
    }
  } catch {
    /* does not exist */
  }
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(abs, linkPath);
  return true;
}

// --------------------------------------------------------------------------- //
// project slug
// --------------------------------------------------------------------------- //
export function computeSlug(projectDir: string): string {
  const res = git(["-C", projectDir, "config", "--get", "remote.origin.url"]);
  const url = res.ok ? res.stdout.trim() : "";
  const m = url ? url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/) : null;
  if (m) return `${sanitize(m[1]!)}__${sanitize(m[2]!)}`;
  const real = realpathSync(projectDir);
  const short = createHash("sha1").update(real).digest("hex").slice(0, 8);
  return `${sanitize(real.split("/").pop() || "project")}-${short}`;
}

// --------------------------------------------------------------------------- //
// settings resolution
// --------------------------------------------------------------------------- //
function loadPluginSettings(file: string): Record<string, unknown> {
  const data = readYaml(file);
  if (!isObject(data)) return {};
  const section = data[PLUGIN_NAME];
  return isObject(section) ? section : {};
}

function loadStandalone(file: string): Record<string, unknown> {
  return unwrapSettings(readYaml(file));
}

function loadUpstream(sourcesDir: string, token?: string): Record<string, unknown> {
  const ref = (process.env.AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM ?? "").trim();
  if (!ref) return {};
  let parsed;
  try {
    parsed = parseRepoRef(ref);
  } catch (err) {
    log(`AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM: ${(err as Error).message}`);
    return {};
  }
  const clone = cloneOrUpdate(parsed.org, parsed.repo, sourcesDir, token);
  if (!clone) return {};
  const target = parsed.subpath ? join(clone, parsed.subpath) : clone;
  const candidates: string[] = [];
  if (existsSync(target) && statSync(target).isFile()) {
    candidates.push(target);
  } else if (existsSync(target) && statSync(target).isDirectory()) {
    candidates.push(
      join(target, "shared-config.settings.yaml"),
      join(target, "plugins.settings.yaml"),
    );
  }
  for (const cand of candidates) {
    const data = readYaml(cand);
    if (data !== undefined) {
      log(`loaded upstream config from ${parsed.org}/${parsed.repo}:${relative(clone, cand)}`);
      return unwrapSettings(data);
    }
  }
  log(`upstream ${ref}: no shared-config settings found at the given path`);
  return {};
}

function coerceScalar(key: string, val: unknown): unknown {
  if ((key === "enabled" || key === "mergeSettings") && typeof val === "string") {
    return !["false", "0", "no", ""].includes(val.trim().toLowerCase());
  }
  if (key === "waitForTokenTimeoutSeconds" && typeof val === "string") {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? DEFAULTS.waitForTokenTimeoutSeconds : n;
  }
  return val;
}

function mergeLayers(layers: Record<string, unknown>[]): Settings {
  const result: Settings = JSON.parse(JSON.stringify(DEFAULTS));
  const allSources: SourceEntry[] = [];
  for (const layer of layers) {
    if (!isObject(layer)) continue;
    for (const [key, val] of Object.entries(layer)) {
      if (key === "sources") {
        if (Array.isArray(val)) allSources.push(...(val as SourceEntry[]));
        continue;
      }
      if (val === "" || val === null || val === undefined) continue;
      (result as Record<string, unknown>)[key] = coerceScalar(key, val);
    }
  }
  result.sources = dedupSources(allSources) as unknown as SourceEntry[];
  return result;
}

/** Local (non-upstream) layers, low -> high precedence. */
function localLayers(projectDir: string): Record<string, unknown>[] {
  const home = homedir();
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? dirname(import.meta.dir);
  return [
    loadPluginSettings(join(pluginRoot, "shared-config.settings.yaml")),
    loadPluginSettings(join(home, ".claude", "plugins.settings.yaml")),
    loadStandalone(join(home, ".claude", "shared-config.settings.yaml")),
    loadPluginSettings(join(projectDir, ".claude", "plugins.settings.yaml")),
    loadStandalone(join(projectDir, ".claude", "shared-config.settings.yaml")),
  ];
}

// --------------------------------------------------------------------------- //
// github-app token resolution
// --------------------------------------------------------------------------- //
/** Parse a bash-style env file (export K=V / source PATH), following sources. */
export function parseEnvFile(
  path: string,
  seen = new Set<string>(),
  depth = 0,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (depth > 8 || seen.has(path) || !existsSync(path)) return out;
  seen.add(path);
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    const exp = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (exp) {
      let val = exp[2]!.trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[exp[1]!] = val;
      continue;
    }
    const src = line.match(/^(?:source|\.)\s+(.+)$/);
    if (src) {
      let p = src[1]!.trim().replace(/^["']|["']$/g, "");
      if (!isAbsolute(p)) p = resolvePath(dirname(path), p);
      Object.assign(out, parseEnvFile(p, seen, depth + 1));
    }
  }
  return out;
}

function sleepSync(ms: number): void {
  // Bun provides a synchronous sleep; fall back to a busy Atomics wait.
  const b = (globalThis as { Bun?: { sleepSync?: (ms: number) => void } }).Bun;
  if (b?.sleepSync) b.sleepSync(ms);
  else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Resolve the github-app token, waiting up to timeoutSec for it to appear in
 *  CLAUDE_ENV_FILE. Prefers the github-app token (GITHUB_TOKEN_FILE signal). */
export function resolveToken(timeoutSec: number): string | undefined {
  const envFile = process.env.CLAUDE_ENV_FILE;
  if (process.env.GH_TOKEN && process.env.GITHUB_TOKEN_FILE) return process.env.GH_TOKEN;

  if (envFile && timeoutSec > 0) {
    let elapsed = 0;
    let interval = 1;
    while (elapsed < timeoutSec) {
      const env = parseEnvFile(envFile);
      if (env.GITHUB_TOKEN_FILE && env.GH_TOKEN) {
        process.env.GH_TOKEN = env.GH_TOKEN;
        process.env.GITHUB_TOKEN_FILE = env.GITHUB_TOKEN_FILE;
        if (env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = env.GITHUB_TOKEN;
        return env.GH_TOKEN;
      }
      sleepSync(interval * 1000);
      elapsed += interval;
      interval = Math.min(interval * 2, 4);
    }
  }
  const tok = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (tok) {
    process.env.GH_TOKEN ??= tok;
    process.env.GITHUB_TOKEN ??= tok;
  }
  return tok;
}

// --------------------------------------------------------------------------- //
// link building
// --------------------------------------------------------------------------- //
export function buildLinks(
  projectDir: string,
  dataDir: string,
  slug: string,
  settings: Settings,
  sources: NormalizedSource[],
  token?: string,
): string[] {
  const sourcesDir = join(dataDir, "shared-configs", "sources");
  const slugRoot = join(dataDir, "shared-configs", sanitize(slug));
  mkdirSync(sourcesDir, { recursive: true });
  if (existsSync(slugRoot)) rmSync(slugRoot, { recursive: true, force: true });

  const resourceTypes = settings.resourceTypes.length
    ? settings.resourceTypes
    : [...RESOURCE_TYPES_DEFAULT];
  const defaultTargetBase = settings.targetBaseDir || ".claude";
  const populated = new Set<string>();
  const targetBases = new Set<string>([defaultTargetBase]);
  const clones = new Map<string, string | null>();

  for (const src of sources) {
    const ckey = `${src.org}/${src.repo}`;
    if (!clones.has(ckey)) clones.set(ckey, cloneOrUpdate(src.org, src.repo, sourcesDir, token));
    const clone = clones.get(ckey);
    if (!clone) continue;
    const roots = readSourceRoots(clone);
    const targetBase = src.targetDir ?? defaultTargetBase;
    targetBases.add(targetBase);
    const linkName =
      `${sanitize(src.org)}__${sanitize(src.repo)}` +
      (src.sourceDir ? `__${sanitize(src.sourceDir)}` : "");

    for (const rtype of resourceTypes) {
      const typeDir = resolveTypeDir(clone, src, roots, rtype, settings.defaultSourceDir);
      if (!typeDir) continue;
      const inter = join(slugRoot, sanitize(targetBase), rtype);
      if (ensureSymlink(join(inter, linkName), typeDir)) populated.add(`${targetBase} ${rtype}`);
    }
  }

  const linked: string[] = [];
  for (const targetBase of targetBases) {
    for (const rtype of resourceTypes) {
      const inter = join(slugRoot, sanitize(targetBase), rtype);
      const sharedLink = join(projectDir, targetBase, rtype, ".shared");
      if (populated.has(`${targetBase} ${rtype}`)) {
        if (ensureSymlink(sharedLink, inter)) linked.push(`${targetBase}/${rtype}`);
      } else if (existsSync(sharedLink) || isSymlink(sharedLink)) {
        try {
          if (
            isSymlink(sharedLink) &&
            realpathSync(sharedLink).startsWith(realpathSync(slugRoot))
          ) {
            unlinkSync(sharedLink);
          }
        } catch {
          if (isSymlink(sharedLink)) unlinkSync(sharedLink); // dangling
        }
      }
    }
  }
  return linked;
}

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------- //
// settings merge (opt-in)
// --------------------------------------------------------------------------- //
function evalJsonnet(path: string): unknown {
  if (!toolAvailable("jsonnet")) {
    log(`jsonnet not available (no binary on PATH and no mise); skipping ${path}`);
    return undefined;
  }
  const [cmd, argv] = toolArgv("jsonnet", [path]);
  const res = spawnSync(cmd, argv, { encoding: "utf8" });
  if (res.status !== 0) {
    log(`jsonnet failed for ${path}: ${(res.stderr ?? "").toString().trim()}`);
    return undefined;
  }
  try {
    return JSON.parse((res.stdout ?? "").toString());
  } catch (err) {
    log(`jsonnet output not JSON for ${path}: ${(err as Error).message}`);
    return undefined;
  }
}

function loadFragment(path: string): unknown {
  if (path.endsWith(".jsonnet")) return evalJsonnet(path);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    log(`could not read settings fragment ${path}: ${(err as Error).message}`);
    return undefined;
  }
}

export function mergeSettings(
  projectDir: string,
  settings: Settings,
  sources: NormalizedSource[],
  dataDir: string,
): string[] {
  const sourcesDir = join(dataDir, "shared-configs", "sources");
  const merged: string[] = [];
  for (const fname of ["settings.json", "settings.local.json"]) {
    const accumulated: Record<string, unknown> = {};
    let found = false;
    for (const src of sources) {
      const clone = join(sourcesDir, sanitize(src.org), sanitize(src.repo));
      if (!existsSync(clone)) continue;
      const base = src.sourceDir ?? settings.defaultSourceDir ?? ".";
      const baseDir = base === "." || base === "" ? clone : join(clone, base);
      for (const cand of [
        join(baseDir, "settings", fname),
        join(baseDir, "settings", fname + ".jsonnet"),
      ]) {
        if (existsSync(cand) && statSync(cand).isFile()) {
          const frag = loadFragment(cand);
          if (isObject(frag)) {
            deepMerge(accumulated, frag);
            found = true;
          }
        }
      }
    }
    if (!found) continue;
    const target = join(projectDir, ".claude", fname);
    let existing: Record<string, unknown> = {};
    if (existsSync(target)) {
      try {
        existing = JSON.parse(readFileSync(target, "utf8"));
      } catch (err) {
        log(`existing ${fname} unparseable; skipping merge: ${(err as Error).message}`);
        continue;
      }
      copyFileSync(target, target + ".shared-config.bak");
    }
    // project wins: shared fragments first, project overlaid on top
    const result = JSON.parse(JSON.stringify(accumulated));
    deepMerge(result, isObject(existing) ? existing : {});
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
    merged.push(fname);
    log(`merged shared settings into ${fname}`);
  }
  return merged;
}

// --------------------------------------------------------------------------- //
// orchestration
// --------------------------------------------------------------------------- //
export function resolveDataDir(): string {
  const data = (process.env.CLAUDE_PLUGIN_DATA ?? "").trim();
  if (data) return data;
  return join(homedir(), ".claude", "plugins", "data", "shared-config-agents");
}

export interface SyncResult {
  enabled: boolean;
  sourceCount: number;
  linked: string[];
  merged: string[];
  summary: string;
}

/** Full sync: resolve config (+upstream), clone sources, build links, merge. */
export function runSync(projectDir: string, dataDir: string): SyncResult {
  mkdirSync(dataDir, { recursive: true });
  const sourcesDir = join(dataDir, "shared-configs", "sources");
  mkdirSync(sourcesDir, { recursive: true });

  // 1. Local layers first (no network) to learn the token-wait timeout.
  const locals = localLayers(projectDir);
  const preTimeout = mergeLayers(locals).waitForTokenTimeoutSeconds;

  // 2. Resolve the github-app token (waiting briefly for it).
  const token = resolveToken(preTimeout);

  // 3. Layer upstream (lowest precedence) under the local layers.
  const upstream = loadUpstream(sourcesDir, token);
  const settings = mergeLayers([upstream, ...locals]);

  if (!settings.enabled) {
    return {
      enabled: false,
      sourceCount: 0,
      linked: [],
      merged: [],
      summary: "shared-config: disabled via settings",
    };
  }
  const sources = settings.sources as unknown as NormalizedSource[];
  if (!sources.length) {
    return {
      enabled: true,
      sourceCount: 0,
      linked: [],
      merged: [],
      summary: "shared-config: no sources configured",
    };
  }

  const slug = computeSlug(projectDir);
  log(`project slug: ${slug}; ${sources.length} source(s)`);

  const linked = buildLinks(projectDir, dataDir, slug, settings, sources, token);
  let merged: string[] = [];
  if (settings.mergeSettings) {
    try {
      merged = mergeSettings(projectDir, settings, sources, dataDir);
    } catch (err) {
      log(`settings merge failed: ${(err as Error).message}`);
    }
  }

  const parts = [
    linked.length ? `linked ${[...new Set(linked)].sort().join(", ")}` : "no resource dirs linked",
  ];
  if (merged.length) parts.push(`merged ${merged.join(", ")}`);
  return {
    enabled: true,
    sourceCount: sources.length,
    linked,
    merged,
    summary: `shared-config: ${sources.length} source(s); ${parts.join("; ")}`,
  };
}

async function readEventName(): Promise<string> {
  try {
    const text = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((r) => setTimeout(() => r(""), 500)),
    ]);
    if (text) {
      const parsed = JSON.parse(text) as { hook_event_name?: string };
      if (parsed.hook_event_name) return parsed.hook_event_name;
    }
  } catch {
    /* no/!json stdin */
  }
  return "SessionStart";
}

function emit(eventName: string, summary: string): void {
  const out = {
    hookSpecificOutput: { hookEventName: eventName, additionalContext: summary },
    reloadSkills: true,
  };
  console.log(JSON.stringify(out));
}

export async function main(): Promise<void> {
  const eventName = await readEventName();
  let summary = "shared-config: no work done";
  try {
    const projectDir = resolvePath(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
    summary = runSync(projectDir, resolveDataDir()).summary;
  } catch (err) {
    log(`unexpected error: ${(err as Error).message}`);
    summary = "shared-config: sync aborted due to an error; session continues";
  }
  emit(eventName, summary);
}

if (import.meta.main) {
  await main();
}
