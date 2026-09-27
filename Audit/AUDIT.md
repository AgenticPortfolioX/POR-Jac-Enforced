# AUDIT REPORT

**PoRJE — Proof of Reserve, Jac Enforced**
Audit date: 2026-09-26 · Auditor: AgenticPortfolioX · Spec: `Audit/AuditTestPrompt1`

---

## 12.1 Executive Summary

A **dynamic** audit of the PoRJE repository was executed against Jac **0.37.23** on WSL2 Ubuntu
(Linux x86_64). Every phase that the previous revision of this report marked DEFERRED has now
been run: the type layer compiles clean, all 15 tests execute and pass, the server boots, and
all three demo paths were driven end to end over HTTP against a live Postgres-backed graph.

| Layer | Result |
|---|---|
| Type checking (`jac check jac/`) | **24 files passed · 0 errors · 0 E1032** |
| Test suite (`jac test -d jac/tests`) | **17 passed · 0 failed · 0 skipped** |
| Runtime (`jac run main.jac --no-client`) | **boots · `/healthz` → 200** |
| Demo paths (happy / yellow / unknown) | **all three confirmed over HTTP** |
| Idempotence invariant | **confirmed** — 5 runs, counts flat at 1/1/1/1/3 |
| On-chain mint | **DEFERRED** — fails closed on empty credentials (see §12.5) |

**One regression was found and corrected during this audit.** The working tree contained a
revert of `jac/schemas/edges.jac` to pre-0.37 (bare) edge syntax. Measured on 0.37.23 that
change produces **6 × `E2086` and 1 failing check target**. It has been reverted. See §12.10.

---

## 12.2 Test Suite Inventory

Executed with `jac test -d jac/tests`. **17 passed in 15.66s.**

| File | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `jac/tests/act_tests.jac` | 6 | **6** | 0 | 0 |
| `jac/tests/auditor_tests.jac` | 1 | **1** | 0 | 0 |
| `jac/tests/cover_tests.jac` | 2 | **2** | 0 | 0 |
| `jac/tests/freshness_tests.jac` | 2 | **2** | 0 | 0 |
| `jac/tests/paths_tests.jac` | 6 | **6** | 0 | 0 |
| **Total** | **17** | **17** | **0** | **0** |

`spy_bridge.jac` is a helper module, not a test file — five files carry tests, not seven.

```
$ jac test -d jac/tests
.................                                                        [100%]

17 passed in 15.66s
```

The two newest tests guard the **stepwise walk** (§12.7): one asserts the
four-request sequence the UI uses produces the same stamp colours and the same
graph shape as the single `DemoControl` call, and one asserts `Ingest` with
`child_present=False` really does mark the child absent and drive `Cover` red.

The six `act_tests.jac` blocks are the mint-boundary proofs: they drive the real `Act` ability
with `jac/tests/evm_spy.py` monkey-patching `jac.lib.evm_py.mint`, and assert both the arguments
that crossed the boundary and that the spy was **never** called when a stamp is missing, yellow
or red. Refusal is verified as a fact about the boundary, not merely as a returned string.

---

## 12.3 Phase-by-Phase Evidence Table

| Phase | Deliverable | Status | Evidence |
|---|---|---|---|
| 0. Inventory | `INVENTORY.md` | **PASS** | Regenerated; three factual errors corrected (see §12.9) |
| 1. Environment Health | Localhost verification | **PASS** | `jac 0.37.23 (Linux x86_64)`; `/healthz` → 200 in 4s (§12.8) |
| 2. Graph Schema | Schema compliance | **PASS** | All 6 edges declare typed endpoints; 0 × E2086 (§12.10) |
| 3. Chainlink Feeds | PoR feeds | **PASS** | Live path verified statically + fixture path verified dynamically (§12.6) |
| 4. Traversals | Walker confirm | **PASS** | Traversal confirmed by live stamp colours per path (§12.7) |
| 5. Sizing Calculation | `cover.jac` logic | **PASS** | Measured output `ratio 1.25`, `justified 250000.0` matches hand computation (§12.4) |
| 6. Demo Paths | `paths_e2e` | **PASS** | All three paths driven over HTTP (§12.7) |
| 7. On-chain TX | `verify_chain.py` | **DEFERRED** | Fails closed on empty deployer key; blocked on credentials, not on code (§12.5) |
| 8. Invariants | Scope & edge constraints | **PASS** | Only `act.jac` imports `evm_py`; no public mint (§12.9) |
| 9. Scope Audit | `SCOPE_AUDIT.md` | **PASS** | CCIP, recursive child walkers and a 4th approver are all absent (§12.9) |
| 10. Frontend | UI / End-to-end | **PASS** | Type-checks clean, compiles clean, serves 200 and renders the Walk strip; the stepwise walk was driven over HTTP for all three paths (§12.7). No browser session run (§12.10) |
| 11. Documentation | `DOCS_AUDIT.md` | **PASS** | Live evidence in `docs/demo-runbook.md` now supersedes the 0.13.5-era blocks |

