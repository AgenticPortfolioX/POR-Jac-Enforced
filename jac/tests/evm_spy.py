import sys
import os

# Ensure the project root is on the path so we can import the SAME module object
# that jac/walkers/act.jac holds (jac.lib.evm_py). Patching a differently-resolved
# copy of the module would silently fail to intercept Act's calls.
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import jac.lib.evm_py as _evm_py_module

_mint_calls = []
_attestation_calls = []
_original_mint = None
_original_attestation = None


def _spy_mint(*args, **kwargs):
    _mint_calls.append((args, kwargs))
    return "0xspy"


def _spy_attestation(*args, **kwargs):
    _attestation_calls.append((args, kwargs))
    return 999


def install():
    global _original_mint, _original_attestation
    _original_mint = _evm_py_module.mint
    _original_attestation = _evm_py_module.mint_attestation
    _evm_py_module.mint = _spy_mint
    _evm_py_module.mint_attestation = _spy_attestation


def uninstall():
    global _original_mint, _original_attestation
    if _original_mint is not None:
        _evm_py_module.mint = _original_mint
    if _original_attestation is not None:
        _evm_py_module.mint_attestation = _original_attestation


def reset():
    global _mint_calls, _attestation_calls
    _mint_calls = []
    _attestation_calls = []


def mint_call_count() -> int:
    return len(_mint_calls)


def attestation_call_count() -> int:
    return len(_attestation_calls)


def last_mint_args() -> list:
    """Return the positional args of the most recent mint call, or [] if none."""
    if _mint_calls:
        return list(_mint_calls[-1][0])
    return []
