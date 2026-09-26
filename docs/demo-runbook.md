# Demo Runbook — Proof of Reserve, Jac Enforced

Operator checklist for the three-path demonstration: pre-flight, happy, yellow, unknown, reset, troubleshooting. Every command below is exact, and every response pasted under **Evidence** is copied from a real run.

Three terminals are used throughout:

| Terminal | Command | Serves |
|---|---|---|
| 1 | `jac start jac/main.jac` | Jac Cloud on `http://localhost:8000` |
| 2 | `cd frontend && npm run dev` | Next.js UI on `http://localhost:3000` |
| 3 | scripts | `seed_graph.py`, `run_demo_path.py` |

## Pre-flight

Run this ten minutes before the demo.

1. **Contracts compiled.** `forge build` then `python scripts/build_artifacts.py`. The runtime reads `artifacts/PoRToken.json` and `artifacts/PoRAttestation.json`, which the flatten step writes from forge's `out/`.
2. **`.env` complete.** `POR_TOKEN_ADDRESS`, `POR_ATTESTATION_ADDRESS`, `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `CHAIN_ID`, `DEMO_RECIPIENT`. `SEPOLIA_RPC_URL` must be the provider root (for example `https://eth-sepolia.g.alchemy.com/v2/<key>`) — `evm_py` passes it straight to `Web3.HTTPProvider`, so a bare host without a scheme will not connect.
   - **Each key must appear exactly once.** `python-dotenv` resolves duplicate keys *last-wins*, so a second, blank `POR_TOKEN_ADDRESS=` further down the file silently replaces a real one with `''`. Check with `grep -c '^POR_TOKEN_ADDRESS=' .env` — it must print `1`. `deploy_contracts.py` used to append and is what creates these duplicates; it now rewrites each key on its existing line instead. If `.env` already carries duplicates, remove the extra lines before the demo.
3. **`actWalker` set.** `python scripts/deploy_contracts.py` deploys both contracts and calls `setActWalker(deployer)`. `PoRToken.mint` is guarded by `onlyAct`, so until this call succeeds every mint reverts.
4. **`DEMO_RECIPIENT` is a real address.** `0x000…000` is the shipped default and it does **not** work: OZ v5's `ERC20._mint` rejects the zero address, and `Act` will report `evm mint failed: 0xec442f05…` (`ERC20InvalidReceiver`). Set it to the deployer or any funded address.
5. **Server is up.** Probe `http://localhost:8000/docs`. **`/health` returns 404** in Jac 0.13.5 — the docs page is the only readiness probe that answers. `demo.md`'s checklist still names `/health`; that line is preserved verbatim from Prompt 1 and is superseded by this note.
6. **No fixture is mislabeled.** Every file in `fixtures/` must carry `"label": "fixture"` — a missing label is a boot error by design (Invariant 5).
7. **Graph is clean** (optional). See **Reset** below.

## Reset

`DemoControl` clears the asset's stamps at the start of every run, so the three paths never accumulate stamp state. A full reset is only needed to drop the asset, its observations, and any `MintRecord`:

```bash
# Stop the Jac server first — the store is a live SQLite database.
rm -rf .jac/data jac/.jac/data .jac/cache
jac start jac/main.jac
python scripts/seed_graph.py
```

State lives in `.jac/data/anchor_store.db` (plus `-wal`/`-shm`). **Restarting the server does not reset the graph** — the store outlives the process, so deleting those files is the only reset.

## Path 1 — Happy (all green)

```bash
python scripts/seed_graph.py
python scripts/run_demo_path.py happy
```

**In the UI.** Select **✅ Happy Path**. Freshness, Cover and Auditor each render a green `StampBadge`; the `MintButton` reads `Mint (justified: 250000.00)` and is enabled; `CounselPanel` replaces `Counsel is blind until three stamps exist.` with the narration; `ExplorerLink` appears after the mint.

**Evidence.**

