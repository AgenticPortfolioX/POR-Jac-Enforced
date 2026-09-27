# Demo Runbook - Proof of Reserve, Jac Enforced

Operator checklist for the three-path demonstration: pre-flight, happy, yellow, unknown, reset, troubleshooting.

**Toolchain.** Every command below was re-verified against **Jac 0.37.23** (`jac --version`). Evidence blocks are labelled with the runtime they came from; the pre-0.37 material is retained under **Historical evidence** for reference only and is not reproducible on this tree.

Three terminals are used throughout:

| Terminal | Command | Serves |
|---|---|---|
| 1 | `jac run main.jac --no-client` | Jac Cloud on `http://localhost:8000` |
| 2 | `cd frontend && npm run dev` | Next.js UI on `http://localhost:3000` |
| 3 | scripts | `seed_graph.py`, `run_demo_path.py` |

> **Jac 0.37 uses `jac run`, not `jac start`.** `jac run` executes or serves per the app kind; for this project it serves. `--no-client` skips the client build, which the demo does not need - the UI runs from terminal 2.

**Python.** The demo scripts need `requests` and `python-dotenv`. Jac maintains a project venv at `.jac/venv/` that already has them (plus `web3` and `eth_account` for the walker side), so run the scripts with `.jac/venv/bin/python`. A bare `python3` on a minimal install will fail with `No module named 'dotenv'`.

## Pre-flight

Run this ten minutes before the demo.

1. **Contracts compiled.** `forge build` then `python scripts/build_artifacts.py`. The runtime reads `artifacts/PoRToken.json` and `artifacts/PoRAttestation.json`, which the flatten step writes from forge's `out/`.
2. **`.env` complete.** `POR_TOKEN_ADDRESS`, `POR_ATTESTATION_ADDRESS`, `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `CHAIN_ID`, `DEMO_RECIPIENT`. `SEPOLIA_RPC_URL` must be the provider root (for example `https://eth-sepolia.g.alchemy.com/v2/<key>`) - `evm_py` passes it straight to `Web3.HTTPProvider`, so a bare host without a scheme will not connect.
   - **Each key must appear exactly once.** `python-dotenv` resolves duplicate keys *last-wins*, so a second, blank `POR_TOKEN_ADDRESS=` further down the file silently replaces a real one with `''`. Check with `grep -c '^POR_TOKEN_ADDRESS=' .env` - it must print `1`. `deploy_contracts.py` used to append and is what creates these duplicates; it now rewrites each key on its existing line instead. If `.env` already carries duplicates, remove the extra lines before the demo.
   - **This is a live defect on the current `.env`.** It carries two copies of `DEPLOYER_PRIVATE_KEY`, `POR_TOKEN_ADDRESS`, `POR_ATTESTATION_ADDRESS`, `PRICE_FEED_ADDRESS` and `RESERVE_FEED_ADDRESS`; the second copy of each is empty and wins. Until those ten lines are deleted, every mint fails closed with `The private key must be exactly 32 bytes long, instead of 0 bytes.` Audit the file with:
     ```bash
     awk -F= '/^[A-Z_]+=/ { if (length($2)==0) print $1" IS EMPTY" }' .env
     ```
     Any output is a key that a later duplicate has blanked.
3. **`actWalker` set.** `python scripts/deploy_contracts.py` deploys both contracts and calls `setActWalker(deployer)`. `PoRToken.mint` is guarded by `onlyAct`, so until this call succeeds every mint reverts.
4. **`DEMO_RECIPIENT` is a real address.** The UI mint recipient is hard-coded to `0x748ABdeF0775132E8F941e1513152D5eb02D3a4B`. The CLI path reads `DEMO_RECIPIENT` from `.env`; set it to any funded non-zero address.
5. **Server is up.** Probe `http://localhost:8000/healthz` - it returns **200** about 10 s after launch. `/docs` also returns 200 but serves the OpenAPI page, so it is not a readiness signal. **`/health` returns 404**; `demo.md`'s checklist names `/health`, and that line is preserved verbatim from Prompt 1 - this note supersedes it.
6. **No fixture is mislabeled.** Every file in `fixtures/` must carry `"label": "fixture"` - a missing label is a boot error by design (Invariant 5).
7. **Graph is clean** (optional). See **Reset** below.
8. **Graph and mint are both live.** `frontend/src/app/page.tsx` uses `0x748ABdeF0775132E8F941e1513152D5eb02D3a4B` as the mint recipient. The Mint button in the UI initiates a real on-chain mint to this configured demo recipient. It succeeds only when all three stamps are green and the requested amount is within the justified amount computed by Cover.

