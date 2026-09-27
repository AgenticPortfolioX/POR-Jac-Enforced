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
  tokenAddress: string = '',
  customId: string = ASSET_ID
): Promise<string> {
  const report = await runWalker<{ node_id?: string }>('SeedAsset', {
    id: customId,
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
    Asset: { x: 380, y: 0 },
    Liability: { x: 40, y: 95 },
    PriceObservation: { x: 210, y: 95 },
    ReserveAttestation: { x: 550, y: 95 },
    ChildClaim: { x: 740, y: 180 },
    FreshnessStamp: { x: 210, y: 275 },
    CoverStamp: { x: 550, y: 275 },
    AuditorStamp: { x: 380, y: 365 },
    MintRecord: { x: 380, y: 450 },
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
    
    // The user prefers ChildClaim to visually bridge Reserve and Cover instead of Asset
    if (n.nodeType === 'ChildClaim') {
      return;
    }

    // CoverStamp is reached via ReserveAttestation -> ChildClaim -> Cover to avoid crossing lines
    if (n.nodeType === 'Stamp' && n.walker_name === 'Cover') {
      return;
    }

    // MintRecord is authorized and reached from AuditorStamp
    if (n.nodeType === 'MintRecord') {
      return;
    }

    edges.push({
      id: `e-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      label: e.type,
      type: 'smoothstep',
    });
  });

  // Inject custom bridges for ChildClaim
  const reserveNode = nodes.find(n => n.type === 'reserveattestation');
  const childClaimNode = nodes.find(n => n.type === 'childclaim');
  const coverNode = nodes.find(n => n.type === 'stamp' && n.data.walker_name === 'Cover');

  if (reserveNode && childClaimNode) {
    edges.push({
      id: `e-${reserveNode.id}-${childClaimNode.id}`,
      source: reserveNode.id,
      target: childClaimNode.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      label: 'DependsOn',
      type: 'smoothstep',
      labelStyle: { fill: '#F5F7FA', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: '#141824', fillOpacity: 0.95, stroke: '#374151', strokeWidth: 1 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      style: { stroke: '#4B5563', strokeWidth: 1.5 },
    });
  }

  if (childClaimNode && coverNode) {
    edges.push({
      id: `e-${childClaimNode.id}-${coverNode.id}`,
      source: childClaimNode.id,
      target: coverNode.id,
      sourceHandle: 'source-left',
      targetHandle: 'target-right',
      type: 'smoothstep',
      style: { stroke: '#4B5563', strokeWidth: 1.5 },
    });
  }

  // Inject review edges flowing into Auditor Decision
  const freshnessNode = nodes.find(n => n.type === 'stamp' && n.data.walker_name === 'Freshness');
  const auditorNode = nodes.find(n => n.type === 'stamp' && n.data.walker_name === 'Auditor');

  if (auditorNode && freshnessNode) {
    edges.push({
      id: `e-${freshnessNode.id}-${auditorNode.id}`,
      source: freshnessNode.id,
      target: auditorNode.id,
      label: 'Reviews',
      type: 'smoothstep',
      style: { strokeDasharray: '5,5', stroke: '#94A3B8', strokeWidth: 1.5 },
    });
  }

  if (auditorNode && coverNode) {
    edges.push({
      id: `e-${coverNode.id}-${auditorNode.id}`,
      source: coverNode.id,
      target: auditorNode.id,
      label: 'Reviews',
      type: 'smoothstep',
      style: { strokeDasharray: '5,5', stroke: '#94A3B8', strokeWidth: 1.5 },
    });
  }

  // Always ensure the terminal Mint Authorization node is present
  const isApproved = asset.edges.some((e: JacEdge) => {
    const t = e.target as any;
    return t.nodeType === 'Stamp' && t.walker_name === 'Auditor' && t.color === 'green';
  });

  let mintNode = nodes.find(n => n.type === 'mintrecord');
  if (!mintNode) {
    const coverStamp = asset.edges.find((e: JacEdge) => (e.target as any).nodeType === 'Stamp' && (e.target as any).walker_name === 'Cover');
    const justified = (coverStamp?.target as any)?.payload?.justified_amount ?? 250000;

    mintNode = {
      id: 'node-mint-authorization',
      type: 'mintrecord',
      position: positions.MintRecord,
      data: {
        label: 'Mint Authorization',
        nodeType: 'MintRecord',
        minted_amount: isApproved ? Number(justified).toLocaleString() : undefined,
        isApproved,
        isMinted: false,
      },
    };
    nodes.push(mintNode);
  } else {
    mintNode.data = {
      ...mintNode.data,
      isApproved,
      isMinted: isApproved,
    };
  }

  if (auditorNode && mintNode) {
    edges.push({
      id: `e-${auditorNode.id}-${mintNode.id}`,
      source: auditorNode.id,
      target: mintNode.id,
      label: 'Authorizes',
      type: 'smoothstep',
      style: { stroke: isApproved ? '#D4AF37' : '#4B5563', strokeWidth: 1.5 },
    });
  }

  return { nodes, edges };
}
