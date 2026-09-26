# Proof of Reserve, Jac Enforced

**PoR attests. Jac enforces. The printer is the proof.**

> Proof of Reserve attests that backing was reported. Proof of Reserve, Jac Enforced puts that attestation on a graph, requires three green stamps from walkers that are allowed to attack the claim, and only then mints — only as much as current coverage justifies — so "backed" is a permit with a quantity, not a text output you can quote.

Proof of Reserve, Jac Enforced is a Jac protocol that takes a Chainlink Proof of Reserve attestation and turns it into something a system can actually use: a graph of claims, three independent approvals, and a mint that is allowed only when all three are green — and only in the amount current coverage justifies.

This is not an oracle project. It does not replace Chainlink Proof of Reserve. PoR remains the attestation: backing was reported. This product is the runtime that decides whether that attestation is still actionable, and then either prints the asset or refuses in public.

## The problem
Chainlink Proof of Reserve already does the hard job. It publishes that, at a given time, an attested reserve amount existed for an asset. That output is a fact. In practice most applications treat it as a badge. A reserve number is read and shown. Nothing has to happen because of it. A price can be live while the reserve attestation is old; both screens can still look fine. A reserve feed can keep posting a new timestamp while the amount never moves as the market does — a heartbeat with no pulse. Backing is often a chain of claims: this asset is backed by that, and that is itself a claim. A missing or stale child still leaves the parent looking attested. Vaults, mints, collateral listings, and basket legs inherit "backed" without walking what sits underneath. Missing Proof of Reserve is usually an empty field, not a hard stop. So PoR today is strong as an attestation and weak as a protocol primitive. It is text (or a feed) you can point at. It is not a door you have to pass through, and it does not decide how much may be printed.

## The solution
Keep Chainlink's attestation as the sensor. Add a Jac workflow that the attestation must survive before money can be printed. The object of the system is not a row in a table. It is a graph of claims: the asset whose printer we control; a price observation (value + time + live vs fixture); a reserve attestation (amount + time + live vs fixture); at least one child claim when the reserve itself depends on something else; and dependents that would inherit this asset's "backed" status if we let them. Walkers move across that graph. Each walker has one job. None of the first three may mint. The mint walker is locked until three stamps are green. When it mints, it does not mint a souvenir amount. It mints what current coverage justifies, and it leaves an on-chain record of why. PoR attests. Jac enforces. The printer is the proof.

## Why better than PoR alone
PoR alone: publishes a reserve at a time; display/integration snippet; one asset one number; freshness optional; no stuck-but-punctual reserve; missing feed is empty UI; you write your own adapter. PoRJE: decides if actionable; a workflow ending in mint or visible refuse; a backing graph (parent, child, dependents); freshness is a stamp; unchanged reserve while price moved is a finding; missing PoR is unknown; the permit, size, refuse, and explanation are the product.

## Why an exceptional use of Jac
Jaseci's point is data and compute are the same graph. Claims are nodes. Walkers have one authority each (Freshness looks at clocks; Cover computes coverage; Auditor attacks; Act is the only spender; Counsel is a mouth). Verdicts are written onto the graph, not held in a chat. The explainer is blind until writes exist. The only spender is a walker that reads the stamps. You do not glue a dashboard to a bot. You walk an attestation until it is allowed to print.

## Why Chainlink Proof of Reserve
PoR is the sensor. It already publishes attested reserve amounts. This project does not replace it — it makes it actionable. The PoR feed is read directly through AggregatorV3Interface; fixtures are labeled as fixtures and never costumed as live.

## Demo
See demo.md for the exact three-path demonstration and operator runbook.

## Repository layout
jac/ — Jac Cloud project. contracts/ — PoRToken (mint locked to Act) and PoRAttestation. frontend/ — Next.js demo surface. fixtures/ — schema-faithful JSON inputs.

## License
MIT.