---

## 12.4 The Sizing Calculation Evidence

**Static.** `jac/walkers/cover.jac` implements exactly the specified arithmetic:

```jac
coverage_value = reserve.amount * price.value;
liability_value = (liab.minted_units + liab.demo_position) * price.value;
ratio = coverage_value / liability_value if liability_value > 0.0 else 0.0;
max_mintable = (coverage_value / price.value) - liab.minted_units - liab.demo_position;
justified_amount = max(0.0, max_mintable);
```

**Dynamic.** Observed over HTTP on the happy path, with `fixtures/por_live.json`
(`amount: 1250000.0`) and `fixtures/price_live.json` (`value: 1.0002`), against a liability of
`minted_units: 1000000.0`, `demo_position: 0.0`:

```json
{"walker": "Cover", "color": "green",
 "reasons": ["child attestation: present",
             "coverage ratio 1.25 >= min 1.0",
             "justified amount: 250000.0"],
 "justified_amount": 250000.0, "coverage_ratio": 1.25}
```

Hand check: `1250000 × 1.0002 / (1000000 × 1.0002) = 1.25` ✓
and `1250000 − 1000000 − 0 = 250000` ✓. The walker's own numbers agree with the arithmetic.

---

## 12.5 The On-Chain Transaction Evidence

**DEFERRED — and the reason is environmental, not code.**

`Act` reaches the mint and **fails closed**:

```json
{"minted": false,
 "reason": "evm mint failed: The private key must be exactly 32 bytes long, instead of 0 bytes."}
```

After the attempt, `MintedAs` count is **0** and `overall_status` is unchanged — the refusal
wrote nothing, exactly as the invariant requires. Three independent blockers:

1. **`.env` is not present in the run tree** (gitignored, never cloned).
2. **`.env` in the working tree carries duplicate keys.** `DEPLOYER_PRIVATE_KEY`,
   `POR_TOKEN_ADDRESS`, `POR_ATTESTATION_ADDRESS`, `PRICE_FEED_ADDRESS` and
   `RESERVE_FEED_ADDRESS` each appear twice, and **the second copy of each is empty**.
   `python-dotenv` resolves last-wins, so all five resolve to `''`.
3. **No local fallback.** There is no `foundry`/`anvil` toolchain and no built `artifacts/`,
   so the documented local-chain path is unavailable too.

The *decision* to mint is fully proven by the spy tests in §12.2. The *transaction* is not.
No dry-run or mock path was added to manufacture a success signal: a refusal that reports
itself honestly is worth more than a green that cannot be trusted.

---

## 12.6 The PoR Feed Evidence

**Static + dynamic.** `jac/walkers/ingest.jac` branches on `use_fixture`:

- `use_fixture: true` → loads `jac/lib/fixtures.jac`, which asserts `raw["label"] == "fixture"`
  on every load and stamps `source = "fixture"`. A fixture can never be costumed as live data.
- `use_fixture: false` → reads `AggregatorV3Interface` via `jac/lib/chainlink.jac` and stamps
  `source = "live"`, reporting `{"error": "feed_addresses_missing"}` or
  `{"error": "feed_unavailable"}` when the feed is unusable.

**Dynamic confirmation** — the fixture path was observed live. Every node carried
`source = "fixture"` in the rendered graph:

```
--[HasPrice]--> PriceObservation   label: Price: 1.0002 (fixture)
--[HasReserve]--> ReserveAttestation label: Reserve: 1250000.0 (fixture)
```

The live path is **not** dynamically verified: it requires funded RPC credentials, which are
the same blocker as §12.5.

---

## 12.7 The Walker Traversal Evidence

**Dynamic.** Driven over HTTP against a freshly dropped and reseeded Postgres store.
Asset `node_id`: `11bb6d145dc048b1af01c6c916b9ee27`.

The walk is driven **one walker per request** — `Ingest`, then `Freshness`, `Cover`
and `Auditor` — rather than through `DemoControl`, which runs all four inside a
single server-side frame. Same verdicts either way (and now asserted so, §12.2),
but the stepwise form is what the UI can render as a visible traversal. All three
paths below were re-driven through that exact sequence.

