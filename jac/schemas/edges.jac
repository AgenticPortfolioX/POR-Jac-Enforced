#
# Jac 0.37 requires every edge to declare its endpoints. A bare `edge E {}` is
# E2086, and declaring `any --> any` (the 0.13.5-compatible widening) makes every
# traversal through the edge yield Unknown-typed nodes — attribute reads then warn
# W1051 and passing them to a typed parameter fails E1053.
#
# Declaring the real endpoints is the durable fix: `[src ->:E:->]` infers the
# target type from the declaration, so no per-read `[?:NodeType]` narrowing is
# needed anywhere in the walkers. Directions below are taken from the actual
# creation sites (`src +>: E() :+> dst`), not from the edge names.

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord }

edge HasPrice: Asset --> PriceObservation {}
edge HasReserve: Asset --> ReserveAttestation {}
# Declared on the reserve, not the asset: ingest wires `reserve_node +>: DependsOn() :+> child_node`.
edge DependsOn: ReserveAttestation --> ChildClaim {}
edge HasLiability: Asset --> Liability {}
edge StampedBy: Asset --> Stamp {}
edge MintedAs: Asset --> MintRecord {}
