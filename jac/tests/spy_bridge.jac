# jac/tests/spy_bridge.jac
# Purpose: Thin Jac bridge exposing evm_spy functions to Jac test suite
# Owner walker/module: Act (test support)
# Spec: see PRD §10
# Status: IMPLEMENTED — Prompt 10

import from jac.tests.evm_spy { install, uninstall, reset, mint_call_count, attestation_call_count, last_mint_args }

def spy_install() {
    install();
}

def spy_uninstall() {
    uninstall();
}

def spy_reset() {
    reset();
}

def spy_mint_call_count() -> int {
    return mint_call_count();
}

def spy_attestation_call_count() -> int {
    return attestation_call_count();
}

def spy_last_mint_args() -> list[any] {
    return list(last_mint_args());
}