```json
// Act — DemoControl happy, requested 1,000,000, justified 250,000
{ "minted": true, "amount": 250000.0, "justified": 250000.0,
  "tx": "f83aa8fb4e3bb3d506ea5cbb4c2822af1719c04f660001bdeeaa4dd8403620eb",
  "nft_id": 1 }
```

```json
// GetAsset — three StampedBy entries and the MintRecord
stamps: [["Freshness","green"], ["Cover","green"], ["Auditor","green"]]
overall_status: "minted"
MintRecord: { "tx_hash": "f83aa8fb…620eb", "minted_amount": 250000.0,
              "coverage_used": 250000.0, "nft_token_id": 1,
              "stamp_summary": {"Freshness":"green","Cover":"green","Auditor":"green"} }
```

Verified independently of the graph — `balanceOf(recipient)` and `totalSupply()` both `249999.999999999995805696` (the 18-decimal rounding of 250000), `ownerOf(1)` is the recipient, receipt `status: 1`, `gasUsed: 75166`. `amount == min(requested, justified) == min(1000000, 250000)` is Invariant 6.

`Cover`'s payload carries the number the button is quoting:

```json
{ "walker": "Cover", "color": "green",
  "reasons": ["child attestation: present", "coverage ratio 1.25 >= min 1.0", "justified amount: 250000.0"],
  "justified_amount": 250000.0, "coverage_ratio": 1.25 }
```

**Etherscan.** On Sepolia the tx and NFT links resolve at `https://sepolia.etherscan.io/tx/<tx>` and `https://sepolia.etherscan.io/token/<POR_ATTESTATION_ADDRESS>?a=<nft_id>`. The evidence above was captured against a local `anvil` chain (id 31337) because this machine cannot complete a TLS handshake with the Sepolia provider — see **Troubleshooting**. `ExplorerLink` is wired and correct; the hash simply does not exist on the public network.

**Re-verified on the merged tree.** The evidence above predates the merge of `origin/main`. After merging, all three paths were re-run against a cleared graph and reproduce exactly — the happy path three times in a row:

```json
// three consecutive happy runs on the merged tree
run 1: { "minted": true, "amount": 250000.0, "justified": 250000.0, "nft_id": 1 }
run 2: { "minted": true, "amount": 250000.0, "justified": 250000.0, "nft_id": 2 }
run 3: { "minted": true, "amount": 250000.0, "justified": 250000.0, "nft_id": 3 }

stamps after all three runs: 3  ->  [Freshness green, Cover green, Auditor green]
```

Exactly **3** stamps survive three runs — the accumulation defect does not return. `MintedAs` edges number exactly 3 (one per happy run), and on-chain `totalSupply()` is `749999999999999987417088`, i.e. exactly 3 × 250000 with 18-decimal rounding, so the yellow and unknown runs added no mint:

## Path 2 — Yellow (stale or stuck reserve)

```bash
python scripts/run_demo_path.py yellow
```

**In the UI.** Select **⚠️ Yellow Path**. Cover and Auditor render yellow (`Flat reserve`), Freshness stays green. `MintButton` is disabled and reads its justified amount from Cover's payload.

**Evidence.**

```json
stamps: [["Freshness","green"], ["Cover","yellow"], ["Auditor","yellow"]]
Act:    { "minted": false, "reason": "Cover stamp is yellow" }
MintRecords before=1 after=1  ->  no new mint
```

`Act` returns `{"minted": false, …}` — never a 500, never a `MintRecord` — which is Prompt 7's AC 1 verbatim.

## Path 3 — Unknown / red (missing PoR or missing child)

```bash
python scripts/run_demo_path.py unknown
```

**In the UI.** Select **❌ Unknown Path**. Cover and Auditor render red (`Missing child`); `MintButton` stays disabled.

**Evidence.**

```json
stamps: [["Freshness","green"], ["Cover","red"], ["Auditor","red"]]
Act:    { "minted": false, "reason": "Cover stamp is red" }
MintRecords before=1 after=1  ->  no new mint
```

