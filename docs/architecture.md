# Architecture - Proof of Reserve, Jac Enforced

## Overview

> Proof of Reserve attests that backing was reported. Proof of Reserve, Jac Enforced puts that attestation on a graph, requires three green stamps from walkers that are allowed to attack the claim, and only then mints - only as much as current coverage justifies - so "backed" is a permit with a quantity, not a text output you can quote.

A Chainlink Proof of Reserve attestation and a price observation arrive as facts. PoRJE places them as typed nodes on a Jac graph beside the asset whose printer we control, the child claim the reserve itself depends on, and the protocol liability that inherits "backed". Three approval walkers traverse that graph - Freshness reads clocks, Cover computes coverage, Auditor attacks the claim - and each writes a `Stamp` node carrying a color (green / caution / red / unknown) and its reasons, linked to the asset by a `StampedBy` edge. `Act` is the only walker permitted to touch the EVM bridge, and it refuses unless all three stamps are green; when it does mint it mints `min(requested, justified_by_current_coverage)` and writes a `MintRecord` node holding the tx hash, the NFT id, and the stamp summary that authorized it. `Counsel` narrates the verdicts but is blind until the stamps exist, because it reads them off the graph rather than being handed them. Nothing in this system is held in a chat, a session, or a response body: the graph is the state, the stamps are the verdicts, and the mint is a walker that reads the verdicts.

## Component Diagram

```
Frontend (Next.js) → HTTP → Jac Cloud (jac run) → Ingest, Freshness, Cover, Auditor, Act, Counsel → Jac Graph (Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord) → EVM (Sepolia): Chainlink AggregatorV3 feeds, PoRToken (only Act may mint), PoRAttestation (ERC-721 durable record).
```

## Data Flow

```
Ingest ──> Freshness ──> Cover ──> Auditor ──> Act ──> Counsel
  │            │            │          │         │        │
  │            │            │          │         │        └─ reads all three Stamps; speaks only if present
  │            │            │          │         └─ reads the three Stamps + Cover.payload.justified_amount
  │            │            │          └─ writes findings even when green (adversarial visibility)
  │            │            └─ computes coverage ratio + justified amount, writes them into its Stamp payload
  │            └─ checks price/reserve ages against POLICY, writes green|caution|red|unknown
  └─ upserts PriceObservation, ReserveAttestation, ChildClaim, Liability nodes + edges
```

1. **Ingest** runs with `Asset` entry. It reads either Chainlink feeds (live, via `jac/lib/chainlink_py.py`) or labeled fixtures (`jac/lib/fixtures.jac`), then **upserts** the observation nodes in place - attaching only when none exists, otherwise mutating the existing node - so a re-ingest refreshes the facts without stacking a second observation. It must not delete-then-recreate; see **Spawned-sibling commit semantics** below for why that form is silently lost here.
2. **Freshness** traverses `HasPrice` and `HasReserve`, compares both ages against `POLICY`, and writes a `Stamp` with color + reasons. Missing observations are `unknown`, never green - fail closed.
3. **Cover** traverses price, reserve, and liability, checks the child claim (`DependsOn`), the flat-reserve pattern (`flat_history`), and computes `coverage_value / liability_value`. It writes the ratio and the justified mint amount into its `Stamp.payload`, which is what `Act` and `Counsel` later read.
4. **Auditor** re-derives four independent findings (age skew, flat reserve, child attestation, liability cover) and writes all four as reasons **even when the verdict is green**, so a passing claim is still auditable. It never narrates.
5. **Act** collects `StampedBy` edges into a map by walker name. A missing stamp, or any stamp that is not green, returns `{"minted": false, "reason": ...}` and writes nothing. Otherwise it computes `min(requested, justified)`, calls `evm_py.mint` and `evm_py.mint_attestation`, and writes a `MintRecord` node via a `MintedAs` edge. It is the only walker that imports the EVM bridge.
6. **Counsel** re-reads the stamps from the graph. If any of the three is missing it returns `{"spoken": false, ...}` - it cannot narrate a verdict that was never written. Otherwise it composes narration from the stamps' own reason strings.

