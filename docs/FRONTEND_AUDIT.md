# Frontend Audit

Phase 10 of `Audit/AuditTestPrompt2`.

**Stack:** Next.js 14.2.0, React 18.3.0, React Flow 11.11.0, Tailwind 3.4.4,
TypeScript 5.4.5. Node v24.14.1, npm 11.17.0.

**Tree audited:** `POR_Jac_Enforced` (git tree) for source and build; the live
API calls in §10.5/§10.6 were made against the running backend in
`/home/grams121/porje`.

---

## 10.1 Build succeeds - **PASS**

`cd frontend && npm install && npm run build` → **exit 0**.
(`node_modules` was already present; install was a no-op.)

```
> porje-frontend@1.0.0 build
> next build

  ▲ Next.js 14.2.0

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    51.6 kB         139 kB
└ ○ /_not-found                          871 B          87.8 kB
+ First Load JS shared by all            86.9 kB

○  (Static)  prerendered as static content

[exited with code 0]
```

Type-checking and linting run as part of `next build` and both passed - no
`any`-related type error, no lint failure. The page is statically prerendered.

---

## 10.2 The dev server serves the page - **PASS**

`next dev` → **Ready in 2.6s**, `✓ Compiled / in 3.5s (811 modules)`.

```
GET / 200 in 3735ms
```

`Invoke-WebRequest http://127.0.0.1:3123/` → **HTTP 200**, body length **13,751
bytes**. The server-rendered body contains `Proof of Reserve`, `Jac Enforced`,
`Walk`, `Cover` and `Auditor` - i.e. the shell, the walk panel, and the three
approver names are present in the initial HTML.

> **Deviation, stated plainly.** The prompt specifies port 3000. This audit ran
> the dev server on **3123** (`next dev -p 3123`) to avoid colliding with
> anything already bound to 3000 on the audit host. The result is
> port-independent - the port is passed to `next dev` and is not referenced
> anywhere in `frontend/src` or `lib/constants.ts`. No finding.

Two launch notes for the next auditor, both environmental rather than defects:

- `Start-Process npm` fails on Windows (`%1 is not a valid Win32 application`) -
  `npm` is a `.cmd` shim, not an executable. Launch
  `node node_modules/next/dist/bin/next dev -p <port>` directly.
- The port was confirmed released after the run (the audit killed the process
  and re-checked the listener).

---

## 10.3 Manual UI checklist - **DEFERRED (human click-through required)**

The prompt calls this phase "manual if npm is unavailable". npm **is** available
and the build and server both work - but the checklist item itself is "clicking
each path and confirming GraphView shows…", which requires a human at a browser.
An agent cannot click. Rather than claim a click-through that did not happen,
this is recorded as **DEFERRED** and the underlying data path is verified
directly instead.

**What was verified in place of the click-through** - that `GraphView` receives
exactly the node set the checklist names, over the real HTTP API:

Every edge `GetAsset` returns carries a `target` object tagged with `nodeType`.
A live run of the walk `Ingest → Freshness → Cover → Auditor` on the `por_live`
fixture produced:

```
GetAsset report keys: id, node_id, name, symbol, chain, token_address,
                      overall_status, created_at, edges
  edge HasPrice      -> nodeType PriceObservation   (value 1.0002, source fixture, round_id 2001)
  edge HasReserve    -> nodeType ReserveAttestation (amount 1250000.0, feed_address 0x…01, round_id 1001)
  edge DependsOn     -> nodeType ChildClaim         (source = reserve id, present true)
  edge HasLiability  -> nodeType Liability          (minted_units 1000000.0, demo_position 0.0)
  edge StampedBy     -> nodeType Stamp              walker_name Freshness, color green
  edge StampedBy     -> nodeType Stamp              walker_name Cover,     color green, payload.justified_amount 250000.0
  edge StampedBy     -> nodeType Stamp              walker_name Auditor,   color green
```

That is precisely the layout the checklist describes - Asset, then
PriceObservation + ReserveAttestation + Liability, the ChildClaim hung under the
reserve, then the three stamps - and the mapping is implemented in
`frontend/src/lib/jacClient.ts:106-176`:

| Checklist element | Implementation | Position |
|---|---|---|
| Asset at the top | `jacClient.ts:99-104` | `y=0` |
| PriceObservation, ReserveAttestation, Liability | `jacClient.ts:111-131` (non-`StampedBy` edges) | `y=200` |
| ChildClaim under its reserve | `jacClient.ts:134-153`; `parentId = e.source ?? reserveNodeId ?? asset.id` - uses the `DependsOn.source` the walker emits (`jac/walkers/ingest.jac:150`) | `y=320` |
| The three stamps | `jacClient.ts:156-176` | `y=420` |
| MintRecord after a mint | `nodeTypes.mintrecord`, `GraphView.tsx:97-106` | rendered from a `MintedAs` edge |

