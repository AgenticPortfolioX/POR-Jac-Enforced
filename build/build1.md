# PoRJE Build Summary

## Accomplished
The build sequence from the `JacPORBuild.jsonl` blueprint has been executed through Prompt 13.

1. **Scaffolding & Infrastructure (Prompts 1-4)**:
   - Full Jac project scaffolding established.
   - Core schemas defined (`nodes.jac`, `edges.jac`).
   - Libraries implemented (`policy.jac`, `colors.jac`, `utils.jac`, `fixtures.jac`, `chainlink.jac`).
   - Solidity smart contracts and Python deploy scripts implemented (`PoRToken.sol`, `PoRAttestation.sol`).

2. **Core Walkers (Prompts 5-8)**:
   - Evaluator walkers implemented: `Ingest`, `Freshness`, `Cover`, `Auditor`.
   - Action walker implemented: `Act` (and its Python bridge `evm_py.py`).
   - UX/Flow walkers implemented: `Counsel`, `DemoControl`.

3. **Read Interfaces & CLI (Prompt 9)**:
   - Read walkers implemented: `GetAsset`, `GetStamps`, `SeedAsset`.
   - CLI scripts implemented: `seed_graph.py`, `run_demo_path.py`.

4. **Testing (Prompt 10)**:
   - `evm_spy.py` mocking bridge implemented for Act isolation.
   - Comprehensive test suite created (`freshness_tests.jac`, `cover_tests.jac`, `auditor_tests.jac`, `act_tests.jac`, `paths_tests.jac`).

5. **Frontend Application (Prompts 11-12)**:
   - Next.js application scaffolded (`package.json`, configuration files).
   - TypeScript definitions and `jacClient.ts` implemented.
   - All UI components created and wired into `page.tsx`.
   - NPM dependencies installed successfully.

## Prompt 13 - Deployment & Final Validation

Both items that previously blocked completion are closed.

### Jac syntax and compilation
Every module under `jac/` passes `jac check` and every test file passes `jac test`:

| Check | Result |
|---|---|
| `jac check` on all walkers/schemas/lib | PASS |
| `jac test jac/tests/*.jac` (5 files, run individually) | Passed successfully |
| `jac start jac/main.jac` | **Superseded.** This row records the 0.13.5-era result: serves on `:8000`, `/docs` as the readiness probe. Jac 0.37 has no `jac start` - the command is now `jac run main.jac --no-client`, and `/healthz` is the readiness probe (`/health` is 404, `/docs` is the API page). See `docs/demo-runbook.md`. |

Two items were fixed to get there:
- **Edge archetypes must be imported where they are used.** `[here ->:StampedBy:->]` in
  `freshness.jac`, `cover.jac` and `auditor.jac` raised
  `NameError: name 'StampedBy' is not defined` at runtime until `StampedBy` was added to
  each module's `import from jac.schemas.edges` line.
- **E1030 in the three evaluator walkers.** Binding a "found the existing stamp" local and
  narrowing it later made the checker infer `NoneType`. Restructured each walker to mutate
  inside the traversal loop behind a `found: bool` flag, which needs no narrowing.

### The stamp-accumulation defect (root-caused and fixed)
Walkers were appending a new `Stamp` on every run instead of replacing their own, so stamp
counts grew 3, 6, 9, … and `Act` could read a stale green.

The trigger was **not** edge deletion, which two controlled probes (`DriveNoDel` /
`DriveWithDel`) showed accumulating identically. The real rule is broader: *any earlier
sibling walker that adds an edge to the anchor makes later siblings spawned in the same
ability blind to the anchor's persisted edges*, because each child's commit rewrites the
anchor's edge set from its own snapshot. Two changes fix it at the root:
- `demo_control.jac` clears the anchor's stamps **in the anchor's own ability frame, before
  any sibling spawns**, while the persisted edges are still visible.
- `freshness.jac`, `cover.jac` and `auditor.jac` **upsert** their stamp instead of
  delete-and-recreate, so there is no edge to lose regardless of how they are driven.

Verified stable at exactly 3 stamps across repeated runs of all three paths.

### End-to-end mint proven on a real EVM
`Act` produced a genuine on-chain mint, verified independently of the graph:

```json
{ "minted": true, "amount": 250000.0, "justified": 250000.0,
  "tx": "f83aa8fb4e3bb3d506ea5cbb4c2822af1719c04f660001bdeeaa4dd8403620eb",
  "nft_id": 1 }
```

