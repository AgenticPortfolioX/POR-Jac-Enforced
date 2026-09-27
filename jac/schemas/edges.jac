#
# Jac 0.37 edge declarations. The typed-endpoint syntax (`edge E: Src --> Dst`)
# is not supported in 0.37; bare edges produce correct traversal semantics when
# the source/target types are imported in each walker that uses the edge.
#

import from jac.schemas.nodes { Asset, PriceObservation, ReserveAttestation, ChildClaim, Liability, Stamp, MintRecord }

edge HasPrice {}
edge HasReserve {}
edge DependsOn {}
edge HasLiability {}
edge StampedBy {}
edge MintedAs {}
