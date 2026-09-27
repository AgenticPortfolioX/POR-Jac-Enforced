# Documentation Audit

Phase 11 of `Audit/AuditTestPrompt2`.

Documents audited: `README.md`, `demo.md`, `docs/architecture.md`,
`docs/policy.md`, `docs/walkers.md`, `docs/demo-runbook.md`. Findings are
**reported, not fixed**, per the prompt.

Both trees carry byte-identical copies of every document in scope —
`md5sum` matched on all six (e.g. `README.md` `c85150ce`, `docs/architecture.md`
`4e8a261e`, `docs/walkers.md` `ab2a28ed`). So this audit describes both trees.

---

## 11.1 `README.md` — thesis **PASS**; six sections **PROMPT GAP**

**Thesis appears verbatim — twice.** The §5 one-sentence thesis is reproduced
character-for-character at `README.md:5` and again at `README.md:357`:

> Proof of Reserve attests that backing was reported. Proof of Reserve, Jac
> Enforced puts that attestation on a graph, requires three green stamps from
> walkers that are allowed to attack the claim, and only then mints — only as
> much as current coverage justifies — so "backed" is a permit with a quantity,
> not a text output you can quote.

The §5 tagline is also present verbatim at `README.md:3`:
**"PoR attests. Jac enforces. The printer is the proof."**

**The six sections: cannot be audited as specified — the prompt does not contain
the "README specification".** §11.1 says *"the six sections named in the README
specification are present"*, but no README specification appears anywhere in
`Audit/AuditTestPrompt2`. A search for `six` and `README` over the whole prompt
returns only §11.1 itself (line 1344-1345), §18's `Docs` row (line 673, which
lists document *filenames*, not sections), and an unrelated use of the word "Six"
about edge types (line 223).

The nearest thing to a specification is §18's `Clear problem/solution` row —
*"README opens with the gap: PoR attests; it does not decide"* — which **is**
satisfied: `README.md:13` is `## The gap: an attestation with no door`, and
`README.md:9` says *"PoR remains the sensor. This is the runtime that decides
whether the attestation is still **actionable**."*

Because the criterion is unverifiable as written, the README's actual structure
is recorded here instead, so the next revision can state which six it means:

| # | Section (`README.md`) | Line |
|---|---|---|
| 1 | The gap: an attestation with no door | 13 |
| 2 | The flow (+ "The object is a graph, not a row") | 43 |
| 3 | The gate: how a mint is permitted | 122 |
| 4 | The three paths (+ "You can watch it happen", "What the printer actually does") | 162 |
| 5 | Why this is an exceptional use of Jac (+ "The bug that taught us the semantics") | 230 |
| 6 | Proven, not asserted | 255 |
| 7 | Run it | 289 |
| 8 | Repository layout | 326 |
| 9 | Status | 343 |
| 10 | The one sentence | 355 |
| 11 | Authors & Hackathon | 359 |
| 12 | License | 363 |

No missing-section finding can be reported against a list that does not exist.
**Recorded as prompt gap PG-1** (`Audit/AUDIT.md` §12.10).

---

## 11.2 `demo.md` — **PASS**

- **Three paths documented:** `## Path 1 — Happy (all green)` (line 15),
  `## Path 2 — Yellow (stale or stuck reserve)` (line 18),
  `## Path 3 — Unknown / red (missing PoR or missing child)` (line 21). ✓
- **Pre-demo checklist present:** `## Pre-demo checklist (run 10 minutes before)`
  (line 7), with six numbered preconditions at line 8 — backend up with
  `/healthz` 200, frontend up, the `.env` keys, two browser tabs pre-opened, a
  funded deployer wallet, and no fixture mislabelled. ✓
- **"Why this is impressive" present:** `## Why this is an impressive use of
  Jac's capabilities` (line 24). ✓