> **Known deviation — AC 6's first clause.** Prompt 13 asks for `Freshness unknown` on this path, but Prompt 5 specifies Freshness *"looks at clocks only"* and goes unknown only on *"missing inputs"*, and Prompt 8 specifies this path as `Ingest(por_live)` followed by `child.present = false`. `por_live` supplies a fresh price and a fresh reserve, so a clocks-only Freshness is **green** — and must be, or `test_freshness_green` (which asserts green with no child claim at all) would fail. The required triple is unreachable as specified: Freshness-unknown needs a missing observation, which forces Cover to `unknown` rather than `red`, because Cover's first branch returns unknown when price or reserve is absent. The path can satisfy `Cover red`, `Auditor red`, `Act refuses`, and `no MintRecord` — three of four clauses plus both consequences. Closing the last clause requires either relaxing "clocks only" in Freshness or changing the unknown-path fixture; both contradict a different mandated prompt, so neither was done. The system's fail-closed behavior is unaffected: the mint is refused, and that is what the invariants protect.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Act` reports `evm mint failed: Unknown format '', attempted to normalize to '0x'` | An address key in `.env` resolves to `''` — almost always a duplicated key whose later, blank copy won | `grep -c '^POR_TOKEN_ADDRESS=' .env` must print `1`; delete the duplicate lines. `deploy_contracts.py` no longer appends, so it will not recreate them |
| `Act` reports `evm mint failed: The private key must be exactly 32 bytes long` | `DEPLOYER_PRIVATE_KEY` empty or not 32 bytes | Set it in `.env`; restart the server so `evm_py`'s `load_dotenv` re-reads it |
| `Act` reports `evm mint failed: 0xec442f05…` | `DEMO_RECIPIENT` is `0x000…000` | Use a real address — ERC20 cannot mint to zero |
| `Act` reports `evm mint failed: 0x1e4fbdf7…` at deploy time | `build_transaction({})` estimated gas with no `from`, so `Ownable(msg.sender)` saw `address(0)` | Already fixed: `deploy_contracts.py` and `evm_py` set `w3.eth.default_account` before building |
| `SSLCertVerificationError` reaching the provider | This host cannot validate the provider's certificate chain (the same failure hits LiteLLM at boot) | Run the demo against a local chain: `anvil`, then export `SEPOLIA_RPC_URL=http://127.0.0.1:8545`, `CHAIN_ID=31337`, and the deployed addresses. `load_dotenv` does not override pre-set variables, so exported values win and `.env` is left untouched |
| `jac test jac/tests/` → `Error: Not a .jac file.` | Jac 0.13.5 does not accept a directory | Run each file: `for f in jac/tests/*.jac; do jac test "$f"; done` |
| `jac check` prints a `charmap` encoding error | Windows console codepage cannot render the checkmark glyphs | `PYTHONIOENCODING=utf-8 jac check <file>` |
| Stamps accumulate (3, 6, 9) | A sibling walker that adds an edge to the anchor makes later siblings blind to its persisted `StampedBy` edges | Already fixed: `DemoControl` clears stamps in the anchor's own frame before spawning, and Freshness/Cover/Auditor upsert instead of delete-and-recreate |
| UI shows nothing / `GetAsset returned no asset report` | Walkers declared `with Asset entry` only run when spawned **on** the asset | Pass the node id: `POST /walker/{Name}/{node_id}`. `SeedAsset` is the only `Root`-entry walker, so it is the only source of a node id |
| Server 500 `NameError: name 'StampedBy' is not defined` | Edge archetype used with `[here ->:X:->]` but not imported into that module | Import it: `import from jac.schemas.edges { StampedBy }` |

## Post-demo pointers

`docs/architecture.md` explains why the mint is a permit with a quantity and documents the `evm_spy` mechanism. `docs/policy.md` lists every `POLICY` knob and what changes when you turn it. `docs/walkers.md` gives one section per walker: Purpose, Inputs, Writes, Forbidden, Report Shape.