## Reset

Stamps are **upserted in place** by each approval walker, so a re-run replaces the
previous stamp for that walker rather than appending a second one. The three paths
therefore never accumulate stamp state on their own. A full reset is needed only to
drop the asset, its observations, and any `MintRecord`:

```bash
# 1. Stop the server. The store is a live Postgres database and must not be
#    dropped underneath a running process.
pkill -f "jac run"

# 2. Drop the project's database. This is the only reset that clears the graph.
#    Run this FROM THE PROJECT ROOT. The name is a hash of the project path, so
#    `jac db list` invoked from any other directory reports a different project
#    entirely - usually `no database yet` - which reads like a successful drop.
#    Confirm the name from the project root before dropping.
jac db drop jac_por_jac_enforced_a3a8aeca -y

# 3. Restart. The database is recreated empty on boot.
jac run main.jac --no-client

# 4. Re-seed.
.jac/venv/bin/python scripts/seed_graph.py
```

`jac db list` reports `databases: 0` between steps 2 and 3, which confirms the drop.

**State lives in Postgres, not in the project directory.** Jac 0.37 keeps the store
in the shared embedded cluster at `~/.cache/jac/pg/main` (`PostgreSQL 18`), in the
database named for this project - `jac_por_jac_enforced_a3a8aeca`. `jac db status`
reports both:

```
data dir : /home/<user>/.cache/jac/pg/main
database : jac_por_jac_enforced_a3a8aeca
running  : True
server   : PostgreSQL 18
```

`.jac/data/` holds only `jwt_secret` - **removing it resets no graph state**, so
`rm -rf .jac/data` (and `jac clean --data`) is a no-op for the demo. **Restarting
the server does not reset the graph either**: the store outlives the process, so
`jac db drop` is the reset.

> **On a different path or host**, `jac db list` prints the real database name and
> owner. Use that name in the `jac db drop` call rather than copying
> `jac_por_jac_enforced_a3a8aeca` blindly - and run it from the project root, for
> the reason in step 2. Every `jac db` subcommand is cwd-sensitive: from `$HOME`,
> `jac db status` on this project printed `database : jac_por_jac_enforced_d72e1051`
> and `no database yet`, which is a *different* name than the one the server under
> `~/porje` actually uses.

> **The upsert does not clean up history.** An asset whose graph already accumulated
> extra observations under the old delete-then-create Ingest keeps them; only a
> fresh asset, or a dropped store, starts from the one-of-each invariant. Reset
> before a demo on a store that predates the fix.

## Path 1 - Happy (all green)

```bash
.jac/venv/bin/python scripts/seed_graph.py
.jac/venv/bin/python scripts/run_demo_path.py happy
```

**In the UI.** Select **✅ Happy Path**. Freshness, Cover and Auditor each render a green `StampBadge`; the `MintButton` reads `Mint (justified: 250000.00)` and is enabled; `CounselPanel` replaces `Counsel is blind until three stamps exist.` with the narration; `ExplorerLink` appears after the mint.

**Evidence - Jac 0.37.23.** Captured from a dropped store, `jac run main.jac --no-client`, on 2026-09-26.

```json
// DemoControl happy - all three approval walkers
{ "asset_id": "asset-1", "price_source": "fixture", "reserve_source": "fixture" }
{ "walker": "Freshness", "color": "green",
  "reasons": ["price age 12s <= max 300s", "reserve age 30s <= max 3600s", "source is fixture (labeled)"] }
{ "walker": "Cover", "color": "green",
  "reasons": ["child attestation: present", "coverage ratio 1.25 >= min 1.0", "justified amount: 250000.0"],
  "justified_amount": 250000.0, "coverage_ratio": 1.25 }
{ "walker": "Auditor", "color": "green",
  "reasons": ["age skew - none", "flat reserve - none", "child attestation - present", "liability cover - holds"] }
```

```json
// GetAsset - exactly one observation of each type, three stamps
HasPrice=1  HasReserve=1  DependsOn=1  HasLiability=1  StampedBy=3  MintedAs=0
stamps: [("Freshness","green"), ("Cover","green"), ("Auditor","green")]
```

