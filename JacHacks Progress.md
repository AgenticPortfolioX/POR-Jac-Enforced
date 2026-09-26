# JacHacks Progress Log: Proof of Reserve — Jac Enforced (PoRJE)

**Repository:** [AgenticPortfolioX/POR-Jac-Enforced](https://github.com/AgenticPortfolioX/POR-Jac-Enforced.git)  
**Project:** Proof of Reserve — Jac Enforced (PoRJE)  
**Target Architecture:** Jac Graph, Autonomous Walkers, Chainlink AggregatorV3 Oracles, EVM Smart Contracts (PoRToken & PoRAttestation), Next.js Dashboard.

---

## 📌 Milestones & Accomplished Steps

### 1. Complete Project Scaffolding
- Created the full 69-file directory structure across all layers:
  - **Root**: `README.md`, `demo.md`, `LICENSE` (MIT, 2025 PoRJE Contributors), `.gitignore`, `jac.toml`, `requirements.txt`, `package.json`.
  - **Docs**: `docs/architecture.md`, `docs/policy.md`, `docs/walkers.md`, `docs/demo-runbook.md`.
  - **Jac Core**:
    - `jac/main.jac`: Main entrypoint with schema and walker imports.
    - `jac/schemas/`: Graph node schemas (`nodes.jac`) and edge definitions (`edges.jac`).
    - `jac/walkers/`: 7 autonomous verifier walkers (`ingest.jac`, `freshness.jac`, `cover.jac`, `auditor.jac`, `act.jac`, `counsel.jac`, `demo_control.jac`).
    - `jac/lib/`: Policy dictionary (`policy.jac`), color ranking (`colors.jac`), Chainlink Python bridge (`chainlink.jac`, `chainlink_py.py`), EVM web3 stubs (`evm_py.py`), fixture loader (`fixtures.jac`), and utilities (`utils.jac`).
    - `jac/tests/`: 5 test suites (`test_freshness.jac`, `test_cover.jac`, `test_auditor.jac`, `test_act.jac`, `test_paths.jac`).
  - **Contracts**: `contracts/PoRToken.sol`, `contracts/PoRAttestation.sol`, and interfaces (`AggregatorV3Interface.sol`, `IPoRToken.sol`).
  - **Scripts**: `deploy_contracts.py`, `seed_graph.py`, `run_demo_path.py`.
  - **Frontend**: Next.js 14 shell with TypeScript, Tailwind, 8 dashboard components (`GraphView`, `StampBadge`, `MintButton`, `AuditorPanel`, `CounselPanel`, `PathSelector`, `ExplorerLink`, `PolicyCard`), `jacClient.ts`, `types.ts`, and `constants.ts`.
  - **Fixtures**: 7 simulation JSON datasets (`por_live`, `por_stale`, `por_flat`, `price_live`, `price_stale`, `child_missing`, `child_stale`).

### 2. Comprehensive Security & Credential Isolation
- Configured `.gitignore` to block:
  - All environment configurations (`.env`, `.env*`, `*.env`, `.env.local`, etc.).
  - Cryptographic keys, certificates, seeds, and keystores (`*.pem`, `*.key`, `*.keystore`, `*.pk`, `id_rsa*`, `wallet.json`).
  - Runtime virtual environments and caches (`.jac/`, `.jac_cache/`, `node_modules/`, `.venv/`, `__pycache__/`, `artifacts/`, `cache/`).
- Verified local `.env` exists for development while preventing accidental git tracking.

### 3. Jac Compiler Wiring & Verification
- Enabled the native `jac` CLI (v0.13.5) on Windows with UTF-8 encoding support.
- Confirmed detected subsystems: `byllm==0.6.3`, `jac-client==0.3.11`, `jac-mcp==0.1.10`, `jac-scale==0.2.13`, `jac-super==0.1.9`.
- Verified first program execution: `jac run` successfully prints `Hello from Jac!`.

### 4. `jac.toml` Configuration & Dependency Management
- Structured `jac.toml` with:
  - Project identity: `name = "por-jac-enforced"`, `version = "0.1.0"`, `entry_point = "jac/main.jac"`.
  - Server configuration: `port = 8000`.
  - Core dependencies: `web3`, `eth-account`, `requests`, `python-dotenv`, `pytest`.
  - Client toolchain dependencies: React 18, Vite, TypeScript, React Router.
- Ran `jac install` to build `.jac/venv` and resolve all dependencies.

### 5. Syntax & Grammar Validation Across All Jac Modules
- Validated all modules against the active Jac compiler:
  - `jac check jac/schemas/nodes.jac`: **PASSED [100%]**
  - `jac check jac/schemas/edges.jac`: **PASSED [100%]**
  - `jac check jac/lib/*.jac`: **PASSED [100%]**
  - `jac check jac/walkers/*.jac`: **PASSED [100%]**
  - `jac check jac/tests/*.jac`: **PASSED [100%]**
  - `jac test jac/tests/test_paths.jac`: **PASSED [100%]**
- Verified entrypoint bootstrap: `jac run jac/main.jac` prints `PoRJE scaffold booted`.
- Validated automated REST API discovery: `jac start jac/main.jac` automatically registers endpoints for all 7 walkers and introspection routes.

### 6. GitHub Remote Repository Setup
- Primary Remote: `https://github.com/AgenticPortfolioX/POR-Jac-Enforced.git`.
- Initial commit published and tracking `origin/main`.
- Repository confirmed as the definitive project home under `AgenticPortfolioX/POR-Jac-Enforced`.

### 7. Jachammer.ai Deployment Entrypoint Alignment
- Created root `main.jac` entrypoint linking the Jac schemas and verifier walkers for repository root execution.
- Updated `jac.toml` with explicit hyphenated `entry-point = "main.jac"` (as well as `entry_point = "main.jac"`) to satisfy Jachammer.ai build detection.
- Verified compilation and runtime behavior: `jac check main.jac` and `jac run main.jac` passed 100% with `PoRJE root scaffold booted`.

### 8. Jac 0.13.5 Compilation Closure
- Added the missing edge-archetype imports (`StampedBy`) to `freshness.jac`, `cover.jac` and `auditor.jac`. `[here ->:StampedBy:->]` resolves the archetype at runtime through the module namespace, so an unimported edge type raised `NameError: name 'StampedBy' is not defined` as an HTTP 500.
- Removed the E1030 errors the checker raised in the same three walkers. Binding a local that held "the existing stamp or nothing" made the checker infer `NoneType` on the second read; the walkers now mutate inside the traversal loop behind a `found: bool` flag, which requires no narrowing. Annotating the local as `Stamp | None` instead produced E1099, so the flag form is the one that stays clean.
- Result: `jac check` PASSES on every module under `jac/`, and all 5 test files report `Passed successfully.`

### 9. Stamp-Uniqueness Invariant (root cause found and fixed)
- **Symptom:** each `DemoControl` run appended new `Stamp` nodes instead of replacing the walkers' own, so stamp counts grew 3 → 6 → 9 and `Act` could read a stale green.
- **Root cause:** not edge deletion — two controlled probes (`DriveNoDel` / `DriveWithDel`) accumulated identically, refuting that hypothesis. The governing rule is that **any earlier sibling walker which adds an edge to the anchor makes later siblings spawned in the same ability blind to the anchor's persisted edges**, because each child's commit rewrites the anchor's edge set from its own snapshot.
- **Fix, two parts:** `demo_control.jac` clears the anchor's stamps **in the anchor's own frame, before any sibling spawns**, while the persisted edges are still visible; `freshness.jac`, `cover.jac` and `auditor.jac` **upsert** their stamp rather than delete-and-recreate, so there is no edge left to lose however they are driven.
- **Verified:** exactly 3 stamps (one per walker) stays stable across repeated runs of all three demo paths.

### 10. EVM Path Proven End-to-End, Fail-Closed
- `Act` now wraps both chain calls. A failure reports `{"minted": false, "reason": "evm mint failed: …"}` and writes no `MintRecord`; previously an empty `DEPLOYER_PRIVATE_KEY` surfaced as an HTTP 500, which is not a refusal. Invariant 6 now holds in both directions: no `MintRecord` without a mint, and no mint reported without a receipt.
- Fixed a `build_transaction({})` defect in `evm_py.py` and `deploy_contracts.py`: gas was estimated with no `from`, so constructor-time `Ownable(msg.sender)` saw `address(0)` and deployment reverted with `0x1e4fbdf7` (`OwnableInvalidOwner`). Both now set `w3.eth.default_account` before building.
- Produced a **real on-chain mint**, verified independently of the graph: `{"minted": true, "amount": 250000.0, "justified": 250000.0, "tx": "f83aa8fb…620eb", "nft_id": 1}`, with `balanceOf(recipient) == totalSupply() == 249999.999999999995805696`, `ownerOf(1)` = recipient, receipt `status: 1`, `gasUsed: 75166`.
- Switched the contract build path to **Foundry**: Hardhat 3 with `hardhat-toolbox@7` silently no-ops (exit 0, no artifacts). Added `foundry.toml` (solc 0.8.20, `@openzeppelin/contracts@5.1.0` resolved from `node_modules`) and `scripts/build_artifacts.py`, which flattens `out/<Name>.sol/<Name>.json` into the `{"abi", "bytecode"}` shape the runtime loads. Exposed as `npm run contracts:build`.

### 11. Prompt 13 — Deployment & Final Validation
- Wrote `docs/architecture.md`, `docs/policy.md`, `docs/walkers.md` and `docs/demo-runbook.md` in full — no stubs remain.
- Ran the three-path verification (`happy`, `yellow`, `unknown`) against a live server, capturing the actual walker reports, stamp colors, `Act` refusals and `MintRecord` counts into the runbook as pasted evidence.
- Confirmed the readiness probe: `/docs` returns 200; `/health` returns 404 in Jac 0.13.5, so the runbook supersedes `demo.md`'s older checklist line on that point.
- Recorded remaining deviations honestly in `build/build1.md` and in the runbook: AC 6's `Freshness unknown` clause is unreachable without contradicting Prompt 5 or Prompt 8; `jac check jac/walkers/act.jac` retains 2 E1032 errors from the checker's `.py`-module introspection limit; the live Sepolia mint could not be exercised from this host because outbound TLS to the provider fails with `SSLCertVerificationError`, so the mint was proven on a local `anvil` chain instead.

### 13. Reconciled with `origin/main`'s Jac 0.37 Commit
- `origin/main` had gained `cfd910f` ("adapt Jac sources for 0.37 type and edge requirements"), a parallel change to the same files that did not contain this session's fixes and targeted a different Jac version.
- Measured both targets against the compiler installed here (0.13.5): `edge HasPrice {}` PASSED; `edge HasPrice: any --> any {}` raised 3 errors. The `any`-based annotations were the subtle case — they parse, but `any` resolves to the builtin `any()` function rather than a type, so every assignment into a `list[any]` / `dict[str, any]` failed with E1001/E1053. Merging them unmodified took the tree from 1 failing file to 6.
- Kept 0.13.5 and adopted only what compiles under it: the `Asset` import in `demo_control.jac`, the `list[PriceObservation]` / `list[ReserveAttestation]` / `list[str]` annotations, and `frontend/next-env.d.ts`. Reverted the edge-endpoint declarations, `entry-point = "main"`, and every `any`-based annotation. Nothing of `cfd910f` was discarded from history — it remains an ancestor of the merge.
- **Post-merge verification:** `jac check` reproduces the pre-merge baseline exactly (18 passed, 1 failed — `act.jac` alone with its 2 documented E1032s); all 7 files under `jac/tests/` pass; the three paths reproduce the runbook's evidence with stamps holding at exactly 3 across three consecutive happy runs; `MintedAs` edges number 3 and on-chain `totalSupply()` is exactly 3 × 250000, so the yellow and unknown runs minted nothing.

### 14. `.env` Duplicate-Key Defect Found and Contained
- `.env` carries duplicated keys, and `python-dotenv` resolves duplicates **last-wins**, so the application actually saw `DEPLOYER_PRIVATE_KEY=''`, `POR_TOKEN_ADDRESS=''`, `POR_ATTESTATION_ADDRESS=''`, and the zero `DEMO_RECIPIENT`. Running the documented commands straight from `.env` could not mint at all — `Act` failed closed with `Unknown format '', attempted to normalize to '0x'`.
- Root cause: `scripts/deploy_contracts.py` **appended** the two address keys on every run. It now rewrites each key on its existing line and drops duplicates, so it cannot recur.
- `.env` itself was left untouched — it is a credential file. Verification runs supplied values through exported environment variables, which `load_dotenv` does not override. The hazard and its check (`grep -c '^POR_TOKEN_ADDRESS=' .env` must print `1`) are documented in the runbook.

### 15. Post-Merge Cleanup of `cfd910f` Residue
- Audited all 14 files `cfd910f` touched and separated *intent* (three changes worth keeping) from *residue* (four items that survived the merge without justification).
- **Deleted `jac/tests/syntax_test.jac`** — an orphaned scratch probe that redefined `Stamp`/`Asset` locally and exercised a delete-then-recreate pattern this codebase no longer uses. `grep` across `.jac`, `.py`, `.ts`, `.tsx`, `.md` and `.toml` found zero references.
- **Reverted `frontend/package-lock.json`** to its pre-merge state. Its 46/32-line diff contained no dependency change — it only removed `libc` fields from optional platform packages, which is what an older npm writes. Restoring the newer lockfile stops the churn from recurring on the next `npm install`.
- **Reverted `glob POLICY: dict = {`** to `glob POLICY = {` in `jac/lib/policy.jac` — the last surviving fragment of the `dict[str, any]` family, valid but pointless.
- **Rewrote the stale comment in `foundry.toml`**, which still pointed at a hardhat dependency that `package.json` no longer contains.
- Corrected two claims in the build record that overstated `cfd910f`'s contribution: `reasons: list[str]` on `Stamp` was already present pre-merge, and the frontend lockfile was not worth keeping.
- **Re-verified:** `jac check` — 23 passed, 1 failed (`act.jac`, its 2 documented E1032s, unchanged); all 5 test files under `jac/tests/` report `Passed successfully.`

### 12. Credential Isolation Re-Verified Before Push
- `.env` remains untracked and matched by `.gitignore:11:*.env`; `.env.example` was deleted from disk per project policy that all credentials live in `.env`. `git grep "env.example"` returns nothing, so no dangling reference remains.
- Scanned the **entire git history** for the live deployer private key and the RPC provider key: **0 occurrences** of either.
- Confirmed all build outputs are ignored and never enter a commit: `artifacts/`, `out/`, `.jac/`, `node_modules/`, `frontend/.next/`.
- Removed a stray `hardhat.config.js` that `npx hardhat` had generated (the repo's build path is Foundry), and dropped the unusable Hardhat 3 devDependencies plus the `"type": "module"` field it had injected into the root `package.json`. `@openzeppelin/contracts@5.1.0` is kept — `foundry.toml` resolves its remapping out of `node_modules`.
