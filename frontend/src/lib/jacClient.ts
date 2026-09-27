import type { Node, Edge } from 'reactflow';
import type {
  JacAsset,
  JacEdge,
  JacNodeData,
  ReactFlowGraph,
  Stamp,
} from './types';
import { JAC_CLOUD_URL, ASSET_ID } from './constants';

/** Jac Cloud wraps every walker result in a `{ ok, data }` envelope. */
interface JacEnvelope {
  ok?: boolean;
  error?: unknown;
  data?: { reports?: unknown[] };
}

/**
 * POST a walker and return its `reports` array.
 *
 * `nodeId` is a PATH parameter, not a body field: every walker declared
 * `with Asset entry` only runs when it is spawned ON the asset node, i.e.
 * POST /walker/{Name}/{nodeId}. Omitting it spawns on root - correct only for
 * SeedAsset, whose entry is `Root`. See scripts/run_demo_path.py for the same
 * rule on the CLI side.
 */
async function postWalker(
  name: string,
  body: Record<string, unknown>,
  nodeId?: string
): Promise<unknown[]> {
  const path = `/walker/${name}${nodeId ? `/${nodeId}` : ''}`;
  const res = await fetch(`${JAC_CLOUD_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Walker ${name} failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as JacEnvelope;
  if (data.ok === false) {
    throw new Error(`Walker ${name} refused: ${JSON.stringify(data.error)}`);
  }
  return data.data?.reports ?? [];
}

export async function fetchGraph(
  assetId: string = ASSET_ID,
  nodeId?: string
): Promise<ReactFlowGraph> {
  const reports = await postWalker('GetAsset', { asset_id: assetId }, nodeId);
  const asset = reports[0] as JacAsset | undefined;
  if (!asset?.edges) {
    throw new Error('GetAsset returned no asset report');
  }
  return toReactFlowGraph(asset);
}

/** POST a walker and return its first report entry. */
export async function runWalker<T = unknown>(
  name: string,
  body: Record<string, unknown> = {},
  nodeId?: string
): Promise<T> {
  const reports = await postWalker(name, body, nodeId);
  return reports[0] as T;
}

/**
 * Create the root Asset if absent and return its graph node id.
 *
 * SeedAsset is the only walker with a `Root` entry, so it is the only one that
 * may be POSTed without a node id - and the only way to discover the asset's
 * node id, which every other walker needs.
 */
export async function seedAsset(
  tokenAddress: string = ''
): Promise<string> {
  const report = await runWalker<{ node_id?: string }>('SeedAsset', {
    id: ASSET_ID,
    name: 'PoR pUSD',
    symbol: 'pUSD',
    chain: 'sepolia',
    token_address: tokenAddress,
    created_at: 0,
  });
  if (!report?.node_id) {
    throw new Error('SeedAsset returned no node_id');
  }
  return report.node_id;
}

export function toReactFlowGraph(asset: JacAsset): ReactFlowGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Fixed layout coordinates
  const positions: Record<string, { x: number; y: number }> = {
    Asset: { x: 400, y: 0 },
    PriceObservation: { x: 200, y: 150 },
    ReserveAttestation: { x: 600, y: 150 },
    ChildClaim: { x: 600, y: 300 },
    Liability: { x: 200, y: 300 },
    FreshnessStamp: { x: 200, y: 450 },
    CoverStamp: { x: 400, y: 450 },
    AuditorStamp: { x: 600, y: 450 },
    MintRecord: { x: 400, y: 600 },
  };

  nodes.push({
    id: asset.id,
    type: 'asset',
    position: positions.Asset,
    data: { label: `${asset.symbol} (${asset.chain})`, ...asset },
  });

  asset.edges.forEach((e: JacEdge, i: number) => {
    const n = e.target as any;
    let posKey = n.nodeType;
    if (n.nodeType === 'Stamp') {
      posKey = `${n.walker_name}Stamp`;
    }
    
    const pos = positions[posKey] || { x: 400, y: 800 + i * 100 };
    const nodeId = n.id ?? `${e.type}-${i}`;

    nodes.push({
      id: nodeId,
      type: n.nodeType.toLowerCase(),
      position: pos,
      data: { label: n.nodeType, ...n },
    });

    const parentId = e.source ?? asset.id;
    edges.push({
      id: `e-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      label: e.type,
      type: 'smoothstep',
    });
  });

  return { nodes, edges };
}
