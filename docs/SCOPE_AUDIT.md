# Scope Audit

Phase 9 of `Audit/AuditTestPrompt2`. Two assertions are audited here: that the
eight out-of-scope items in §17 are **absent**, and that the nine hackathon
criteria in §18 are **satisfied**.

Every line carries a command and its result. An item with no evidence is not
audited.

**Tree audited:** `/home/grams121/porje` (the 0.37.23 run tree - the only tree
that compiles; see `Audit/AUDIT.md` §12.9 "Tree divergence"). All commands were
run from the project root, as Jac requires.

---

## 1. Out-of-scope items - asserted ABSENT

| # | Item (§17) | Status | Evidence |
|---|-----------|--------|----------|
| 1 | CCIP or any cross-chain send | not present | `grep -ril ccip jac contracts scripts fixtures frontend/src docs README.md demo.md` → **0 files**. `grep -ril LayerZero …` → **0**. `grep -ril Wormhole …` → **0**. `grep -rilE 'sendToChain\|destination.chain' …` → **0**. |
| 2 | Destination-chain policy | not present | Same sweep: the only `destination`-family hits are `DependsOn` targets and React Flow edge targets - no chain-routing config, no per-destination policy table. `grep -rilE 'sendToChain\|destination.chain'` → **0**. |
| 3 | A general recursive child-walker engine (exactly ONE child hop ships) | not present | `grep -rn 'DependsOn()' jac/walkers/*.jac` → **exactly 1** construction site, `jac/walkers/ingest.jac:150` (`reserve_node +>: DependsOn() :+> child_node;`). `grep -rn 'DependsOn' jac/walkers/*.jac \| grep -c 'child_node ->:DependsOn'` → **0** - nothing walks a hop outward from a `ChildClaim`, so the graph is exactly one hop deep. |
| 4 | A live custom graph UI beyond `GraphView` | not present | `ls frontend/src/components/*.tsx` → 8 components; exactly **one** renders a graph: `GraphView.tsx`. Graph library imports: `grep -rn 'reactflow' frontend/src` → `app/page.tsx:10`, `components/GraphView.tsx:15,16`, `lib/jacClient.ts:7`, `lib/types.ts:7` - a single library (React Flow) behind a single component. No second renderer, no bespoke canvas renderer. |
| 5 | Any replacement for Chainlink's cryptographic attestation | not present | No attestation-verification module exists. `jac/lib/chainlink_py.py` **reads** `AggregatorV3Interface` (`latestRoundData`) - it consumes Chainlink, it does not replace it. `README.md:9` states it explicitly: "It does not replace Chainlink Proof of Reserve. PoR remains the sensor." No signature-verification code, no Merkle/attestation-verifier contract: `ls contracts/*.sol` → `PoRToken.sol`, `PoRAttestation.sol` only. |
| 6 | Any path that produces `source="live"` from a fixture | not present | All **7** fixtures declare `"source": "fixture"`: `child_missing.json`, `child_stale.json`, `por_flat.json`, `por_live.json`, `por_stale.json`, `price_live.json`, `price_stale.json` (`grep -o '"source"[[:space:]]*:[[:space:]]*"[^"]*"' fixtures/*.json`). The string `"live"` is set only in the **live-feed** branch, `jac/walkers/ingest.jac:47,54`, which is reached when `live: True`, never from a fixture. Enforced by test: `jac/tests/invariants_tests.jac:150,154,158` assert `str(<node>.source) != "live"` for price, reserve and child after a fixture ingest. |
| 7 | A public mint on `PoRToken` (only `Act` may mint) | not present | `grep -rn 'function mint' contracts/*.sol` → 2 declarations. `contracts/PoRToken.sol:30`: `function mint(address to, uint256 amount, string calldata reason) external onlyAct` - guarded by the `onlyAct` modifier, not `public`, not unguarded. The other is `contracts/PoRAttestation.sol:32` `mintAttestation(...)` `external onlyOwner`. Neither is callable by an arbitrary account. |
| 8 | A fourth approval walker (three stamps is the invariant) | not present | `grep -hn 'walker:pub' jac/walkers/*.jac` → 10 walkers: `Act`, `Auditor`, `Counsel`, `Cover`, `DemoControl`, `Freshness`, `GetAsset`, `GetStamps`, `Ingest`, `SeedAsset`. The approval set is exactly **three** - `Freshness`, `Cover`, `Auditor` - confirmed at runtime by the trace: `[TRACE] Counsel: Asset ->:StampedBy:-> Stamp (3 found)`, and by `jac/walkers/act.jac:22` `required = ["Freshness", "Cover", "Auditor"]`. `Act` is the spender (it holds the mint capability), not a fourth approver; `Counsel` narrates, `DemoControl` orchestrates, `GetAsset`/`GetStamps`/`SeedAsset` are read/seed endpoints. |

