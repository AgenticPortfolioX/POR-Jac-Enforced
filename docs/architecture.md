# Architecture — Proof of Reserve, Jac Enforced

## Overview

> Proof of Reserve attests that backing was reported. Proof of Reserve, Jac Enforced puts that attestation on a graph, requires three green stamps from walkers that are allowed to attack the claim, and only then mints — only as much as current coverage justifies — so "backed" is a permit with a quantity, not a text output you can quote.

A Chainlink Proof of Reserve attestation and a price observation arrive as facts. PoRJE places them as typed nodes on a Jac graph beside the asset whose printer we control, the child claim the reserve itself depends on, and the protocol liability that inherits "backed". Three approval walkers traverse that graph — Freshness reads clocks, Cover computes coverage, Auditor attacks the claim — and each writes a `Stamp` node carrying a color (green / yellow / red / unknown) and its reasons, linked to the asset by a `StampedBy` edge. `Act` is the only walker permitted to touch the EVM bridge, and it refuses unless all three stamps are green; when it does mint it mints `min(requested, justified_by_current_coverage)` and writes a `MintRecord` node holding the tx hash, the NFT id, and the stamp summary that authorized it. `Counsel` narrates the verdicts but is blind until the stamps exist, because it reads them off the graph rather than being handed them. Nothing in this system is held in a chat, a session, or a response body: the graph is the state, the stamps are the verdicts, and the mint is a walker that reads the verdicts.

## Component Diagram

```
Frontend (Next.js) → HTTP → Jac Cloud (jac start) → Ingest, Freshness, Cover, Auditor, Act, Counsel → Jac Graph (Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord) → EVM (Sepolia): Chainlink AggregatorV3 feeds, PoRToken (only Act may mint), PoRAttestation (ERC-721 durable record).
```

## Data Flow

```
Ingest ──> Freshness ──> Cover ──> Auditor ──> Act ──> Counsel
  │            │            │          │         │        │
  │            │            │          │         │        └─ reads all three Stamps; speaks only if present
  │            │            │          │         └─ reads the three Stamps + Cover.payload.justified_amount
  │            │            │          └─ writes findings even when green (adversarial visibility)
  │            │            └─ computes coverage ratio + justified amount, writes them into its Stamp payload
  │            └─ checks price/reserve ages against POLICY, writes green|yellow|red|unknown
  └─ writes PriceObservation, ReserveAttestation, ChildClaim, Liability nodes + edges
```

1. **Ingest** runs with `Asset` entry. It reads either Chainlink feeds (live, via `jac/lib/chainlink_py.py`) or labeled fixtures (`jac/lib/fixtures.jac`), detaches any prior `HasPrice` / `HasReserve` / `HasLiability` edges so re-runs are idempotent, then writes the observation nodes and edges.
2. **Freshness** traverses `HasPrice` and `HasReserve`, compares both ages against `POLICY`, and writes a `Stamp` with color + reasons. Missing observations are `unknown`, never green — fail closed.
3. **Cover** traverses price, reserve, and liability, checks the child claim (`DependsOn`), the flat-reserve pattern (`flat_history`), and computes `coverage_value / liability_value`. It writes the ratio and the justified mint amount into its `Stamp.payload`, which is what `Act` and `Counsel` later read.
4. **Auditor** re-derives four independent findings (age skew, flat reserve, child attestation, liability cover) and writes all four as reasons **even when the verdict is green**, so a passing claim is still auditable. It never narrates.
5. **Act** collects `StampedBy` edges into a map by walker name. A missing stamp, or any stamp that is not green, returns `{"minted": false, "reason": ...}` and writes nothing. Otherwise it computes `min(requested, justified)`, calls `evm_py.mint` and `evm_py.mint_attestation`, and writes a `MintRecord` node via a `MintedAs` edge. It is the only walker that imports the EVM bridge.
6. **Counsel** re-reads the stamps from the graph. If any of the three is missing it returns `{"spoken": false, ...}` — it cannot narrate a verdict that was never written. Otherwise it composes narration from the stamps' own reason strings.

