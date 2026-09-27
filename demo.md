# Demo — Proof of Reserve, Jac Enforced

> Proof of Reserve attests that backing was reported. Proof of Reserve, Jac Enforced puts that attestation on a graph, requires three green stamps from walkers that are allowed to attack the claim, and only then mints — only as much as current coverage justifies — so "backed" is a permit with a quantity, not a text output you can quote.

Audience: Jack Hacks judges. Length: 4 minutes live + 1 minute Q&A. Surface: Next.js frontend at http://localhost:3000 + Etherscan tabs pre-opened.

## Pre-demo checklist (run 10 minutes before)
1. `jac run main.jac --no-client` is running and `/healthz` returns 200 (Jac 0.37 serves with `jac run`, not `jac start`; `/health` is 404 and `/docs` is the API page, not a readiness probe). 2. cd frontend && npm run dev is running. 3. .env has POR_TOKEN_ADDRESS, POR_ATTESTATION_ADDRESS, PRICE_FEED_ADDRESS, RESERVE_FEED_ADDRESS, SEPOLIA_RPC_URL — each exactly once, since python-dotenv lets a later blank duplicate win. 4. Two browser tabs pre-opened: demo UI and https://sepolia.etherscan.io/address/$POR_TOKEN_ADDRESS. 5. A wallet with Sepolia ETH unlocked for the deployer. 6. No fixture has label != "fixture".

> Three steps in this script have been updated since the initial audit; see **Known gaps** in `docs/demo-runbook.md` before presenting. The UI has no per-walker buttons — clicking a path button (Happy, Yellow, Unknown) drives the three walkers in sequence: Ingest, Freshness, Cover, Auditor. The same sequence can be triggered from the CLI via DemoControl for scripted or fallback demos. The Mint button in the UI initiates a real on-chain mint to the configured demo recipient (0x748ABdeF0775132E8F941e1513152D5eb02D3a4B). It succeeds only when all three stamps are green and the requested amount is within the justified amount computed by Cover.

## The screen
In order: Header (asset symbol, chain, token address truncated); PolicyCard (active POLICY values); GraphView (nodes and edges of the claim graph; price and reserve labeled live or fixture); StampBadge row (Freshness, Cover, Auditor); AuditorPanel (verbatim finding lines); CounselPanel (narration, disabled until three stamps exist); PathSelector (Happy, Yellow, Unknown); MintButton (disabled unless three greens; shows justified_amount); ExplorerLink (after successful mint).

## Path 1 — Happy (all green)
1. Click Happy. DemoControl seeds live-shaped fixtures. 2. Click Freshness. Badge green. Reasons appear. 3. Click Cover. Badge green. "coverage ratio 1.25 ≥ 1.0", "justified amount: 250,000 pUSD". 4. Click Auditor. Badge green. All four checklist lines appear even on pass. 5. Enter requested_amount = 1000000. Click Act. 6. UI shows minted: 250,000 pUSD. Not 1,000,000. 7. Click Counsel. Narrates. 8. Open Etherscan tx.

## Path 2 — Yellow (stale or stuck reserve)
1. Click Yellow. DemoControl seeds a flat reserve. 2. Run Freshness → Cover → Auditor. 3. Cover yellow: "flat reserve while price moved (punctual but no pulse)". 4. Click Act. Refuses. 5. Click Counsel. Speaks.

## Path 3 — Unknown / red (missing PoR or missing child)
1. Click Unknown. DemoControl drops the child attestation. 2. Run Freshness → Cover → Auditor. 3. Freshness unknown. Cover red. Auditor red. 4. Click Act. Refuses. 5. Click Counsel. Names the hole.

## Why this is an impressive use of Jac's capabilities
"In Jac, data and compute are the same graph. Here, the claims are nodes, the walkers are the compute, the stamps are the verdicts, and the mint is a walker that reads the verdicts. We did not build a dashboard that queries a database. We built a graph that carries its own policy, its own auditors, and its own printer." Concretely: (1) Graph-native policy — approvals are Stamp nodes on the Asset. (2) Walker-scoped authority — Act is the only walker imported into the EVM bridge. (3) Blind explainer — Counsel refuses to speak until three stamps exist. (4) Adversarial visibility — Auditor writes findings even on green. (5) Sized printing — mint = min(requested, justified_by_coverage). (6) Durable on-chain record — PoRAttestation stores stamps, times, coverage.

## Post-demo pointer
Open docs/architecture.md and docs/policy.md. Both fit on one screen.
