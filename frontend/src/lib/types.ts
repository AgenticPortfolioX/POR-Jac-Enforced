import type { Node, Edge } from 'reactflow';

export interface JacAsset {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  token_address: string;
  overall_status: string;
  created_at: number;
  edges: JacEdge[];
}

export interface JacEdge {
  type: string;
  source?: string;
  target: JacNodeData;
}

export interface PriceObservation {
  id: string;
  value: number;
  timestamp: number;
  source: string;
  provenance: string;
  round_id: number;
  nodeType: 'PriceObservation';
}

export interface ReserveAttestation {
  id: string;
  amount: number;
  timestamp: number;
  source: string;
  feed_address: string;
  round_id: number;
  answered_in_round: number;
  nodeType: 'ReserveAttestation';
}

export interface ChildClaim {
  id: string;
  asset_id: string;
  amount: number;
  timestamp: number;
  source: string;
  present: boolean;
  provenance: string;
  nodeType: 'ChildClaim';
}

export interface Liability {
  id: string;
  minted_units: number;
  vault_shares: number;
  demo_position: number;
  description: string;
  nodeType: 'Liability';
}

export interface Stamp {
  id: string;
  walker_name: string;
  color: 'green' | 'yellow' | 'red' | 'unknown';
  reasons: string[];
  timestamp: number;
  payload: Record<string, unknown>;
  nodeType: 'Stamp';
}

export interface MintRecord {
  id: string;
  tx_hash: string;
  token_address: string;
  nft_token_id: number;
  minted_amount: number;
  coverage_used: number;
  price_time: number;
  reserve_time: number;
  stamp_summary: Record<string, string>;
  timestamp: number;
  nodeType: 'MintRecord';
}

export type JacNodeData =
  | PriceObservation
  | ReserveAttestation
  | ChildClaim
  | Liability
  | Stamp
  | MintRecord;

export interface ReactFlowGraph {
  nodes: Node[];
  edges: Edge[];
}