**Counsel is blind until stamps exist.** It has no independent access to prices, reserves, or coverage; its only inputs are the `Stamp` nodes. That is the point: the explainer cannot describe a decision the graph does not contain.

## Spawned-sibling commit semantics

This is the canonical reference for the rule; `jac/walkers/freshness.jac` and `jac/walkers/ingest.jac` cite it rather than restating it.

**The rule.** When one ability spawns several sibling walkers (`DemoControl` spawns `Ingest`, `Freshness`, `Cover` and `Auditor` from a single frame), each child's commit **re-writes the parent node's edge set from that child's own snapshot**. A sibling that deletes an edge from a shared anchor does not remove it durably: the next sibling to commit restores it from the snapshot it took. **The deletion is silently lost.** There is no error, no warning, and no diagnostic - the walker reports success.

**The consequence.** `del [edge …]` followed by a fresh attachment - the obvious way to make a walker re-runnable - is wrong here. The *delete* half is a no-op while the *attach* half is not, so every run appends another node. This was a live defect: re-ingesting an asset produced `HasPrice` counts of 1, 2, 3 across three runs. It was not merely untidy. `Freshness` reads the **oldest** surviving observation, so once the accumulated graph was older than `max_price_age_seconds` the approved path reported **red on an asset that had just been refreshed** - a false negative on a system whose entire claim is that a green means green.

**The pattern.** **Upsert in place.** Attach only when no such edge exists; otherwise mutate the existing node's fields. A mutation has no edge to lose, so the invariant holds no matter how the walker is driven, how many siblings it has, or in what order they commit. Both places that must survive re-runs use it:

| Walker | Node | Why |
|---|---|---|
| `Ingest` | `PriceObservation`, `ReserveAttestation`, `ChildClaim`, `Liability` | a re-ingest must refresh the facts, not stack a second set |
| `Freshness`, `Cover`, `Auditor` | their own `Stamp` | one stamp per walker per asset, so `Act` can never read a stale green |

**Clearing from the parent's own frame does not help.** It is tempting to conclude that the deletion works if it happens in the anchor frame *before* the spawns, while the persisted edges are still visible. It does not. `DemoControl` carried exactly such a `del [edge here ->:StampedBy:->]` for that reason; removing it changed nothing - stamps still dedupe to exactly three, because the approval walkers' upsert was holding the invariant all along. The deletion was dead code whose comment asserted it was load-bearing. It has been removed.

**Diagnostic.** If a node or edge count grows with the number of runs, this rule is being violated. The regression guard is `test_re_ingest_does_not_accumulate_edges` in `jac/tests/paths_tests.jac`, which runs the approved path three times against one asset and asserts exactly one of each observation and exactly three stamps.

**Not retroactive.** Upsert prevents accumulation; it does not clean a graph that already accumulated under the old form. Any asset written before the fix keeps its extra observations - drop the store (`jac db drop`, see the runbook) rather than expecting the walker to heal it.

## Invariants

1. **The Jac graph is the single source of truth.** Approvals, findings, coverage, and mint records are nodes and edges. No walker keeps verdict state in a local, a response body, or a session; a restarted server can answer `GetAsset` and `GetStamps` from the graph alone.
2. **Only `Act` calls `evm_py`.** `jac/walkers/act.jac` is the sole importer of the EVM bridge among all walkers. Freshness, Cover, and Auditor have no mint authority at all - they cannot move value even if compromised, because they do not import the capability.
3. **Only three approval walkers exist: Freshness, Cover, Auditor.** `Act` hard-codes `required = ["Freshness", "Cover", "Auditor"]`. Adding a fourth opinion means editing that list in one place, in the open.
4. **A missing stamp is not green.** `Act` and `Counsel` both treat absence as failure: `Act` refuses with `"<name> stamp missing"`, `Counsel` returns `{"spoken": false}`. Freshness and Cover return `unknown` for missing observations rather than defaulting to a pass. The system fails closed.
5. **A missing fixture label is a boot error.** `jac/lib/fixtures.jac` asserts `raw["label"] == "fixture"` on load and stamps `source = "fixture"`. A fixture can never be costumed as live data; the demo cannot lie about its provenance by accident.
6. **`min(requested, justified)` is the mint rule.** `Act` never mints the requested amount when coverage justifies less. The requested amount is a ceiling, coverage is the permit, and the `MintRecord` stores both the justified and the minted value.