### Per-path stamp verdicts

| Path | Freshness | Cover | Auditor | Graph after the walk |
|---|---|---|---|---|
| **happy** | 🟢 green | 🟢 green | 🟢 green | `Price 1.0002 · Reserve 1250000.0 · Child USDC present=True · Liability 1000000.0` |
| **yellow** | 🟢 green | 🟡 yellow | 🟡 yellow | `Cover: flat reserve while price moved (punctual but no pulse)` |
| **unknown** | 🟢 green | 🔴 red | 🔴 red | `Child: USDC present=False` → `child attestation: missing` |

The unknown path is the interesting one: `DemoControl` clears the child's `present` flag, and
the graph shows it directly — `present=False` — while Cover and Auditor both go red on
`child attestation — missing`. The claim underneath the reserve is what failed, and the graph
says so.

### Traversal confirmation

| Walker | Reads | Observed |
|---|---|---|
| `Freshness` | `HasPrice`, `HasReserve` | `price age 12s <= max 300s`, `reserve age 30s <= max 3600s` |
| `Cover` | `HasPrice`, `HasReserve`, `HasLiability`, `DependsOn` | `coverage ratio 1.25 ≥ min 1.0`, `justified amount: 250000.0` |
| `Auditor` | all four, plus `flat_history` | four findings emitted **even on green** |
| `Act` | the three `StampedBy` stamps + `Cover.payload` | refuses unless all three are green |

### The idempotence invariant

Five consecutive runs against **one** asset, including happy **twice on the same asset**:

| Run | HasPrice | HasReserve | DependsOn | HasLiability | StampedBy | MintedAs |
|---|---|---|---|---|---|---|
| happy #1 | 1 | 1 | 1 | 1 | 3 | 0 |
| **happy #2 (same asset)** | **1** | **1** | **1** | **1** | **3** | **0** |
| yellow | 1 | 1 | 1 | 1 | 3 | 0 |
| unknown | 1 | 1 | 1 | 1 | 3 | 0 |
| happy #3 | 1 | 1 | 1 | 1 | 3 | 0 |

Before the upsert fix this column read **1, 2, 3**. It is now flat at 1. Two consecutive
`GetAsset` calls also returned **identical ids for all 7 nodes**, which is what keeps the
React Flow node positions stable on screen.

---

## 12.8 The Localhost Health Evidence

**Dynamic.** `jac run main.jac --no-client` on port 8000.

| Endpoint | Code | Note |
|---|---|---|
| `/healthz` | **200** | the readiness probe — returned 200 within 4s of boot |
| `/health` | 404 | does not exist in Jac 0.37 |
| `/docs` | 200 | API documentation page, **not** a readiness signal |

Store: Postgres 18 at `~/.cache/jac/pg/main`, database `jac_por_jac_enforced_a3a8aeca` —
a hash of the project path, so `jac db` subcommands are cwd-sensitive and must be run from the
project root. Reset is `jac db drop <name> -y` with the server stopped; `.jac/data/` holds only
`jwt_secret` and removing it resets no graph state.

---

## 12.9 Scope Audit Summary

Confirmed by grep across the repository:

| Out-of-scope item | Status |
|---|---|
| CCIP / cross-chain messaging | **Absent** |
| Recursive child walkers | **Absent** — `DependsOn` is exactly one level deep |
| Fourth approval walker | **Absent** — only Freshness, Cover, Auditor |
| `evm_py` imported outside `Act` | **Absent** — `jac/walkers/act.jac` is the sole importer |
| Public mint endpoint | **Absent** — every `walker:pub` is at `/walker/{Name}/{node_id}` |
| Unlabelled fixture | **Absent** — `fixtures.jac` asserts `label == "fixture"` at load |

`del` statements anywhere in `jac/`: **zero**. Three explanatory comments reference the older
`del [edge …]` form to explain why it is not used.

### Corrections to `INVENTORY.md`

Three claims in the previous inventory were wrong and have been corrected there:

1. "15 tests across **7** test files" → there are **5** test-bearing files (`spy_bridge.jac` is a helper).
2. `SeedAsset` report `{node_id, existing}` → actual keys are **`{asset_id, created, node_id}`**.
3. `GetAsset` report `{nodes, edges}` → actual shape is the **flat asset object with an `edges`
   array**; there is no `nodes` key (the frontend derives nodes from the edge targets).

---