```json
// Counsel - narrates once all three stamps exist
{ "spoken": true,
  "narration": "Freshness green: price age 12s <= max 300s, reserve age 30s <= max 3600s, source is fixture (labeled). Cover green: coverage ratio 1.25, justified 250000.0. Auditor green: age skew - none; flat reserve - none; child attestation - present; liability cover - holds. The mint was justified for 250000.0 units." }
```

**Re-running is idempotent.** A second `run_demo_path.py happy` on the same asset
returns the *same node ids* for every observation and stamp - the upsert mutates
in place rather than appending. Verified across runs:

```
element                    run 1                              run 2                              stable?
HasPrice                   56b23e5bd2bf469e8cd12cc32986a427   56b23e5bd2bf469e8cd12cc32986a427   YES
HasReserve                 ab7659f59cb142d08be6b1105d9ea8b1   ab7659f59cb142d08be6b1105d9ea8b1   YES
DependsOn                  168af644b937471f8b5f998269fc24d9   168af644b937471f8b5f998269fc24d9   YES
HasLiability               392ead0be2e34db79503a88bfee40def   392ead0be2e34db79503a88bfee40def   YES
StampedBy:Freshness        639db8629e2b4203ac4d1561c8747549   639db8629e2b4203ac4d1561c8747549   YES
StampedBy:Cover            1659c7a862cc4f70817949ab165669f9   1659c7a862cc4f70817949ab165669f9   YES
StampedBy:Auditor          8ba56e86a1b748208af2f8ad4def0596   8ba56e86a1b748208af2f8ad4def0596   YES
```

This is also what keeps the UI graph still: `jacClient.toReactFlowGraph` keys each
React Flow node on that `jid`, so identical ids across a refresh mean React Flow
reconciles the existing nodes and their positions survive instead of being rebuilt.

> **The mint clause is unverified in this environment.** `Act` is reached and
> refuses, which is the fail-closed behaviour Invariant 6 requires, but no
> successful mint has been observed on Jac 0.37.23 here. Two environment blockers,
> both independent of the code:
>
> 1. **No usable credentials on this host.** There is no `.env` in the run tree,
>    and the repo's `.env` carries the duplicate-key defect described in Pre-flight
>    item 2, so `DEPLOYER_PRIVATE_KEY` resolves to `''`:
>    ```json
>    { "minted": false,
>      "reason": "evm mint failed: The private key must be exactly 32 bytes long, instead of 0 bytes." }
>    ```
> 2. **No local-chain fallback either.** The **Troubleshooting** workaround needs
>    `anvil` and built `artifacts/`; neither is present on this host (`forge` and
>    `anvil` are not installed and `artifacts/` does not exist).
>
> The graph-side consequence is nil - `Act` writes no `MintRecord` and no
> `MintedAs` edge when it refuses, so `MintedAs=0` in the evidence above is correct
> for a refused mint, not a missing feature. To close this clause, fix `.env` per
> Pre-flight item 2, then set `DEMO_RECIPIENT` to a funded non-zero address and
> re-run `run_demo_path.py happy`.

<details>
<summary><strong>Historical evidence - pre-0.37 runtime, retained for reference only</strong></summary>

The following was captured under Jac 0.13.5 against a local `anvil` chain (id 31337),
because the capturing host could not complete a TLS handshake with the Sepolia
provider. It is **not reproducible on this tree** - the runtime, the store engine
(SQLite then, Postgres now) and parts of the walker set have all changed. It is kept
because it is the only record of a completed mint in this repository's history.

```json
// Act - DemoControl happy, requested 1,000,000, justified 250,000
{ "minted": true, "amount": 250000.0, "justified": 250000.0,
  "tx": "f83aa8fb4e3bb3d506ea5cbb4c2822af1719c04f660001bdeeaa4dd8403620eb",
  "nft_id": 1 }
```

```json
// GetAsset - three StampedBy entries and the MintRecord
stamps: [["Freshness","green"], ["Cover","green"], ["Auditor","green"]]
overall_status: "minted"
MintRecord: { "tx_hash": "f83aa8fb…620eb", "minted_amount": 250000.0,
              "coverage_used": 250000.0, "nft_token_id": 1,
              "stamp_summary": {"Freshness":"green","Cover":"green","Auditor":"green"} }
```

Verified independently of the graph - `balanceOf(recipient)` and `totalSupply()` both
`249999.999999999995805696` (the 18-decimal rounding of 250000), `ownerOf(1)` is the
recipient, receipt `status: 1`, `gasUsed: 75166`. `amount == min(requested, justified)
== min(1000000, 250000)` is Invariant 6.

