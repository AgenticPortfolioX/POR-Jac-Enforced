"""
Shared runtime control for the verification scripts.

Three of the four verification scripts need to drive the local Jac server and its
Postgres store, so that logic lives here rather than three times over.

The important thing this module encodes is that **the database name is derived,
never hardcoded**. Jac names the project's database after a hash of the project
path, and every `jac db` subcommand is cwd-sensitive: invoked from anywhere but
the project root, `jac db drop` reports a different database and "no database
yet", which reads like a successful drop and is not one. `project_database()`
therefore runs `jac db list` from the project root and parses the table.
"""
import os
import subprocess
import sys
import time

import requests

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
JAC_URL = os.environ.get("JAC_CLOUD_URL", "http://localhost:8000")
JAC_BIN = os.environ.get("JAC_BIN", os.path.expanduser("~/.local/bin/jac"))
ENTRY_POINT = "jac/main.jac"
HEALTH_TIMEOUT_SECONDS = 30
HEALTH_POLL_SECONDS = 0.5


def jac(*args: str, timeout: int = 120) -> subprocess.CompletedProcess:
    """Run the jac CLI from the project root. CWD matters — see the module docstring."""
    return subprocess.run(
        [JAC_BIN, *args],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def kill_server() -> None:
    """Stop any running `jac run`. Safe to call when none is running."""
    subprocess.run(
        ["pkill", "-f", "jac run"],
        capture_output=True,
        text=True,
    )
    # pkill signals; give the process a moment to release the port and the store.
    time.sleep(1.5)


def project_database() -> str:
    """
    The project's database name, read from `jac db list` run from the project root.

    The listing is a fixed table:

        data dir : /path/to/pg/main
        databases: 1 (8.0 MB)

        NAME                        SIZE  KIND     STATE  LAST USED  OWNER
        jac_por_jac_enforced_xxxx   8.0 MB  project  live   ...        /path

    When multiple databases are present, the function filters rows by the OWNER
    column — returning the first row whose owner path contains the project root
    basename. This prevents a stale second database from being returned ahead of
    the live one. Falls back to taking the first non-empty row when no owner
    column is found or no row matches. Raises if no database is listed.
    """
    result = jac("db", "list")
    lines = [ln.rstrip() for ln in result.stdout.splitlines()]

    header_idx = None
    owner_col = -1
    for i, line in enumerate(lines):
        if line.strip().upper().startswith("NAME"):
            header_idx = i
            # Locate the OWNER column offset from the header line.
            upper = line.upper()
            if "OWNER" in upper:
                owner_col = upper.index("OWNER")
            break

    if header_idx is None:
        raise RuntimeError(
            "no database listed by `jac db list` from %s.\nstdout:\n%s\nstderr:\n%s"
            % (PROJECT_ROOT, result.stdout, result.stderr)
        )

    project_basename = os.path.basename(PROJECT_ROOT).lower()
    first_candidate = None

    for row in lines[header_idx + 1:]:
        parts = row.split()
        if not parts:
            continue
        if first_candidate is None:
            first_candidate = parts[0]
        # If we have an OWNER column, prefer the row whose owner matches the project.
        if owner_col >= 0 and len(row) > owner_col:
            owner_field = row[owner_col:].split()[0].lower()
            if project_basename in owner_field or PROJECT_ROOT.lower() in owner_field:
                return parts[0]

    if first_candidate:
        return first_candidate

    raise RuntimeError(
        "no database listed by `jac db list` from %s.\nstdout:\n%s\nstderr:\n%s"
        % (PROJECT_ROOT, result.stdout, result.stderr)
    )



def reset_store() -> str:
    """
    The only reset that clears the graph: drop the project's database.

    `pkill` first — the store is a live Postgres database and must not be dropped
    underneath a running server. Note that `rm -rf .jac/data` is NOT a reset: that
    directory holds only the JWT secret.
    """
    kill_server()
    name = project_database()
    result = jac("db", "drop", name, "-y")
    if result.returncode != 0:
        raise RuntimeError(
            "`jac db drop %s -y` failed (exit %d).\nstdout:\n%s\nstderr:\n%s"
            % (name, result.returncode, result.stdout, result.stderr)
        )
    return name


def start_server(
    trace: bool = False,
    log_path: str | None = None,
    extra_env: dict | None = None,
) -> subprocess.Popen:
    """
    Start `jac run jac/main.jac --no-client` in the background.

    `--no-client` skips the client build, which the demo does not need — the UI
    runs separately. `jac start` no longer exists.

    Pass `log_path` to capture the server's stdout, which is the ONLY way to see
    the walkers' `[TRACE]` lines: `jac test` captures stdout internally, so trace
    output is invisible under the test runner and visible here.
    """
    env = dict(os.environ)
    if trace:
        env["PORJE_TRACE"] = "1"
    if extra_env:
        env.update({key: str(value) for key, value in extra_env.items()})

    if log_path:
        handle = open(log_path, "w", encoding="utf-8")
    else:
        handle = subprocess.DEVNULL

    return subprocess.Popen(
        [JAC_BIN, "run", ENTRY_POINT, "--no-client"],
        cwd=PROJECT_ROOT,
        stdout=handle,
        stderr=subprocess.STDOUT,
        env=env,
        text=True,
    )


def wait_for_healthz(timeout: int = HEALTH_TIMEOUT_SECONDS) -> bool:
    """Poll /healthz until it answers 200 or the timeout expires."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = requests.get(f"{JAC_URL}/healthz", timeout=2)
            if resp.status_code == 200:
                return True
        except requests.RequestException:
            pass
        time.sleep(HEALTH_POLL_SECONDS)
    return False


def stop_server(proc: subprocess.Popen | None = None) -> None:
    """Stop the server this module started, and anything else listening."""
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    kill_server()


def post_walker(walker: str, body: dict | None = None, node_id: str = "") -> dict:
    """
    POST a walker and return the parsed envelope.

    `Asset`-entry walkers only run at `/walker/{Name}/{node_id}` — they are
    declared `with Asset entry`, so without the node path the ability never fires
    and the response carries an empty `reports` list, which looks like success.
    """
    url = f"{JAC_URL}/walker/{walker}" + (f"/{node_id}" if node_id else "")
    resp = requests.post(url, json=body or {}, timeout=60)
    try:
        return resp.json()
    except ValueError:
        raise RuntimeError(f"POST {url} returned non-JSON ({resp.status_code}): {resp.text[:400]}")


def reports_of(envelope: dict) -> list:
    """The reports list from a walker envelope, or [] if the call failed."""
    return ((envelope or {}).get("data") or {}).get("reports") or []


def require_ok(envelope: dict, what: str) -> list:
    """Return the reports, or raise with the server's own error message."""
    if envelope.get("ok") is False:
        raise RuntimeError(f"{what} failed: {envelope.get('error')}")
    return reports_of(envelope)


def seed_asset(asset_id: str = "asset-1", name: str = "PoR pUSD", symbol: str = "pUSD") -> str:
    """Seed (idempotently) and return the asset's graph node id."""
    envelope = post_walker("SeedAsset", {
        "id": asset_id,
        "name": name,
        "symbol": symbol,
        "chain": "sepolia",
        "token_address": os.environ.get("POR_TOKEN_ADDRESS", ""),
        "created_at": 0,
    })
    reports = require_ok(envelope, "SeedAsset")
    if not reports:
        raise RuntimeError("SeedAsset returned no report; cannot resolve node_id")
    return reports[0]["node_id"]


def get_asset(node_id: str) -> dict:
    """The GetAsset payload dict for a node id."""
    reports = require_ok(post_walker("GetAsset", {}, node_id), "GetAsset")
    if not reports:
        raise RuntimeError("GetAsset returned no report")
    return reports[0]


def edges_of_type(payload: dict, edge_type: str) -> list:
    return [e for e in payload.get("edges", []) if e.get("type") == edge_type]


def main() -> int:
    """`python scripts/_runtime.py` — print the facts this module derives."""
    print(f"project root : {PROJECT_ROOT}")
    print(f"jac binary   : {JAC_BIN}")
    print(f"jac url      : {JAC_URL}")
    try:
        print(f"database     : {project_database()}")
    except RuntimeError as exc:
        print(f"database     : none ({exc})")
    print(f"healthz      : {'200' if wait_for_healthz(3) else 'not answering'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