**Result: 8 of 8 absent, each with a command and a result.**

### Note on the `bridge` search term

`grep -ril bridge …` returns 11 files, which looks like a cross-chain hit. It is
not. Every occurrence is one of three things:

- **the EVM bridge module** - `jac/lib/evm_py.py` and its prose description in
  `docs/architecture.md:7,32,61,69,71`, `README.md:98,124,235`, `demo.md:25`
  ("`Act` is the only walker that imports the EVM bridge");
- **the test double for that module** - `jac/tests/spy_bridge.jac`, imported by
  `health_tests.jac`, `act_tests.jac`, `paths_tests.jac`, `invariants_tests.jac`,
  and referenced by `scripts/verify_sizing.py:131`;
- **an unrelated English verb** - `scripts/build_artifacts.py:4` ("This script
  bridges the two").

None is a cross-chain bridge protocol. Corroborated by the `ccip` / `LayerZero` /
`Wormhole` / `sendToChain` sweeps, all zero.

---

## 2. Hackathon criteria - asserted SATISFIED

| Criterion (§18) | Status | Evidence |
|-----------------|--------|----------|
| **Uses Jac meaningfully** - graph-native claims, one walker per authority, verdicts as nodes | satisfied | Claim types are declared Jac nodes: `jac/schemas/nodes.jac` (`Asset`, `PriceObservation`, `ReserveAttestation`, `ChildClaim`, `Liability`, `Stamp`, `MintRecord`). Ten `walker:pub` walkers, one capability each. Verdicts are graph nodes, not return values: `jac/walkers/cover.jac:102-111` constructs a `Stamp` and attaches it via `StampedBy`; `jac/walkers/act.jac:107` attaches `MintedAs`. Each walker declares `can run with Asset entry`, so traversal - not a function call - is what triggers computation. |
| **Novel use of Jac** - turns PoR from a feed into a graph of actionable claims with a locked printer | satisfied | The feed value becomes a node with provenance (`ingest.jac`), the graph is walked by three independent approvers, and the printer is gated on the resulting stamps: `act.jac:22-32` refuses unless all three `StampedBy` stamps are present and green. `act.jac:35` `amount = min(requested, justified)` - the printer is locked to current coverage. |
| **Ambitious but real** - on-chain mint, ERC-20 + ERC-721, three walkers + adversarial auditor, sized mint | satisfied | ERC-20: `contracts/PoRToken.sol`. ERC-721: `contracts/PoRAttestation.sol`. Three approvers plus `Auditor`, which attacks the claim (`docs/walkers.md` Auditor section; findings written even on green). Sized mint executed live on chain 31337: justified 250000.0, requested 1000000.0, minted **250000.0**, tx `0xd572f287ce65d1218a0df442612ab544c1b2d85db79e3f80f3b95b7b336027eb`, `nft_id` 1 - full transcript in `Audit/AUDIT.md` §12.5. |
| **Integrates external system** - Chainlink `AggregatorV3Interface` via web3.py | satisfied | `jac/lib/chainlink_py.py` reads `AggregatorV3Interface` (`latestRoundData`, `decimals`) through `web3.py`. Feed addresses are configuration (`PRICE_FEED_ADDRESS`, `RESERVE_FEED_ADDRESS`); the live branch is `jac/walkers/ingest.jac:47,54`. Negative case proven: with feeds unconfigured, ingest returns `{"error": "feed_addresses_missing"}` and writes nothing (`scripts/verify_por_feeds.py`, live branch). |
| **Clear problem/solution** - README opens with the gap: PoR attests; it does not decide | satisfied | `README.md:13` `## The gap: an attestation with no door`. `README.md:9`: "PoR remains the sensor. This is the runtime that decides whether the attestation is still **actionable**." Thesis stated verbatim at `README.md:5`. |
| **Live demo works** - three paths triggerable from the UI, with traversal trace on screen | **satisfied (with one documented caveat)** | Paths: `demo.md` §"Path 1 - Approved", §"Path 2 - Caution", §"Path 3 - Unknown / red"; driven in code by `frontend/src/lib/constants.ts:28` `WALK_STEPS` and `frontend/src/app/page.tsx:119` (one walker per request, `WALK_STEP_MS = 900`). Trace on screen: `page.tsx:48` "The walk, made visible", rendered at `page.tsx:212-250` with per-walker verdicts, `GraphView` highlighting `activeWalker` (`GraphView.tsx:140-147`). Server-side trace verified live: `PORJE_TRACE=1` produced **13 `[TRACE]` lines** naming the edges each walker traversed. Caveat: the docs claim the UI mint cannot succeed (§"Known gaps"); that claim is **stale** - see `docs/DOCS_AUDIT.md` finding D-1. |
| **Honest about scope** - one child hop ships; more hops stated as the generalization | satisfied | Exactly one `DependsOn` construction site (`ingest.jac:150`); no nested hop (item 3 above). `demo.md:10` and `docs/demo-runbook.md` §"Known gaps" state the UI's limits openly rather than presenting them as complete. |
| **Durable proof** - the mint emits an ERC-721 record readable on an explorer after the talk | satisfied (on a chain with an explorer) | `contracts/PoRAttestation.sol` mints the record: `mintAttestation(...)` returns `tokenId`, and `AttestationMinted` carries `(tokenId, mintedAmount, stampSummary)`. Verified live: `nft_id 1`, record fields `mintedAmount`/`coverageUsed` = `250000000000000000000000`, `priceTime` 1790483828, `reserveTime` 1790483810, three-green `stampSummary`. **On chain 31337 (local Anvil) there is no block explorer** - that is a property of the chain, not a defect; on Sepolia the same record is readable at `https://sepolia.etherscan.io`. Stated plainly rather than papered over. |
| **Docs** - README, demo.md, docs/architecture.md, docs/policy.md, docs/walkers.md, AUDIT.md | satisfied | All six exist. Verified: `README.md` (17,767 b), `demo.md` (4,089 b), `docs/architecture.md` (12,825 b), `docs/policy.md` (5,559 b), `docs/walkers.md` (13,092 b), `Audit/AUDIT.md`. Contents audited in `docs/DOCS_AUDIT.md`. |

**Result: 9 of 9 satisfied, one with a documented caveat.**

---

## 3. Scope boundary - where the two trees disagree

This audit ran against `/home/grams121/porje`. The git tree
`POR_Jac_Enforced` is in a pre-migration state and does **not** satisfy item
"Uses Jac meaningfully" as written, because it does not compile: `jac check`
there fails with **6 × E2086** ("Edge declares no endpoints") - its
`jac/schemas/edges.jac` still declares bare edges (`edge HasPrice {}`) where the
run tree declares typed edges (`edge HasPrice: Asset --> PriceObservation {}`).

The scope assertions above therefore describe the run tree. They are **not**
claims about the git tree as it currently stands. See `Audit/AUDIT.md` §12.9.