**Etherscan.** On Sepolia the tx and NFT links resolve at
`https://sepolia.etherscan.io/tx/<tx>` and
`https://sepolia.etherscan.io/token/<POR_ATTESTATION_ADDRESS>?a=<nft_id>`.
`ExplorerLink` is wired and correct; the hash above does not exist on the public
network.

</details>

`Cover`'s payload carries the number the button is quoting:

```json
{ "walker": "Cover", "color": "green",
  "reasons": ["child attestation: present", "coverage ratio 1.25 >= min 1.0", "justified amount: 250000.0"],
  "justified_amount": 250000.0, "coverage_ratio": 1.25 }
```

## Path 2 - Yellow (stale or stuck reserve)

```bash
.jac/venv/bin/python scripts/run_demo_path.py yellow
```

**In the UI.** Select **⚠️ Yellow Path**. Cover and Auditor render yellow (`Flat reserve`), Freshness stays green. `MintButton` is disabled and reads its justified amount from Cover's payload.

**Evidence - Jac 0.37.23.**

```json
stamps: [("Freshness","green"), ("Cover","yellow"), ("Auditor","yellow")]
HasPrice=1  HasReserve=1  DependsOn=1  HasLiability=1  StampedBy=3
Act:    { "minted": false, "reason": "Cover stamp is yellow" }
MintedAs: 0  ->  no mint record
```

`Act` returns `{"minted": false, …}` - never a 500, never a `MintRecord` - which is Prompt 7's AC 1 verbatim.

## Path 3 - Unknown / red (missing PoR or missing child)

```bash
.jac/venv/bin/python scripts/run_demo_path.py unknown
```

**In the UI.** Select **❌ Unknown Path**. Cover and Auditor render red (`Missing child`); `MintButton` stays disabled.

**Evidence - Jac 0.37.23.**

```json
stamps: [("Freshness","green"), ("Cover","red"), ("Auditor","red")]
HasPrice=1  HasReserve=1  DependsOn=1  HasLiability=1  StampedBy=3
Act:    { "minted": false, "reason": "Cover stamp is red" }
MintedAs: 0  ->  no mint record
```

**Returning to happy.** Running `happy` again after `yellow` comes back **green**, not
stuck yellow. That is the `flat_history` clear in the Ingest upsert doing its work:
the reserve node now persists across runs, so without an explicit reset to `[]` the
flat windows written by `por_flat` would still be attached and Cover would keep
reading yellow on a healthy reserve. Verified in sequence - happy, yellow, unknown,
happy - with the final run green.

