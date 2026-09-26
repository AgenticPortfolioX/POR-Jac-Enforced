// frontend/src/lib/jacClient.ts
// Purpose: HTTP client for Jac Cloud, React Flow graph transformer
// Owner walker/module: frontend
// Spec: see PRD §11
// Status: IMPLEMENTED — Prompt 11

import type { Node, Edge } from 'reactflow';
import type {
  JacAsset,
  JacEdge,
  JacNodeData,
  ReactFlowGraph,
  Stamp,
} from './types';
import { JAC_CLOUD_URL, ASSET_ID } from './constants';

export async function fetchGraph(
  assetId: string = ASSET_ID
): Promise<ReactFlowGraph> {
  const res = await fetch(`${JAC_CLOUD_URL}/walker/GetAsset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId }),
  });
  if (!res.ok) {
    throw new Error(`GetAsset failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const asset: JacAsset = data.reports?.[0] ?? data;
  return toReactFlowGraph(asset);
}

export async function runWalker<T = unknown>(
  name: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${JAC_CLOUD_URL}/walker/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Walker ${name} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
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
