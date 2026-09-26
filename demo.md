<!-- demo.md -->
<!-- Purpose: Interactive demonstration scenarios and verification walkthroughs -->
<!-- Owner walker/module: shared -->
<!-- Spec: see PRD §11 -->
<!-- Status: SCAFFOLD — no logic implemented -->

# PoRJE Demo Scenarios & Runbook

This runbook guides operators and evaluators through demonstrating PoRJE's three canonical execution paths: Happy Path, Yellow Path, and Unknown/Red Path.

<!-- TODO: paste PRD §11 content -->

## 1. Happy Path (Green)
- **Scenario**: Live, fresh oracle observations and 100%+ reserve coverage.
- **Expected Outcome**: Freshness and Cover return green; Auditor produces green Stamp; Act walker executes on-chain mint and records attestation.

## 2. Yellow Path (Warning)
- **Scenario**: Marginal reserve coverage or minor observation delay within warning tolerance.
- **Expected Outcome**: Freshness or Cover returns yellow; Auditor issues yellow Stamp; Act walker halts minting per policy unless overridden; Counsel offers mitigation advice.

## 3. Unknown Path (Failure / Circuit Breaker)
- **Scenario**: Missing child claims, flatline/stale oracle feeds, or undercollateralized reserves.
- **Expected Outcome**: Audit fails with red/unknown Stamp; Mint button locked; Counsel details exact invariant violation.

## 4. Reset Procedure
- Command to purge simulation state and re-seed clean Asset/Liability graph nodes.
