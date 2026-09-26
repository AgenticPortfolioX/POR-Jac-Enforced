<!-- README.md -->
<!-- Purpose: Project overview, architecture, and developer onboarding -->
<!-- Owner walker/module: shared -->
<!-- Spec: see PRD §10 -->
<!-- Status: SCAFFOLD — no logic implemented -->

# Proof of Reserve — Jac Enforced (PoRJE)

Proof of Reserve — Jac Enforced (PoRJE) is an intelligent, policy-governed Proof of Reserve verification and mint-control system. Built on Jac Cloud and integrated with Chainlink AggregatorV3 oracles and EVM smart contracts, PoRJE coordinates deterministic, explainable multi-agent graph walkers (`Freshness`, `Cover`, `Auditor`, `Act`, and `Counsel`) to guard token issuance against undercollateralization, oracle staleness, and data anomalies.

<!-- TODO: paste PRD §10 content -->

## Overview
- **Jac Graph Core**: Expresses assets, liabilities, oracles, and attestations as native nodes and relational edges.
- **Enforced Walkers**: Independent verification walkers assess staleness, solvency ratios, and policy invariants before granting audit stamps.
- **EVM Actuation**: Smart contract minting is only executable upon cryptographic and stateful approval from the green stamp pipeline.
- **Interactive UI**: Real-time graph visualization, policy inspections, and demo scenarios.

## Quickstart
1. Install Python dependencies: `pip install -r requirements.txt`
2. Start Jac Cloud server: `npm run jac:serve`
3. Launch frontend dashboard: `npm run frontend:dev`