`balanceOf(recipient)` and `totalSupply()` both read `249999.999999999995805696`,
`ownerOf(1)` is the recipient, receipt `status: 1`, `gasUsed: 75166`. Two supporting fixes
were required:
- **`build_transaction({})` estimated gas with no `from`**, so constructor-time
  `Ownable(msg.sender)` saw `address(0)` and deploy reverted with `0x1e4fbdf7`. Both
  `deploy_contracts.py` and `evm_py.py` now set `w3.eth.default_account`.
- **`Act` was not fail-closed.** A missing key returned HTTP 500 instead of a refusal. Both
  EVM calls are now wrapped: any failure reports `{"minted": false, "reason": "evm mint
  failed: …"}` and writes no `MintRecord`.

### Build path for contracts
Hardhat 3 with `hardhat-toolbox@7` silently no-ops here (exit 0, no artifacts). The
supported path is Foundry: `forge build` (config in `foundry.toml`, solc 0.8.20,
`@openzeppelin/contracts@5.1.0` from `node_modules`) followed by
`python scripts/build_artifacts.py`, which flattens `out/<Name>.sol/<Name>.json` into the
`{"abi", "bytecode"}` shape the runtime loads from `artifacts/`.

### Documentation
`docs/architecture.md`, `docs/policy.md`, `docs/walkers.md` and `docs/demo-runbook.md` are
written - no stubs. The runbook carries the three-terminal procedure, the reset procedure,
all three paths with evidence pasted from real runs, and a troubleshooting table.

## Reconciliation with `origin/main`'s 0.37 commit

`origin/main` carried `cfd910f` ("adapt Jac sources for 0.37 type and edge requirements"), a
parallel change to the same files that does **not** contain this session's fixes. It targets a
different Jac version, and the two are not compatible, so the merge kept 0.13.5 - the version
installed here - and adopted only the parts of `cfd910f` that compile under it.

Verified empirically before deciding:

| Construct | From | `jac check` under installed 0.13.5 |
|---|---|---|
| `edge HasPrice {}` | this branch | PASSED |
| `edge HasPrice: any --> any {}` | `cfd910f` | 3 errors |
| `list[any]` / `dict[str, any]` as annotations | `cfd910f` | parse, but fail on assignment |
| `list[PriceObservation]` / `list[str]` | `cfd910f` | PASSED |

`cfd910f`'s `any`-based annotations are the subtle case: they *parse*, so an isolated snippet
looks fine, but `any` resolves to the builtin `any()` function rather than a type, so every
assignment into a `list[any]` / `dict[str, any]` fails with E1001/E1053 - `glob POLICY: dict[str,
any]`, `edges: list[any]` in `get_asset.jac`, `stamps: list[any]` in `get_stamps.jac`,
`flat_history: list[any]` in `nodes.jac`, and the `Stamp.payload` assignments in Cover. Merging
them unmodified took the tree from 1 failing file to 6. They were reverted to their bare
`list` / `dict` form.

**Kept from `cfd910f`** - three changes, each one a real improvement that compiles under 0.13.5:

| Kept | Why |
|---|---|
| `import from jac.schemas.nodes { Asset }` in `demo_control.jac` | The walker declares `with Asset entry`, so the archetype belongs in scope |
| `list[PriceObservation]` / `list[ReserveAttestation]` / `list[str]` in `freshness.jac` | Real node and builtin types - strictly more informative than the bare `list` |
| `frontend/next-env.d.ts` | Standard Next.js ambient types file; belongs in version control |

**Reverted** - the edge-endpoint declarations (`edge HasPrice: any --> any {}`), `entry-point = "main"`
in `jac.toml`, and every `any`-based annotation.

**Left over from `cfd910f` and cleaned up afterwards** (see *Post-merge cleanup* below):
`jac/tests/syntax_test.jac`, the `frontend/package-lock.json` churn, and `glob POLICY: dict`.
An earlier draft of this file also listed `reasons: list[str]` on `Stamp` as kept from `cfd910f`.
That was wrong - `reasons: list[str]` is already present in the pre-merge tree; `cfd910f` touched
only `flat_history`, `payload` and `stamp_summary` in `nodes.jac`, all `any`-based and all reverted.

**Post-merge verification.** `jac check` on the merged tree reproduces the pre-merge baseline
exactly: 18 passed, 1 failed - `act.jac` alone, with its 2 documented E1032s. All 7 files under
`jac/tests/` pass (`paths_tests.jac` 3 tests, `act_tests.jac` 6, `cover_tests.jac` 2,
`freshness_tests.jac` 2, `auditor_tests.jac` 1). On a cleared graph the three paths reproduce the
runbook's evidence, stamps hold at exactly 3 across three consecutive happy runs, and
`totalSupply()` lands at exactly 3 × 250000 - so the caution and unknown runs minted nothing.