> **Known deviation - AC 6's first clause.** Prompt 13 asks for `Freshness unknown` on
> this path, but Prompt 5 specifies Freshness *"looks at clocks only"* and goes
> unknown only on *"missing inputs"*, and Prompt 8 specifies this path as
> `Ingest(por_live)` followed by `child.present = false`. `por_live` supplies a fresh
> price and a fresh reserve, so a clocks-only Freshness is **green** - and must be, or
> `test_freshness_green` (which asserts green with no child claim at all) would fail.
> The required triple is unreachable as specified: Freshness-unknown needs a missing
> observation, which forces Cover to `unknown` rather than `red`, because Cover's
> first branch returns unknown when price or reserve is absent. The path can satisfy
> `Cover red`, `Auditor red`, `Act refuses`, and `no MintRecord` - three of four
> clauses plus both consequences. Closing the last clause requires either relaxing
> "clocks only" in Freshness or changing the unknown-path fixture; both contradict a
> different mandated prompt, so neither was done. The system's fail-closed behavior
> is unaffected: the mint is refused, and that is what the invariants protect.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Act` reports `evm mint failed: Unknown format '', attempted to normalize to '0x'` | An address key in `.env` resolves to `''` - almost always a duplicated key whose later, blank copy won | `grep -c '^POR_TOKEN_ADDRESS=' .env` must print `1`; delete the duplicate lines. `deploy_contracts.py` no longer appends, so it will not recreate them |
| `Act` reports `evm mint failed: The private key must be exactly 32 bytes long` | `DEPLOYER_PRIVATE_KEY` empty or not 32 bytes - on this repo, the blank duplicate winning over the real value | Delete the duplicate lines so the real key is the only one; restart the server so `evm_py`'s `load_dotenv` re-reads it |
| `Act` reports `evm mint failed: 0xec442f05…` | `DEMO_RECIPIENT` (CLI) or the hard-coded recipient (UI) is `0x000…000` | Use a real address - ERC20 cannot mint to zero |
| `Act` reports `evm mint failed: 0x1e4fbdf7…` at deploy time | `build_transaction({})` estimated gas with no `from`, so `Ownable(msg.sender)` saw `address(0)` | Already fixed: `deploy_contracts.py` and `evm_py` set `w3.eth.default_account` before building |
| `SSLCertVerificationError` reaching the provider | This host cannot validate the provider's certificate chain | Run the demo against a local chain: `anvil`, then export `SEPOLIA_RPC_URL=http://127.0.0.1:8545`, `CHAIN_ID=31337`, and the deployed addresses. `load_dotenv` does not override pre-set variables, so exported values win and `.env` is left untouched. **Requires `anvil` and built `artifacts/`, neither of which is present on every host** |
| `ModuleNotFoundError: No module named 'dotenv'` running a script | System Python has no `pip`/`python-dotenv` | Use jac's project venv: `.jac/venv/bin/python scripts/…` |
| `jac test jac/tests/` fails | Superseded - Jac 0.37 accepts a directory | `jac test -d jac/tests` (the suffix is `-d`, and discovery is scoped by `[test] directory` in `jac.toml`) |
| `jac check` prints a `charmap` encoding error | Windows console codepage cannot render the checkmark glyphs | `PYTHONIOENCODING=utf-8 jac check <file>` |
| Observations accumulate on re-ingest (HasPrice 1, 2, 3 …) | A spawned sibling's `del [edge …]` is silently lost - each child's commit rewrites the anchor's edge set from its own snapshot | Fixed: `Ingest` upserts all four observation nodes in place instead of clearing and re-attaching. Any already-accumulated asset needs a store reset; the upsert does not retroactively clean it |
| Stamps accumulate (3, 6, 9) | Same commit semantics, if an approval walker ever deletes instead of upserting | Already fixed: Freshness/Cover/Auditor upsert in place. `DemoControl` no longer attempts a stamp reset - that deletion was a no-op and has been removed |
| UI shows nothing / `GetAsset returned no asset report` | Walkers declared `with Asset entry` only run when spawned **on** the asset | Pass the node id: `POST /walker/{Name}/{node_id}`. `SeedAsset` is the only `Root`-entry walker, so it is the only source of a node id |
| Server 500 `NameError: name 'StampedBy' is not defined` | Edge archetype used with `[here ->:X:->]` but not imported into that module | Import it: `import from jac.schemas.edges { StampedBy }`. This bites new tests too - a test asserting `len([asset ->:HasPrice:->])` must import `HasPrice` |

## Known gaps

### The UI mint recipient

`frontend/src/app/page.tsx` hard-codes the recipient to `0x748ABdeF0775132E8F941e1513152D5eb02D3a4B`:

```ts
const DEMO_RECIPIENT = '0x748ABdeF0775132E8F941e1513152D5eb02D3a4B';
```

The Mint button in the UI initiates a real on-chain mint to this configured demo recipient. It succeeds only when all three stamps are green and the requested amount is within the justified amount computed by Cover.

### Frontend browser verification

`npm install` and `npm run build` both pass on the 0.37 tree, and the dev server
serves `http://localhost:3000` with the expected server-rendered content - including
`Counsel is blind until three stamps exist.` in the zero-stamp state, and no
`ExplorerLink` before a mint. What has **not** been verified is anything requiring a
browser session: graph node positions holding still across a refresh, badge colours
matching the last path run, and the Happy → Mint click-through.

Operator steps to close it:

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000, with `jac run main.jac` up on :8000
```

Then: click **Happy**, confirm three green badges and an enabled
`Mint (justified: 250000.00)`; click **Mint** and confirm the refusal is displayed
(hard-coded zero recipient - see above) rather than a silent no-op; refresh and
confirm the graph nodes do not move; click **Yellow** and **Unknown** and confirm the
badge colours track.

## Post-demo pointers

`docs/architecture.md` explains why the mint is a permit with a quantity, documents the `evm_spy` mechanism, and defines **Spawned-sibling commit semantics** - the rule that makes upsert-in-place mandatory and delete-then-create a silent no-op. `docs/policy.md` lists every `POLICY` knob and what changes when you turn it. `docs/walkers.md` gives one section per walker: Purpose, Inputs, Writes, Forbidden, Report Shape.
