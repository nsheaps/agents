#!/usr/bin/env python3
"""shared_config_sync.py — core orchestrator for the shared-config plugin.

Invoked by hooks/scripts/sync-shared-config.sh on Setup and SessionStart.

What it does (see README.md for the full design):

  1. Resolve settings from (low -> high precedence):
       - $AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM  (org-level bootstrap config)
       - ~/.claude/plugins.settings.yaml        (key: shared-config)
       - ~/.claude/shared-config.settings.yaml
       - <project>/.claude/plugins.settings.yaml (key: shared-config)
       - <project>/.claude/shared-config.settings.yaml
     `sources` lists are UNIONed across every layer; other keys are last-wins.
  2. Clone/update each source repo into the shared cache
       $CLAUDE_PLUGIN_DATA/shared-configs/sources/<org>/<repo>/
     (a single clone is shared by every project that references it).
  3. Build a per-project link tree under
       $CLAUDE_PLUGIN_DATA/shared-configs/<slug>/<targetBase>/<type>/<org>__<repo> -> <clone>/<resolved type dir>
     and point <project>/<targetBase>/<type>/.shared at it.
     Because every project's links resolve (via realpath) to the same source
     clone, Claude Code can deduplicate identical resources across projects.
  4. (Opt-in) merge settings.json / settings.local.json fragments from sources.

Repo references use the GitHub-Actions `uses:` style WITHOUT a ref:
    org/repo                -> whole repo, resources at the default source dir
    org/repo/sub/path       -> `sub/path` is the source dir (base of {rules,...})

Setup/SessionStart hooks must never break the session: this script prints a
one-line summary to stdout (used as additionalContext) and never raises out of
main() — all failures are logged to stderr and swallowed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover - pyyaml is expected but degrade gracefully
    yaml = None

PLUGIN_NAME = "shared-config"
RESOURCE_TYPES_DEFAULT = ["rules", "skills", "commands", "agents"]

DEFAULTS = {
    "enabled": True,
    "resourceTypes": RESOURCE_TYPES_DEFAULT,
    "defaultSourceDir": ".",
    "targetBaseDir": ".claude",
    "mergeSettings": False,
    "waitForTokenTimeoutSeconds": 15,
    "sources": [],
}

GITHUB_HOST = "github.com"


# --------------------------------------------------------------------------- #
# logging
# --------------------------------------------------------------------------- #
def log(msg: str) -> None:
    print(f"{PLUGIN_NAME}: {msg}", file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def sanitize(part: str) -> str:
    """Make a string safe to use as a single path component."""
    part = part.strip().strip("/")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", part) or "_"


def read_yaml(path: str):
    if not os.path.isfile(path):
        return None
    if yaml is None:
        log(f"pyyaml unavailable; cannot read {path}")
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except Exception as exc:  # noqa: BLE001
        log(f"failed to parse {path}: {exc}")
        return None


def deep_update(base: dict, overlay: dict) -> dict:
    """Recursively merge overlay into base (overlay wins). Mutates base."""
    for key, val in overlay.items():
        if isinstance(val, dict) and isinstance(base.get(key), dict):
            deep_update(base[key], val)
        else:
            base[key] = val
    return base


# --------------------------------------------------------------------------- #
# repo references + git
# --------------------------------------------------------------------------- #
def parse_repo_ref(ref: str):
    """Parse a GitHub `uses:`-style ref (no @ref) into (org, repo, subpath).

    'org/repo'            -> ('org', 'repo', '')
    'org/repo/a/b'        -> ('org', 'repo', 'a/b')
    """
    ref = (ref or "").strip().strip("/")
    if "@" in ref:  # refs are explicitly unsupported for now; drop it.
        ref = ref.split("@", 1)[0].strip("/")
    parts = [p for p in ref.split("/") if p]
    if len(parts) < 2:
        raise ValueError(f"invalid repo reference (need org/repo): {ref!r}")
    org, repo = parts[0], parts[1]
    subpath = "/".join(parts[2:])
    return org, repo, subpath


def _auth_git_args(token: str | None):
    """Return extra `git -c` args that authenticate to github.com via a token,
    without persisting the credential in the repo config."""
    if not token:
        return []
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    return [
        "-c",
        f"http.https://{GITHUB_HOST}/.extraheader=AUTHORIZATION: basic {basic}",
    ]


def _run_git(args, cwd=None, token=None, check=True):
    cmd = ["git"]
    cmd += _auth_git_args(token)
    cmd += args
    proc = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed ({proc.returncode}): {proc.stderr.strip()}"
        )
    return proc


def repo_url(org: str, repo: str) -> str:
    # SHARED_CONFIG_TEST_GIT_BASE lets tests point at local fixture repos.
    base = os.environ.get("SHARED_CONFIG_TEST_GIT_BASE", "").strip()
    if base:
        return os.path.join(base, org, repo)
    return f"https://{GITHUB_HOST}/{org}/{repo}.git"


def clone_or_update(org: str, repo: str, sources_dir: str, token: str | None) -> str | None:
    """Ensure sources_dir/<org>/<repo> is a fresh clone reset to the remote."""
    dest = os.path.join(sources_dir, sanitize(org), sanitize(repo))
    url = repo_url(org, repo)
    try:
        if os.path.isdir(os.path.join(dest, ".git")):
            # Fetch + hard reset to the remote default branch.
            _run_git(["-C", dest, "remote", "set-url", "origin", url], token=token, check=False)
            _run_git(["-C", dest, "fetch", "--prune", "--depth", "1", "origin"], token=token)
            head = _run_git(
                ["-C", dest, "rev-parse", "--abbrev-ref", "origin/HEAD"],
                token=token,
                check=False,
            )
            branch = head.stdout.strip() or "origin/HEAD"
            _run_git(["-C", dest, "reset", "--hard", branch], token=token)
            log(f"updated {org}/{repo}")
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if os.path.exists(dest):
                shutil.rmtree(dest, ignore_errors=True)
            _run_git(["clone", "--depth", "1", url, dest], token=token)
            log(f"cloned {org}/{repo}")
        return dest
    except Exception as exc:  # noqa: BLE001
        log(f"could not fetch {org}/{repo}: {exc}")
        return None


# --------------------------------------------------------------------------- #
# settings resolution
# --------------------------------------------------------------------------- #
def _unwrap_settings(data) -> dict:
    """Accept either a top-level mapping or one nested under `shared-config`."""
    if not isinstance(data, dict):
        return {}
    if "shared-config" in data and isinstance(data["shared-config"], dict):
        return data["shared-config"]
    return data


def load_upstream(sources_dir: str, token: str | None) -> dict:
    ref = os.environ.get("AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM", "").strip()
    if not ref:
        return {}
    try:
        org, repo, subpath = parse_repo_ref(ref)
    except ValueError as exc:
        log(f"AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM: {exc}")
        return {}
    clone = clone_or_update(org, repo, sources_dir, token)
    if not clone:
        return {}
    target = os.path.join(clone, subpath) if subpath else clone
    candidates = []
    if os.path.isfile(target):
        candidates = [target]
    elif os.path.isdir(target):
        candidates = [
            os.path.join(target, "shared-config.settings.yaml"),
            os.path.join(target, "plugins.settings.yaml"),
        ]
    for cand in candidates:
        data = read_yaml(cand)
        if data is not None:
            log(f"loaded upstream config from {org}/{repo}:{os.path.relpath(cand, clone)}")
            return _unwrap_settings(data)
    log(f"upstream {ref}: no shared-config settings found at the given path")
    return {}


def load_lib_config() -> dict:
    """Config resolved by the shared-lib in the hook (passed as JSON).

    Scalars use "" sentinels and lists use [] to mean "unset" so that
    upstream/defaults can still apply. Returns a cleaned dict with unset keys
    removed."""
    raw = os.environ.get("SHARED_CONFIG_LIB_JSON", "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        log(f"could not parse SHARED_CONFIG_LIB_JSON: {exc}")
        return {}
    if not isinstance(data, dict):
        return {}
    cleaned: dict = {}
    for key, val in data.items():
        if val in ("", None):
            continue
        if isinstance(val, list) and not val:
            continue
        cleaned[key] = val
    return cleaned


def load_standalone(path: str) -> dict:
    """Read a standalone shared-config.settings.yaml overlay (top-level or
    nested under `shared-config:`)."""
    for cand in (path, path[:-5] + ".yml" if path.endswith(".yaml") else path):
        data = read_yaml(cand)
        if data is not None:
            return _unwrap_settings(data)
    return {}


def _coerce(key: str, val):
    """Coerce string-typed scalars coming from the shared-lib to the right type."""
    if key in ("enabled", "mergeSettings") and isinstance(val, str):
        return val.strip().lower() not in ("false", "0", "no", "")
    if key == "waitForTokenTimeoutSeconds" and isinstance(val, str):
        try:
            return int(val)
        except ValueError:
            return DEFAULTS[key]
    return val


def resolve_settings(project_dir: str, sources_dir: str, token: str | None) -> dict:
    home = os.path.expanduser("~")
    # Low -> high precedence. `sources` are UNIONed across every layer; other
    # keys are last-wins. The repo's plugins.settings.yaml is provided by the
    # shared-lib (load_lib_config); upstream + standalone are overlays handled
    # here because they fall outside the lib's plugins.settings.yaml scope.
    layers = [
        load_upstream(sources_dir, token),                                   # org bootstrap
        load_standalone(os.path.join(home, ".claude", "shared-config.settings.yaml")),
        load_lib_config(),                                                   # repo plugins.settings (shared-lib)
        load_standalone(os.path.join(project_dir, ".claude", "shared-config.settings.yaml")),
    ]

    result = json.loads(json.dumps(DEFAULTS))  # deep copy
    all_sources: list = list(DEFAULTS.get("sources", []))

    for layer in layers:
        if not isinstance(layer, dict):
            continue
        layer = dict(layer)
        srcs = layer.pop("sources", None)
        if isinstance(srcs, list):
            all_sources.extend(srcs)
        for key, val in layer.items():
            if val in ("", None):
                continue
            result[key] = _coerce(key, val)

    result["sources"] = dedup_sources(all_sources)
    return result


# --------------------------------------------------------------------------- #
# source normalization
# --------------------------------------------------------------------------- #
def normalize_source(entry):
    """Return {org, repo, sourceDir|None, targetDir|None} or None."""
    if isinstance(entry, str):
        org, repo, subpath = parse_repo_ref(entry)
        return {"org": org, "repo": repo, "sourceDir": subpath or None, "targetDir": None}
    if isinstance(entry, dict):
        ref = entry.get("repo") or entry.get("source") or ""
        org, repo, subpath = parse_repo_ref(ref)
        # explicit sourceDir overrides any subpath embedded in the ref
        source_dir = entry.get("sourceDir")
        if source_dir is None:
            source_dir = subpath or None
        return {
            "org": org,
            "repo": repo,
            "sourceDir": source_dir,
            "targetDir": entry.get("targetDir"),
        }
    raise ValueError(f"unsupported source entry: {entry!r}")


def dedup_sources(entries) -> list:
    seen = set()
    out = []
    for entry in entries:
        try:
            norm = normalize_source(entry)
        except ValueError as exc:
            log(f"skipping source: {exc}")
            continue
        key = (norm["org"], norm["repo"], norm["sourceDir"], norm["targetDir"])
        if key in seen:
            continue
        seen.add(key)
        out.append(norm)
    return out


# --------------------------------------------------------------------------- #
# source-side root overrides
# --------------------------------------------------------------------------- #
def read_source_roots(clone: str) -> dict:
    data = read_yaml(os.path.join(clone, ".claude", "shared-config-roots.yaml"))
    return data if isinstance(data, dict) else {}


def resolve_type_dir(clone, source, source_roots, rtype, default_source_dir):
    """Absolute path of the source's <type> dir, or None if it doesn't exist."""
    roots_map = source_roots.get("roots") if isinstance(source_roots, dict) else None
    if isinstance(roots_map, dict) and rtype in roots_map:
        rel = roots_map[rtype]
    else:
        base = source.get("sourceDir")
        if base is None:
            base = source_roots.get("sourceDir") if isinstance(source_roots, dict) else None
        if base is None:
            base = default_source_dir or "."
        rel = rtype if base in (".", "", None) else os.path.join(base, rtype)
    full = os.path.normpath(os.path.join(clone, rel))
    # Guard against path escaping the clone via a malicious sourceDir.
    if os.path.commonpath([os.path.realpath(full), os.path.realpath(clone)]) != os.path.realpath(clone):
        log(f"refusing to link outside clone: {rel}")
        return None
    return full if os.path.isdir(full) else None


# --------------------------------------------------------------------------- #
# symlink management
# --------------------------------------------------------------------------- #
def ensure_symlink(link_path: str, target: str) -> bool:
    """Idempotently point link_path at target (absolute). Returns True if a
    link is in place afterwards."""
    target = os.path.abspath(target)
    if os.path.islink(link_path):
        if os.path.realpath(link_path) == os.path.realpath(target):
            return True
        os.unlink(link_path)
    elif os.path.exists(link_path):
        log(f"WARNING: {link_path} exists as a real path; not replacing")
        return False
    os.makedirs(os.path.dirname(link_path), exist_ok=True)
    os.symlink(target, link_path)
    return True


def build_links(project_dir, data_dir, slug, settings, sources):
    sources_dir = os.path.join(data_dir, "shared-configs", "sources")
    slug_root = os.path.join(data_dir, "shared-configs", sanitize(slug))
    os.makedirs(sources_dir, exist_ok=True)

    # Rebuild the per-project tree from scratch so removed sources don't linger.
    if os.path.isdir(slug_root):
        shutil.rmtree(slug_root, ignore_errors=True)

    resource_types = settings.get("resourceTypes") or RESOURCE_TYPES_DEFAULT
    default_source_dir = settings.get("defaultSourceDir", ".")
    default_target_base = settings.get("targetBaseDir", ".claude")

    # (targetBase, type) -> True once at least one source contributes content.
    populated = {}
    target_bases = {default_target_base}

    clones = {}
    for src in sources:
        ckey = (src["org"], src["repo"])
        if ckey not in clones:
            clones[ckey] = clone_or_update(src["org"], src["repo"], sources_dir, TOKEN)
        clone = clones[ckey]
        if not clone:
            continue
        roots = read_source_roots(clone)
        target_base = src.get("targetDir") or default_target_base
        target_bases.add(target_base)
        link_suffix = ""
        if src.get("sourceDir"):
            link_suffix = "__" + sanitize(src["sourceDir"])
        link_name = f"{sanitize(src['org'])}__{sanitize(src['repo'])}{link_suffix}"

        for rtype in resource_types:
            type_dir = resolve_type_dir(clone, src, roots, rtype, default_source_dir)
            if not type_dir:
                continue
            inter = os.path.join(slug_root, sanitize(target_base), rtype)
            if ensure_symlink(os.path.join(inter, link_name), type_dir):
                populated[(target_base, rtype)] = True

    # Point each project <targetBase>/<type>/.shared at the intermediate dir,
    # and clean up links for types that no longer have content.
    linked = []
    for target_base in target_bases:
        for rtype in resource_types:
            inter = os.path.join(slug_root, sanitize(target_base), rtype)
            shared_link = os.path.join(project_dir, target_base, rtype, ".shared")
            if populated.get((target_base, rtype)):
                if ensure_symlink(shared_link, inter):
                    linked.append(f"{target_base}/{rtype}")
            elif os.path.islink(shared_link):
                # stale: only remove if it pointed into our cache
                if os.path.realpath(shared_link).startswith(os.path.realpath(slug_root)) or not os.path.exists(shared_link):
                    os.unlink(shared_link)
    return linked


# --------------------------------------------------------------------------- #
# project slug
# --------------------------------------------------------------------------- #
def compute_slug(project_dir: str) -> str:
    proc = subprocess.run(
        ["git", "-C", project_dir, "config", "--get", "remote.origin.url"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    url = proc.stdout.strip() if proc.returncode == 0 else ""
    m = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?/?$", url) if url else None
    if m:
        return f"{sanitize(m.group(1))}__{sanitize(m.group(2))}"
    real = os.path.realpath(project_dir)
    short = hashlib.sha1(real.encode()).hexdigest()[:8]
    return f"{sanitize(os.path.basename(real))}-{short}"


# --------------------------------------------------------------------------- #
# settings merge (opt-in, experimental)
# --------------------------------------------------------------------------- #
def _eval_jsonnet(path: str):
    if shutil.which("jsonnet") is None:
        log("jsonnet not installed; skipping jsonnet fragment " + path)
        return None
    proc = subprocess.run(["jsonnet", path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        log(f"jsonnet failed for {path}: {proc.stderr.strip()}")
        return None
    try:
        return json.loads(proc.stdout)
    except Exception as exc:  # noqa: BLE001
        log(f"jsonnet output not JSON for {path}: {exc}")
        return None


def _load_fragment(path: str):
    if path.endswith(".jsonnet"):
        return _eval_jsonnet(path)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # noqa: BLE001
        log(f"could not read settings fragment {path}: {exc}")
        return None


def merge_settings(project_dir, settings, sources, data_dir):
    """Deep-merge source-provided settings fragments into the project's
    .claude/settings*.json. PROJECT values always win. Best-effort/experimental."""
    sources_dir = os.path.join(data_dir, "shared-configs", "sources")
    default_source_dir = settings.get("defaultSourceDir", ".")
    merged_any = []
    for fname in ("settings.json", "settings.local.json"):
        accumulated: dict = {}
        found = False
        for src in sources:
            clone = os.path.join(sources_dir, sanitize(src["org"]), sanitize(src["repo"]))
            if not os.path.isdir(clone):
                continue
            base = src.get("sourceDir") or default_source_dir or "."
            base_dir = clone if base in (".", "") else os.path.join(clone, base)
            for cand in (
                os.path.join(base_dir, "settings", fname),
                os.path.join(base_dir, "settings", fname + ".jsonnet"),
            ):
                if os.path.isfile(cand):
                    frag = _load_fragment(cand)
                    if isinstance(frag, dict):
                        deep_update(accumulated, frag)
                        found = True
        if not found:
            continue
        target = os.path.join(project_dir, ".claude", fname)
        existing = {}
        if os.path.isfile(target):
            try:
                with open(target, "r", encoding="utf-8") as fh:
                    existing = json.load(fh)
            except Exception as exc:  # noqa: BLE001
                log(f"existing {fname} unparseable; skipping merge: {exc}")
                continue
            shutil.copy2(target, target + ".shared-config.bak")
        # project wins: start from shared fragments, overlay project on top
        result = json.loads(json.dumps(accumulated))
        deep_update(result, existing if isinstance(existing, dict) else {})
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2)
            fh.write("\n")
        merged_any.append(fname)
        log(f"merged shared settings into {fname}")
    return merged_any


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
TOKEN = None  # set in main(), read by build_links


def resolve_data_dir() -> str:
    data = os.environ.get("CLAUDE_PLUGIN_DATA", "").strip()
    if data:
        return data
    # Deterministic fallback per the plugins reference: <name>-<marketplace>.
    return os.path.join(
        os.path.expanduser("~"), ".claude", "plugins", "data", "shared-config-agents"
    )


def main() -> int:
    global TOKEN
    TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or None

    project_dir = os.path.abspath(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
    data_dir = resolve_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    sources_dir = os.path.join(data_dir, "shared-configs", "sources")
    os.makedirs(sources_dir, exist_ok=True)

    settings = resolve_settings(project_dir, sources_dir, TOKEN)

    if not settings.get("enabled", True):
        print("shared-config: disabled via settings")
        return 0

    sources = settings.get("sources") or []
    if not sources:
        print("shared-config: no sources configured")
        return 0

    slug = compute_slug(project_dir)
    log(f"project slug: {slug}; {len(sources)} source(s)")

    linked = build_links(project_dir, data_dir, slug, settings, sources)

    merged = []
    if settings.get("mergeSettings"):
        try:
            merged = merge_settings(project_dir, settings, sources, data_dir)
        except Exception as exc:  # noqa: BLE001
            log(f"settings merge failed: {exc}")

    parts = []
    if linked:
        parts.append("linked " + ", ".join(sorted(set(linked))))
    else:
        parts.append("no resource dirs linked")
    if merged:
        parts.append("merged " + ", ".join(merged))
    print(f"shared-config: {len(sources)} source(s); " + "; ".join(parts))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 - never break the session
        log(f"unexpected error: {exc}")
        print("shared-config: sync aborted due to an error; session continues")
        sys.exit(0)
