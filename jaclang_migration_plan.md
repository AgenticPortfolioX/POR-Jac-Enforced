# Jaclang (v0.34+) Refactoring Plan

The purpose of this document is to outline the exact steps required to upgrade our legacy Jaseci 1 (v0.13.5) codebase to the modern Jaclang (Jaseci 2, v0.34+) architecture so that it is fully compatible with Jachammer.ai.

Jaclang (.34+) is a ground-up rewrite that abandons the custom virtual machine of 0.13.5 in favor of compiling directly to native Python AST. This requires a structural overhaul of the `.jac` files.

## Phase 1: Environment & Tooling Modernization
- **Initialize Jaclang Project:** Set up the directory structure as a modern Jaclang project.
- **`jac.toml` Update:** Pin the specific `jac-version = "0.34.6"` (or latest) in `jac.toml` to signal to Jachammer how to compile our Pod.
- **Python Native Integration:** Because Jaclang runs natively in Python, we will verify the virtual environment configuration to ensure dependencies like `web3` are installed alongside the `jaclang` package.

## Phase 2: Schema & Type Definitions (`jac/schemas/`)
Modern Jaclang introduces strict Python-like classes and typing for graph elements.
- **Refactor `nodes.jac` & `edges.jac`**:
  - Convert untyped nodes (`node Asset { has name; }`) into strongly typed classes:
    ```jac
    node Asset {
        has name: str;
        has reserve_feed: str;
        # ...
    }
    ```
  - Define edges with proper class syntax.

## Phase 3: Python Interoperability (`jac/lib/`)
One of the massive benefits of Jaclang is that it no longer requires clunky "action bridges" to run Python. You can just natively import Python.
- **Refactor `evm_py.py` and `chainlink_py.py`**:
  - Either rewrite the Web3 interaction natively inside `.jac` files using `import:py from web3 { Web3 };`.
  - OR keep the helper functions but import them cleanly into Jac using `import:py from jac.lib.evm_py { read_price_feed };` instead of the legacy action loading system.

## Phase 4: Walker Refactoring (`jac/walkers/`)
This is the most significant syntax shift. Walkers in Jaclang behave like object-oriented classes with method hooks for node entries.
- **Convert all Walkers (`ingest.jac`, `cover.jac`, `auditor.jac`, etc.)**:
  - Replace legacy blocks (`root { ... }`, `Asset { ... }`) with `can` ability hooks:
    ```jac
    walker Ingest {
        has asset_address: str;
        
        can step_root with `root entry {
            # Root logic here
        }
        
        can step_asset with Asset entry {
            # Asset logic here
        }
    }
    ```
- **Graph Traversal Updates**:
  - Replace legacy `spawn here ++> node::Asset;` with object instantiation: `here ++> Asset(name="...", ...);`
  - Replace legacy edge deletions (`del edge here ->:StampedBy: old_stamp;`) with modern Jaclang edge deletion methods.
  - Update all graph filtering expressions (e.g. `[here -->](?Stamp)` to modern comprehension/filters).

## Phase 5: Main Entrypoint & Setup (`jac/main.jac`)
Jachammer explicitly looks for an entrypoint (usually `main.jac` or specified in `jac.toml`).
- Rewrite `main.jac` to serve as the unified import hub.
- Create explicit `@test` blocks or standard endpoints that Jachammer can bind to its UI buttons.

## Phase 6: Tests (`jac/tests/`)
- Convert legacy test suites in `jac/tests/` to use the Jaclang native `@test` annotation framework.
- Ensure the Mock EVM bridges (like `evm_spy.py`) correctly interface with the new Jaclang native python runner.

---

### Execution Protocol
When approved, we will proceed systematically, folder by folder, refactoring the files, running `jac test` or `jac run` locally to confirm the AST compiles cleanly in the modern environment before moving on to the next phase.