**Caveat, and it is a fair one to the authors:** `demo.md:10` opens with a
self-declared staleness banner — *"Three steps in this script do not match the
current build; see Known gaps in `docs/demo-runbook.md` before presenting."*
That is honest documentation of staleness. It does not, however, make the
individual claims correct; see D-1 and D-2 below.

---

## 11.3 `docs/architecture.md` — **PASS**

- **Spawned-sibling commit semantics subsection exists:** `## Spawned-sibling
  commit semantics` at `docs/architecture.md:37`. It states the rule correctly —
  *"each child's commit re-writes the parent node's edge set from that child's
  own snapshot … The deletion is silently lost. There is no error, no warning,
  and no diagnostic — the walker reports success."* — and names the required
  pattern (upsert in place). ✓
- **Runtime described as `jac run`, not `jac start`:** `docs/architecture.md:12`
  writes the pipeline as "Jac Cloud (`jac run`)". ✓
- **No stale SQLite / `jac start` / `test_*.jac` in this document:** all three
  return **zero** matches in `docs/architecture.md`. ✓

Testability is documented at line 69 (`evm_spy` mechanism) and line 71 (the
`spy_bridge.jac` bridge), matching the implementation.

---

## 11.4 `docs/policy.md` and `docs/walkers.md` — **PASS**

**Thresholds (§10) are documented, and match the code exactly.** `docs/policy.md`
carries a JSON block plus a per-knob table. Compared against the live source,
`jac/lib/policy.jac`:

| Knob (§10) | Prompt §10 | `policy.jac` | `policy.md` |
|---|---|---|---|
| `max_price_age_seconds` | 300 | 300 | present |
| `max_reserve_age_seconds` | 3600 | 3600 | present |
| `min_coverage_ratio` | 1.00 | 1.00 | 1.00 |
| `coverage_floor_ratio` | 0.95 | 0.95 | 0.95 |
| `flat_reserve_epsilon` | 0.001 | 0.001 | 0.001 |
| `flat_reserve_windows` | 3 | 3 | 3 |
| `price_move_epsilon` | 0.005 | 0.005 | 0.005 |
| `child_max_age_seconds` | 3600 | 3600 | 3600 |
| `colors` | 4 entries | 4 entries | present |

`policy.md` also documents the colour ladder and, notably, states at line 34
that `price_move_epsilon` is **"Currently inert. Declared in `POLICY` but read by
no walker"** — an accurate, self-critical note that matches the code. Documenting
an inert knob rather than implying it works is the honest choice.

**Walker contracts (§12) are documented.** `docs/walkers.md` gives one section
per walker, covering all ten: `Ingest` (13), `Freshness` (29), `Cover` (44),
`Auditor` (62), `Act` (80), `Counsel` (100), `DemoControl` (117), `SeedAsset`
(132), `GetAsset` (146), `GetStamps` (156).

**The tx hash is documented in its `0x`-prefixed form** — `docs/walkers.md:94`
shows the Act report as
`{"minted": true, "amount": 250000.0, "justified": 250000.0, "tx": "0x…", "nft_id": 1}`,
and `:152` documents the `MintRecord` target fields including `tx_hash`.

> **Partial, stated precisely.** The `0x` prefix is shown, which is the visible
> half of D1. The document does **not** state the other half — that the hash must
> be **66 characters**, or that `web3` ≥ 6 `.hex()` returns it without the
> prefix, which is the actual trap §24 D1 exists to catch. The form is shown
> but the failure mode is not explained. Recorded as a minor gap, not a failure:
> the criterion asks that the `0x`-prefixed form be documented, and it is.

`docs/walkers.md:152` also documents the `GetAsset` edge shape accurately —
each edge carries `type` and a `target` object tagged with `nodeType`, and
`DependsOn` additionally carries `source` — which is exactly the wire format
observed live in Phase 10 (`docs/FRONTEND_AUDIT.md` §10.3).

---

## 11.5 `docs/demo-runbook.md` — **PASS**

All three requirements of §20 are present:

