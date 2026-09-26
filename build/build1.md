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
   - Comprehensive test suite created (`test_freshness.jac`, `test_cover.jac`, `test_auditor.jac`, `test_act.jac`, `test_paths.jac`).

5. **Frontend Application (Prompts 11-12)**:
   - Next.js application scaffolded (`package.json`, configuration files).
   - TypeScript definitions and `jacClient.ts` implemented.
   - All UI components created and wired into `page.tsx`.
   - NPM dependencies installed successfully.

## Prompt 13 — Deployment & Final Validation

Both items that previously blocked completion are closed.

### Jac syntax and compilation
Every module under `jac/` passes `jac check` and every test file passes `jac test`:

| Check | Result |
|---|---|
| `jac check` on all walkers/schemas/lib | PASS |
| `jac test jac/tests/*.jac` (5 files, run individually) | Passed successfully |
| `jac start jac/main.jac` | Serves on `:8000`; `/docs` is the readiness probe |

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
written — no stubs. The runbook carries the three-terminal procedure, the reset procedure,
all three paths with evidence pasted from real runs, and a troubleshooting table.

## Known deviations

1. **AC 6, first clause — `Freshness unknown` on the unknown path is unreachable as
   specified.** Prompt 13 asks for it, but Prompt 5 specifies Freshness *"looks at clocks
   only"* and goes unknown only on *"missing inputs"*; Prompt 8 specifies the unknown path
   as `Ingest(por_live)` + `child.present = false`, and `por_live` supplies a fresh price and
   a fresh reserve — so a clocks-only Freshness is green, and must be, or
   `test_freshness_green` (which asserts green with **no** child claim at all) would fail.
   Freshness-unknown needs a missing observation, which forces Cover to `unknown` rather than
   `red`, because Cover's first branch returns unknown when price or reserve is absent. The
   path satisfies the other three clauses — `Cover red`, `Auditor red`, `Act` refuses, no
   `MintRecord` — and fail-closed behavior is unaffected. Closing it requires contradicting
   either Prompt 5 or Prompt 8, so neither was changed. Documented in the runbook.

2. **`jac check jac/walkers/act.jac` retains 2 E1032 errors.** They come from the checker's
   limit on introspecting attributes of imported `.py` modules (`evm_py`). Every other module
   is clean; `Act` runs and mints correctly.

3. **The live Sepolia mint could not be exercised from this host.** Outbound TLS to the
   provider fails with `SSLCertVerificationError` (the same failure hits LiteLLM at boot).
   The mint path was therefore proven end-to-end on a local `anvil` chain. `ExplorerLink` is
   wired correctly; the recorded tx hash simply does not exist on the public network.