**Colour of the badges matches the verdict:** `GraphView.tsx:89` renders
`` `${walker_name} Decision: ${color.toUpperCase()}` `` straight from the stamp's
`color` field, and `jacClient.ts:165` labels the node `` `${walker_name}: ${color}` ``.
There is no colour transformation between the graph and the screen.

**What remains for a human:** the actual click-through - press **Happy**,
**Yellow**, **Unknown**, and confirm the rendered graph matches the table above,
and press **Mint** on the happy path. This document should not be read as
claiming that was done.

---

## 10.4 Stamps change colour in place and the graph does not re-lay-out - **PASS (by construction)**

The `jid()` stability property is visible in the code: the React Flow node id
**is** the Jac graph node id, not a positional index.

`frontend/src/lib/jacClient.ts:114`:
```ts
const nodeId = n.id ?? `${e.type}-${i}`;
```
where `n = e.target as JacNodeData & { id: string }` - the same fallback form
appears at `:138` (`child-${i}`) and `:159` (`stamp-${i}`). Because the primary
branch is `n.id` - the durable Jac node id, which the runtime reuses when a
stamp is mutated in place - a refresh after a walk re-issues nodes with the
**same ids**. React Flow reconciles by id and preserves node positions.

The "in place" half is a property of the walkers, not the UI: `Cover`,
`Freshness` and `Auditor` upsert their stamp rather than deleting and recreating
it (`jac/walkers/cover.jac:91-111` - "Upsert this walker's stamp - exactly one
Cover stamp per asset"), so a path change mutates `color`/`reasons` on the
existing node and the node id is unchanged. The fallback `?? \`stamp-${i}\`` is
only reachable if a node arrives without an id, which the live payload does not
do.

`docs/demo-runbook.md` lists the confirming manual step ("refresh and confirm the
graph nodes do not move") as part of the operator click-through; that
observation was not performed by this audit.

---

## 10.5 The walker trace is observable for the path being run - **PASS**

Verified against the **live server**, not only under `jac test`. The backend was
started with `PORJE_TRACE=1`, the happy path was walked over HTTP one walker per
request, and the server log was then read:

```
TRACE lines with PORJE_TRACE=1: 13
    [TRACE] Freshness: Asset ->:HasPrice:-> PriceObservation (1 found)
    [TRACE] Freshness: Asset ->:HasReserve:-> ReserveAttestation (1 found)
    [TRACE] Freshness: read PriceObservation(ts=1790486187, source=fixture)
    [TRACE] Freshness: read ReserveAttestation(ts=1790486169, source=fixture)
    [TRACE] Cover: Asset ->:HasPrice:-> PriceObservation (1 found)
    [TRACE] Cover: Asset ->:HasReserve:-> ReserveAttestation (1 found)
    [TRACE] Cover: Asset ->:HasLiability:-> Liability (1 found)
    [TRACE] Cover: ReserveAttestation ->:DependsOn:-> ChildClaim (1 found)
    [TRACE] Auditor: Asset ->:HasPrice:-> PriceObservation (1 found)
    [TRACE] Auditor: Asset ->:HasReserve:-> ReserveAttestation (1 found)
    [TRACE] Auditor: Asset ->:HasLiability:-> Liability (1 found)
    [TRACE] Auditor: ReserveAttestation ->:DependsOn:-> ChildClaim (1 found)
    [TRACE] Counsel: Asset ->:StampedBy:-> Stamp (3 found)
```

The trace names the **actual edges traversed**, per walker, in walk order - the
same traversal the UI animates (`GraphView.tsx:112` "Edge types the walker
currently on screen traverses. These animate."). Trace is off by default:
`PORJE_TRACE` unset produced **0** trace lines (Phase 4.1).

---

## 10.6 The response envelope is `{ok, data: {reports: [...]}}` - **PASS**

Captured from the live server, `POST /walker/GetAsset/{nodeId}`:

```
ENVELOPE top-level keys: ['data', 'error', 'ok', 'type']
ENVELOPE ok = True
ENVELOPE data keys = ['reports', 'result']
ENVELOPE data.reports is list = True
```

The prompt's shape is confirmed, with two additions the prompt does not mention
and which are harmless: a top-level `type`, and `data.result` alongside
`data.reports`.

The frontend extracts `reports` correctly - `frontend/src/lib/jacClient.ts:11-15`
declares the envelope as `{ok?, error?, data?: {reports?: unknown[]}}`, and
`:41-45` unwraps it:

```ts
const data = (await res.json()) as JacEnvelope;
if (data.ok === false) {
  throw new Error(`Walker ${name} refused: ${JSON.stringify(data.error)}`);
}
return data.data?.reports ?? [];
```

A refusal (`ok === false`) is surfaced as a thrown error rather than being read
as an empty result - which is the fail-closed behaviour the product requires.

---

## 10.7 No hardcoded addresses - **FAIL as literally written; intent satisfied**

`grep -rnE '0x[0-9a-fA-F]{6,}' frontend/src` returns **exactly one** match:

```
frontend/src/app/page.tsx:161:          recipient: '0x748ABdeF0775132E8F941e1513152D5eb02D3a4B',
```

The criterion is: *"Every occurrence must be either a placeholder (all zeros) or
come from `process.env`."* This occurrence is **neither** - it is a hardcoded,
non-zero, well-formed address with no `process.env` behind it. **The literal
criterion fails.**

The criterion's stated purpose is the next sentence: *"No deployed address may
be committed."* **That holds.** The literal is a mint **recipient**, not a
deployed contract. Every deployed address is externalised:

```ts
frontend/src/app/page.tsx:162:  token_address: process.env.NEXT_PUBLIC_POR_TOKEN_ADDRESS ?? '',
frontend/src/app/page.tsx:164:  attestation_address: process.env.NEXT_PUBLIC_POR_ATTESTATION_ADDRESS ?? '',
frontend/src/lib/constants.ts:  JAC_CLOUD_URL (backend URL, not an address)
```

No `PoRToken` or `PoRAttestation` deployment address appears anywhere in
`frontend/src`. The one `feed_address` seen in payloads
(`0x000…001`) comes from the fixture, not from source.

**Judgement:** the intent is met and the literal test is too narrow - it cannot
distinguish a committed *contract deployment* (the thing that must never be
committed) from a committed *recipient* (a demo constant). Recording it as a
**criterion defect**, not a product defect. See `Audit/AUDIT.md` §12.10.

---

## 10.8 The hardcoded-recipient limitation - **premise does not hold; documentation is stale**

The prompt states the condition: *"if `page.tsx` hard-codes the zero address as
the mint recipient, the UI mint path CANNOT succeed as shipped."*

**`page.tsx` does not hard-code the zero address.** `frontend/src/app/page.tsx:161`
holds `0x748ABdeF0775132E8F941e1513152D5eb02D3a4B` - 20 bytes, non-zero, a
well-formed address. The conditional premise is false, so the stated consequence
does not follow: the UI mint path is **not** blocked by the recipient.

This was checked against the committed revision as well as the working tree, in
case the working tree had been changed after the docs were written:

```
$ git show HEAD:frontend/src/app/page.tsx | grep -n recipient
161:          recipient: '0x748ABdeF0775132E8F941e1513152D5eb02D3a4B',
$ grep -n recipient frontend/src/app/page.tsx
161:          recipient: '0x748ABdeF0775132E8F941e1513152D5eb02D3a4B',
```

Identical. The non-zero recipient is what is committed.

**Finding F-1 (documentation defect, not a product defect).** Two documents
assert the opposite:

- `demo.md:10` - *"the UI mint cannot succeed as shipped because the recipient is
  hard-coded to the zero address - mint from the CLI, or apply the one-line fix
  in the runbook."*
- `docs/demo-runbook.md:341` - *"confirm the refusal is displayed (hard-coded zero
  recipient - see above) rather than a silent no-op."*

Both are **stale**. An operator following the runbook will expect a refusal on
the **Mint** click and will instead get a real mint attempt - sending a
transaction, or failing with an EVM error if the environment is not configured,
which is a different experience from the one the runbook describes.

Per the prompt's instruction - *"Report this as a finding with its file and line.
Do not silently fix it as part of the audit"* - this is reported and **not
fixed**. Reported in `docs/DOCS_AUDIT.md` (D-1) and `Audit/AUDIT.md` (§12.8).

**Residual limitation that does exist, stated accurately.** The recipient *is*
hardcoded - a demo constant, not user input. Consequences: (a) every mint from
the UI goes to one fixed address regardless of operator; (b) the address is not
configurable without editing source; (c) it is not validated against the
connected chain, so on a chain where that address is unfunded or the token
`onlyAct` signer differs, the mint will fail at the EVM layer. None of these
blocks the demo; all are worth one line in the runbook.

---

## Summary

| Item | Status |
|---|---|
| 10.1 Build succeeds | **PASS** (exit 0) |
| 10.2 Dev server serves the page | **PASS** (200, 13,751 bytes; port 3123, stated) |
| 10.3 Manual UI checklist | **DEFERRED** - requires a human at a browser; data path verified in its place |
| 10.4 Stamps recolour in place, no re-layout | **PASS** (by construction - node ids are Jac node ids) |
| 10.5 Trace observable | **PASS** (13 `[TRACE]` lines on the live server) |
| 10.6 Envelope `{ok, data:{reports}}` | **PASS** |
| 10.7 No hardcoded addresses | **FAIL literal / intent met** - one hardcoded recipient, no deployed address |
| 10.8 Hardcoded-recipient limitation | **Premise false** - recipient is non-zero; two docs stale (F-1) |

PASS condition ("build succeeds, page serves, and the checklist is completed or
DEFERRED with a reason") is met.