**Counsel is blind until stamps exist.** It has no independent access to prices, reserves, or coverage; its only inputs are the `Stamp` nodes. That is the point: the explainer cannot describe a decision the graph does not contain.

## Invariants

1. **The Jac graph is the single source of truth.** Approvals, findings, coverage, and mint records are nodes and edges. No walker keeps verdict state in a local, a response body, or a session; a restarted server can answer `GetAsset` and `GetStamps` from the graph alone.
2. **Only `Act` calls `evm_py`.** `jac/walkers/act.jac` is the sole importer of the EVM bridge among all walkers. Freshness, Cover, and Auditor have no mint authority at all — they cannot move value even if compromised, because they do not import the capability.
3. **Only three approval walkers exist: Freshness, Cover, Auditor.** `Act` hard-codes `required = ["Freshness", "Cover", "Auditor"]`. Adding a fourth opinion means editing that list in one place, in the open.
4. **A missing stamp is not green.** `Act` and `Counsel` both treat absence as failure: `Act` refuses with `"<name> stamp missing"`, `Counsel` returns `{"spoken": false}`. Freshness and Cover return `unknown` for missing observations rather than defaulting to a pass. The system fails closed.
5. **A missing fixture label is a boot error.** `jac/lib/fixtures.jac` asserts `raw["label"] == "fixture"` on load and stamps `source = "fixture"`. A fixture can never be costumed as live data; the demo cannot lie about its provenance by accident.
6. **`min(requested, justified)` is the mint rule.** `Act` never mints the requested amount when coverage justifies less. The requested amount is a ceiling, coverage is the permit, and the `MintRecord` stores both the justified and the minted value.

## Testability

The chain boundary is the one thing a demo cannot rely on: a Sepolia RPC endpoint, a funded deployer key, and deployed contracts are all required before `Act` can complete a real mint. The test suite therefore replaces the EVM bridge with a spy, so the *decision* to mint — the part PoRJE actually owns — is tested without a network.

**The mechanism.** `jac/tests/evm_spy.py` is a Python module that inserts the project root on `sys.path`, imports `jac.lib.evm_py` **as a module object**, and replaces its `mint` and `mint_attestation` attributes with recording stubs. `jac/tests/test_act.jac` imports the spy (which patches on import), runs `Act` against a seeded graph, and then reads the recorded call arguments back through a thin Jac bridge, `jac/tests/spy_bridge.jac`:

```jac
def spy_last_mint_args() -> list { return list(last_mint_args()); }
```

This lets a Jac test assert the exact arguments `Act` passed across the boundary — token address, recipient, amount, and the JSON reason string — and assert that `Act` reported `'tx': '0xspy', 'nft_id': 999`. The negative tests assert the spy was **never** called when a stamp is missing, yellow, or red: refusing is verified as a fact about the boundary, not merely as a returned string.

**Why `Act` imports `evm_py` as a module.** `jac/walkers/act.jac` must write:

```jac
import from jac.lib { evm_py }
...
tx_hash = evm_py.mint(...);
```

and must **not** write `from jac.lib.evm_py import mint`, because that binds the function at import time — patching `jac.lib.evm_py.mint` afterwards would leave `Act` holding the original and the spy would silently record nothing while the tests still "passed". The Jac compiler inlines the module path and resolves `evm_py.mint` as a module attribute **at call time**, which is exactly what makes the monkey-patch effective. Nor may it be rewritten as `getattr(evm_py, "mint")`: the compiler never binds a runtime local named `evm_py`, so that form raises `NameError` at the call site.

The cost of that form is that `jac check` reports `E1032: Type is Unknown, cannot access attribute "mint"` on `jac/walkers/act.jac`: the static checker cannot introspect a `.py` module's attributes. This is a checker limitation, not a defect — the call path is proven by the spy tests, which exercise the real `Act` ability end to end. It is the only remaining diagnostic in an otherwise clean `jac check` across all 25 Jac files, and it is accepted deliberately in exchange for a testable mint boundary.