- **Database name derived from the project root:** lines 55-58 —
  *"Run this FROM THE PROJECT ROOT. The name is a hash of the project path"*,
  with *"Confirm the name from the project root before dropping."*
- **`jac db drop`:** line 59 — `jac db drop jac_por_jac_enforced_a3a8aeca -y`,
  and line 85 — *"`jac db drop` is the reset."* The runbook also records the
  name observed on a different path (line 91, `jac_por_jac_enforced_d72e1051`),
  which is the correct caution: the name is path-dependent, so hardcoding one
  value across machines is a footgun.
- **`rm -rf .jac/data` is a no-op, stated explicitly:** lines 82-83 —
  *"`.jac/data/` holds only `jwt_secret` — **removing it resets no graph state**,
  so `rm -rf .jac/data` (and `jac clean --data`) is a no-op for the demo."*

This matches the runtime behaviour observed in this audit: the store is Postgres
(database `jac_por_jac_enforced_a3a8aeca`), and `.jac/data` holds only the JWT
secret.

---

## 11.6 Stale-instruction sweep — **PASS on all six checks**

Swept `README.md`, `demo.md` and all of `docs/`.

| Stale pattern | Result |
|---|---|
| `cp .env.example .env` / any `.env.example` | **0 matches** — the file does not exist and is not referenced. Consistent with §21. |
| `npx hardhat compile` / any `hardhat` | **0 matches** — the repo uses Foundry (`contracts/`, `scripts/build_artifacts.py`). |
| `jac start` | **3 matches, all corrective negations — no stale instruction.** `README.md:298` *"Jac 0.37 has no `jac start`"*; `demo.md:8` *"Jac 0.37 serves with `jac run`, not `jac start`"*; `docs/demo-runbook.md:15` *"**Jac 0.37 uses `jac run`, not `jac start`.**"* Every occurrence exists to tell the reader **not** to use it. This is the desired state. |
| SQLite path | **2 matches, neither an instruction.** `docs/demo-runbook.md:182` is a historical note (*"SQLite then, Postgres now"*) in what is explicitly a changelog context; `:82` explains that `.jac/data` is a no-op, which §11.5 **requires**. No instruction sends a reader to a SQLite path. |
| `test_*.jac` naming | **0 matches.** |
| PRD section cited as a threshold source | **0 matches.** Thresholds are stated in `docs/policy.md` with their values, not deferred to an external document. |

**One adjacent observation, outside the docs.** The stale-PRD-reference
convention does survive in *source comments* in the run tree —
`frontend/src/components/GraphView.tsx:4` reads `// Spec: see PRD §12`, and
`.gitignore:4` carries `# Spec: see PRD §1`. These are code-comment provenance
tags, not threshold sources, so they fall outside §11.6. Note that the
**canonical tree's** `GraphView.tsx` no longer carries that header at all (it has
uncommitted presentation edits that removed it), so the convention is already
inconsistent between trees. Recorded as an observation, not a defect.

---

## Findings

### D-1 — `demo.md` and `docs/demo-runbook.md` claim a zero-address mint recipient that does not exist — **STALE, CONFIRMED**

**What it is.** Two documents tell the operator that the UI mint is guaranteed to
fail because the recipient is hardcoded to the zero address:

- `demo.md:10` — *"the UI mint cannot succeed as shipped because the recipient is
  hard-coded to the zero address — mint from the CLI, or apply the one-line fix
  in the runbook."*
- `docs/demo-runbook.md:341` — *"confirm the refusal is displayed (hard-coded zero
  recipient — see above) rather than a silent no-op."*

**How it was found.** Phase 10.7's `grep -rnE '0x[0-9a-fA-F]{6,}' frontend/src`
returned exactly one literal, and Phase 10.8's premise check read it:

```
frontend/src/app/page.tsx:161:          recipient: '0x748ABdeF0775132E8F941e1513152D5eb02D3a4B',
```

