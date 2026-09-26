# jac/walkers/ingest.jac
# Purpose: Ingest live oracle data feeds and fixture inputs into graph
# Owner walker/module: Ingest
# Spec: see PRD §6.1
# Status: SCAFFOLD — no logic implemented

walker IngestWalker {
    has source: str = "live";
    has fixture_name: str = "";

    can ingest with `root() entry {
        # TODO: implement per PRD §6.1
    }
}

# Report shape: {"status": str, "nodes_created": int, "timestamp": int}
