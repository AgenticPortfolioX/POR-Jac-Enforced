// frontend/src/lib/types.ts
// Purpose: TypeScript types mirroring Jac node schemas and edge definitions
// Owner walker/module: shared
// Spec: see PRD §3.1, §3.2
// Status: SCAFFOLD — no logic implemented

export type HealthColor = 'green' | 'yellow' | 'red' | 'unknown';

export interface Asset {
  asset_id: string;
  symbol: string;
  total_reserves: number;
  status: HealthColor;
  last_updated: number;
}

export interface PriceObservation {
  feed_address: string;
  value: number;
  round_id: number;
  timestamp: number;
  status: HealthColor;
}

export interface ReserveAttestation {
  feed_address: string;
  amount: number;
  round_id: number;
  timestamp: number;
  provenance: string;
  status: HealthColor;
}

export interface ChildClaim {
  asset_id: string;
  amount: number;
  timestamp: number;
  present: boolean;
  provenance: string;
  status: HealthColor;
}

export interface Liability {
  liability_id: string;
  token_address: string;
  total_minted: number;
  target_coverage: number;
  last_audited: number;
}

export interface Stamp {
  stamp_id: string;
  color: HealthColor;
  freshness_score: number;
  coverage_ratio: number;
  reason: string;
  timestamp: number;
}

export interface MintRecord {
  tx_hash: string;
  recipient: string;
  amount: number;
  coverage_at_mint: number;
  timestamp: number;
  status: string;
}

export type EdgeType =
  | 'HasObservation'
  | 'HasAttestation'
  | 'HasChildClaim'
  | 'EvaluatesLiability'
  | 'ProducesStamp'
  | 'ResultsInMint';
