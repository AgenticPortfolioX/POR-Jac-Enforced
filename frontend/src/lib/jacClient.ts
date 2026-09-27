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

  // Asset node at (0,0)
  nodes.push({
    id: asset.id,
    type: 'asset',
    position: { x: 0, y: 0 },
    data: { label: `${asset.symbol} (${asset.chain})`, ...asset },
  });

  const nonStampEdges = asset.edges.filter((e) => e.type !== 'StampedBy');
  const stampEdges = asset.edges.filter((e) => e.type === 'StampedBy');

  // Non-stamp nodes at y=200
  let reserveNodeId: string | null = null;
  nonStampEdges.forEach((e: JacEdge, i: number) => {
    const n = e.target as JacNodeData & { id: string };
    const x = (i - (nonStampEdges.length - 1) / 2) * 220;
    const nodeId = n.id ?? `${e.type}-${i}`;
    nodes.push({
      id: nodeId,
      type: n.nodeType.toLowerCase(),
      position: { x, y: 200 },
      data: { label: n.nodeType, ...n },
    });
    edges.push({
      id: `e-${asset.id}-${nodeId}`,
      source: asset.id,
      target: nodeId,
      label: e.type,
      type: 'smoothstep',
    });
    if (e.type === 'HasReserve') {
      reserveNodeId = nodeId;
    }
  });

  // DependsOn child claims at y=320
  const childEdges = asset.edges.filter((e) => e.type === 'DependsOn');
  childEdges.forEach((e: JacEdge, i: number) => {
    const n = e.target as JacNodeData & { id: string };
    const x = (i - (childEdges.length - 1) / 2) * 220;
    const nodeId = n.id ?? `child-${i}`;
    const parentId = e.source ?? reserveNodeId ?? asset.id;
    nodes.push({
      id: nodeId,
      type: n.nodeType.toLowerCase(),
      position: { x, y: 320 },
      data: { label: n.nodeType, ...n },
    });
    edges.push({
      id: `e-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      label: 'DependsOn',
      type: 'smoothstep',
    });
  });

  // Stamp nodes at y=420
  stampEdges.forEach((e: JacEdge, i: number) => {
    const n = e.target as Stamp & { id: string };
    const x = (i - (stampEdges.length - 1) / 2) * 220;
    const nodeId = n.id ?? `stamp-${i}`;
    nodes.push({
      id: nodeId,
      type: 'stamp',
      position: { x, y: 420 },
      data: {
        label: `${n.walker_name}: ${n.color}`,
        ...n,
      },
    });
    edges.push({
      id: `e-${asset.id}-${nodeId}`,
      source: asset.id,
      target: nodeId,
      label: 'StampedBy',
      type: 'smoothstep',
    });
  });

  return { nodes, edges };
}
