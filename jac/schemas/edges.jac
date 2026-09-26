# jac/schemas/edges.jac
# Purpose: Graph edge definitions connecting PoR nodes
# Owner walker/module: shared
# Spec: see PRD §3.2
# Status: SCAFFOLD — no logic implemented

edge HasObservation {
    has created_at: int = 0;
}

edge HasAttestation {
    has created_at: int = 0;
}

edge HasChildClaim {
    has created_at: int = 0;
}

edge EvaluatesLiability {
    has evaluated_at: int = 0;
}

edge ProducesStamp {
    has produced_at: int = 0;
}

edge ResultsInMint {
    has minted_at: int = 0;
}
