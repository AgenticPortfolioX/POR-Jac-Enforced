# jac/schemas/edges.jac
# Purpose: Graph edge archetypes connecting PoR nodes
# Owner walker/module: shared
# Spec: see PRD §3.2
# Status: IMPLEMENTED — Prompt 2

edge HasPrice: any --> any {}
edge HasReserve: any --> any {}
edge DependsOn: any --> any {}
edge HasLiability: any --> any {}
edge StampedBy: any --> any {}
edge MintedAs: any --> any {}