Non-zero, 20 bytes, well-formed. Identical in the committed revision
(`git show HEAD:frontend/src/app/page.tsx`) and the working tree.

**Severity: HIGH for the demo, zero for the product.** An operator who follows
the runbook will pre-announce a refusal and then get a real mint attempt — a
transaction, or an EVM revert if the environment is unconfigured. The demo
narration is wrong in front of an audience.

**File and line:** `demo.md:10`, `docs/demo-runbook.md:341` (claim);
`frontend/src/app/page.tsx:161` (the contradicting fact).

**Fixed?** No — the prompt requires it be reported, not fixed.

**Test that catches it?** None. Documentation claims about source constants are
not covered by the test suite, and this audit found no test that reads
`page.tsx`. This is a genuine coverage hole for a class of defect that has now
occurred once.

### D-2 — `demo.md` says the path buttons drive `DemoControl`; the UI does not — **STALE, CONFIRMED**

**What it is.** `demo.md:10` states: *"The UI has no per-walker buttons (the path
buttons drive `DemoControl`, which runs Freshness, Cover and Auditor together)."*

**How it was found.** Both halves are false against the current frontend:

- The UI **does** drive the walkers one at a time, not via `DemoControl`:
  `frontend/src/lib/constants.ts:28` defines `WALK_STEPS` and
  `frontend/src/app/page.tsx:119` iterates it, issuing one request per walker
  with a 900 ms highlight between them (`WALK_STEP_MS`, `constants.ts:61`).
- `frontend/src/lib/constants.ts:23-25` says so directly: *"The UI drives these
  one at a time rather than calling `DemoControl` … `DemoControl` still exists
  for the CLI and for tests."*
- `grep -rn DemoControl frontend/src` returns only those explanatory comments —
  there is no call site.

**Severity: MEDIUM.** It misdescribes the UI's central demo feature to the
person presenting it, and it understates the work: the visible walk is the
headline improvement of commit `682358f` ("make the walk visible").

**File and line:** `demo.md:10`; contradicted by `constants.ts:23-28`,
`page.tsx:119`.

**Fixed?** No.

### D-3 — `demo.md`'s remaining stale claim: not verified by this audit

`demo.md:10`'s third stale claim is *"Freshness stays **green** on the unknown
path rather than going unknown."* This audit did **not** execute the Unknown path
against the live server, so it is recorded here as **unverified** rather than
confirmed or contradicted. Resolving it requires walking Path 3 and reading the
`Freshness` stamp colour — a cheap check the next revision of this prompt should
require explicitly.

### Mitigating fact, recorded in the authors' favour

All of D-1 and D-2 live inside a banner at `demo.md:10` that **self-declares the
staleness**: *"Three steps in this script do not match the current build; see
Known gaps in `docs/demo-runbook.md` before presenting."* The document warns its
own reader. The defect is that the warning is not maintained — two of its three
examples have been overtaken by the code — not that the staleness is hidden.
A stale-warning list is still a maintenance burden with a single point of
failure; the durable fix is to assert the claims in a test (D-1) or to drop
claims that duplicate source constants.

---

## Summary

| Item | Status |
|---|---|
| 11.1 README thesis / six sections | Thesis **PASS** (verbatim ×2) · six sections **PROMPT GAP (PG-1)** |
| 11.2 `demo.md` | **PASS** (three paths, checklist, why-impressive) |
| 11.3 `docs/architecture.md` | **PASS** (sibling semantics, `jac run`, no stale refs) |
| 11.4 `docs/policy.md` + `docs/walkers.md` | **PASS** (thresholds match code; all 10 walkers; `0x` form shown, failure mode not explained) |
| 11.5 `docs/demo-runbook.md` | **PASS** (reset matches §20; no-op stated) |
| 11.6 Stale-instruction sweep | **PASS** (all six patterns clean; `jac start` appears only as corrections) |

PASS condition ("every document audited, with findings listed") is met.