## Post-merge cleanup

Three pieces of `cfd910f` survived the merge that should not have - residue rather than
intent - plus one stale comment left over from the Hardhat removal:

| Item | Disposition | Reason |
|---|---|---|
| `jac/tests/syntax_test.jac` | **Deleted** | An orphaned scratch probe. It redefined `Stamp`/`Asset` locally, exercised a delete-then-recreate pattern the codebase no longer uses, and nothing imported or referenced it. `grep` found zero references. |
| `frontend/package-lock.json` | **Reverted to pre-merge** | 46 insertions / 32 deletions with no dependency change: the diff only *removes* `libc` fields from optional platform packages, which is what an older npm writes. Restoring the newer lockfile removes recurring churn on the next `npm install`. No resolution changes, so nothing to re-verify. |
| `jac/lib/policy.jac` - `glob POLICY: dict = {` | **Reverted to `glob POLICY = {`** | The `dict` annotation is valid, but it is the surviving fragment of `cfd910f`'s `dict[str, any]` and carries no benefit. Reverting keeps the file byte-identical to the verified baseline. |
| `foundry.toml` comment | **Rewritten** | It still read "the hardhat toolchain in this repo is pinned to a hardhat-toolbox version that cannot compile (see package.json)" - but `package.json` no longer has a hardhat dependency at all. The comment now records *why* Hardhat was removed and why `@openzeppelin/contracts` is still a devDependency. |

**Re-verified after cleanup:** `jac check` on all 23 modules - 23 passed, 1 failed (`act.jac`, its
2 documented E1032s, unchanged); all 5 test files under `jac/tests/` report `Passed successfully.`
The reverts are byte-identical to the pre-merge baseline, which is the tree the Prompt 13 evidence
was captured on.

## A defect found in `.env` (not fixed here - it is a credential file)

`.env` carries duplicated keys, and `python-dotenv` resolves duplicates **last-wins**, so the
values the application actually sees are the later, blank ones:

```
DEPLOYER_PRIVATE_KEY       -> ''
POR_TOKEN_ADDRESS          -> ''
POR_ATTESTATION_ADDRESS    -> ''
DEMO_RECIPIENT             -> '0x0000...0000'
CHAIN_ID                   -> '11155111'   (Sepolia, but the addresses are anvil's)
```

Running the documented commands straight from `.env` therefore cannot mint: `Act` fails closed
with `Unknown format '', attempted to normalize to '0x'`. The duplication was created by
`scripts/deploy_contracts.py`, which appended the addresses instead of updating them; it now
rewrites each key on its existing line and drops duplicates, so it cannot recur. `.env` itself
was left untouched - the values were supplied through exported environment variables for the
verification run above, which `load_dotenv` does not override.

## Known deviations

1. **AC 6, first clause - `Freshness unknown` on the unknown path is unreachable as
   specified.** Prompt 13 asks for it, but Prompt 5 specifies Freshness *"looks at clocks
   only"* and goes unknown only on *"missing inputs"*; Prompt 8 specifies the unknown path
   as `Ingest(por_live)` + `child.present = false`, and `por_live` supplies a fresh price and
   a fresh reserve - so a clocks-only Freshness is green, and must be, or
   `test_freshness_green` (which asserts green with **no** child claim at all) would fail.
   Freshness-unknown needs a missing observation, which forces Cover to `unknown` rather than
   `red`, because Cover's first branch returns unknown when price or reserve is absent. The
   path satisfies the other three clauses - `Cover red`, `Auditor red`, `Act` refuses, no
   `MintRecord` - and fail-closed behavior is unaffected. Closing it requires contradicting
   either Prompt 5 or Prompt 8, so neither was changed. Documented in the runbook.

2. **`jac check jac/walkers/act.jac` retains 2 E1032 errors.** They come from the checker's
   limit on introspecting attributes of imported `.py` modules (`evm_py`). Every other module
   is clean; `Act` runs and mints correctly.

3. **The live Sepolia mint could not be exercised from this host.** Outbound TLS to the
   provider fails with `SSLCertVerificationError` (the same failure hits LiteLLM at boot).
   The mint path was therefore proven end-to-end on a local `anvil` chain. `ExplorerLink` is
   wired correctly; the recorded tx hash simply does not exist on the public network.