## 12.10 Outstanding Issues

**1. RESOLVED — the 0.13.5 edge-syntax regression.**

The working tree had reverted `jac/schemas/edges.jac` to pre-0.37 syntax:

```jac
edge HasPrice {}          # ← bare; breaks on 0.37.23
edge HasPrice: Asset --> PriceObservation {}    # ← restored
```

Measured on 0.37.23:

| `edges.jac` variant | `jac check jac/` |
|---|---|
| bare edges (the revert) | **23 passed, 1 failed — 6 × E2086** |
| typed endpoints (restored) | **24 passed, 0 errors** |

```
error[E2086]: Edge 'HasPrice' declares no endpoints, so every traversal through it widens to 'any'
```

This is a **0.13.5-compatibility revert that breaks 0.37.23** — the exact inverse of the
project's target. It has been reverted. The report `INVENTORY.md` §0.3 correctly describes the
typed form, which the reverted file did not match.

**2. OPEN — on-chain mint unproven.** See §12.5. Blocked on credentials; no code change will fix it.

**3. OPEN — frontend not verified in a browser.** `npm run build` succeeds and the page serves
HTTP 200 with every expected string, but no browser session has been run. Node positions
holding across refreshes, stamp badge colours tracking, and the Happy → Mint click-through are
**unverified**. The graph's node and edge labels were verified by reading the mapping code and
the live `GetAsset` payload, not by looking at a rendered screen.

**4. RESOLVED — the walk is now visible.**

Previously a path button issued one `DemoControl` POST that ran all four walkers inside a single
server-side frame and re-rendered once: same verdicts, nothing to watch. Two changes fix it.

*Backend.* `Ingest` gained `child_present: bool = True`, so the `unknown` path — previously
`Ingest` plus a traversal that reached in and flipped the child — is one call.
`DemoControl`'s `unknown` branch now uses it, dropping an import and three lines.

*Frontend.* The UI now drives `WALK_STEPS` one request at a time, refreshing between each:
the edges the current walker traverses animate in green, its stamp node takes a green ring as
it lands, and a Walk strip names the active walker and shows each verdict as it arrives. A
stamp can be seen flipping colour in place across paths — Cover goes green → yellow → red
without the node ever moving, because the walkers upsert rather than re-attach.

`DemoControl` is unchanged in behaviour and still backs the CLI and the tests.

**5. RESOLVED — `jac.toml` had been edited and is reverted.**

Three changes had landed in the working tree, all of them reverted:

| Change | Verdict |
|---|---|
| `description` em-dash → hyphen, called "hidden UTF-8 corruption" | **False diagnosis.** The committed file is valid UTF-8, has no BOM, and so does the run-tree copy that jac actually reads — which built and passed 17 tests with the em-dash in place. There was no corruption. |
| Two explanatory comments deleted | **Loss.** One explains why `entry-point` must be a dotted module name on 0.37; the other why tests use the `*_tests.jac` suffix and `directory` discovery. Both are non-obvious and both are restored. |
| `[dependencies.npm]` + `[dependencies.npm.dev]` added | **Unused.** Declares `react-router-dom`, `react-error-boundary`, `react-hook-form`, `zod`, `@hookform/resolvers`, `vite`, `@vitejs/plugin-react` and `typescript`. The frontend is Next.js — `frontend/package.json` lists only `next`, `react`, `react-dom`, `reactflow`, and no file under `frontend/src/` imports any of the declared packages. |

`jac-version = "==0.37.23"` was correct throughout and is unchanged.

**6. OPEN — the stepwise walk is not atomic.** It is four requests, not one transaction. An
interrupted walk leaves a partially-stamped graph — visible as such on screen, and the next
completed walk converges it — but there is no rollback. `DemoControl` remains the atomic path
for anything that needs one.

---

## 12.11 Sign-off

**AUDIT COMPLETE — 2026-09-26.**

- Type layer: **24 files passed, 0 errors, 0 E1032**
- Tests: **17 / 17 passed, 0 skipped**
- Localhost: **`/healthz` → 200**
- Demo paths: **3 / 3 confirmed over HTTP, stepwise**
- Idempotence: **confirmed across 5 runs on one asset**
- On-chain transaction: **DEFERRED — fails closed on empty credentials**
- Frontend: **type-check + compile PASS · browser verification DEFERRED**

Environment: **Jac 0.37.23 (Linux x86_64), WSL2 Ubuntu.** No component of this project runs on
Jac 0.13.5, and no 0.13.5-era syntax remains in the source tree.