## Testability

The chain boundary is the one thing a demo cannot rely on: a Sepolia RPC endpoint, a funded deployer key, and deployed contracts are all required before `Act` can complete a real mint. The test suite therefore replaces the EVM bridge with a spy, so the *decision* to mint - the part PoRJE actually owns - is tested without a network.

**The mechanism.** `jac/tests/evm_spy.py` is a Python module that inserts the project root on `sys.path`, imports `jac.lib.evm_py` **as a module object**, and replaces its `mint` and `mint_attestation` attributes with recording stubs. `jac/tests/act_tests.jac` imports the spy (which patches on import), runs `Act` against a seeded graph, and then reads the recorded call arguments back through a thin Jac bridge, `jac/tests/spy_bridge.jac`:

```jac
def spy_last_mint_args() -> list { return list(last_mint_args()); }
```

This lets a Jac test assert the exact arguments `Act` passed across the boundary - token address, recipient, amount, and the JSON reason string - and assert that `Act` reported `'tx': '0xspy', 'nft_id': 999`. The negative tests assert the spy was **never** called when a stamp is missing, caution, or red: refusing is verified as a fact about the boundary, not merely as a returned string.

**Why `Act` imports `evm_py` as a module.** `jac/walkers/act.jac` must write:

```jac
import from jac.lib { evm_py }
...
tx_hash = evm_py.mint(...);
```

and must **not** write `from jac.lib.evm_py import mint`, because that binds the function at import time - patching `jac.lib.evm_py.mint` afterwards would leave `Act` holding the original and the spy would silently record nothing while the tests still "passed". The Jac compiler inlines the module path and resolves `evm_py.mint` as a module attribute **at call time**, which is exactly what makes the monkey-patch effective. Nor may it be rewritten as `getattr(evm_py, "mint")`: the compiler never binds a runtime local named `evm_py`, so that form raises `NameError` at the call site.

**The module-attribute form is still mandatory, but it no longer costs a diagnostic.** The first two constraints above are about binding time and are unconditional - the spy only works because `evm_py.mint` resolves at call time. What did *not* survive the move to Jac 0.37.23 is the third: earlier compiler versions reported `E1032: Type is Unknown, cannot access attribute "mint"` on `jac/walkers/act.jac`, because the static checker could not introspect a `.py` module's attributes. On 0.37.23 a whole-program `jac check` over all 24 Jac files reports **0 errors and 0 E1032** - the call site type-checks cleanly.

The remaining diagnostics are warnings, none of them in `act.jac`, and each is deliberate:

| Code | Count | Where | Why it stands |
|---|---|---|---|
| `W1037` | 4 | `get_asset.jac`, `get_stamps.jac` | explicit `dict[str, any]` on the JSON payload builders - the values are genuinely heterogeneous, and this is the sanctioned way to say so |
| `W2075` | 2 | `auditor.jac`, `cover.jac` | `bool(x) == False` written for symmetry with the surrounding readable conditions |
| `W3005` | 1 | `lib/utils.jac` | `def now_unix()` keeps its empty parens for call-site symmetry |

So the mint boundary is still proven by the spy tests - but it is no longer a diagnostic anyone has to accept in exchange for it.
