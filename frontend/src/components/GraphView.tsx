'use client';

import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

const HOT_STROKE = '#0847F7';
const HOT_RING = '0 0 0 2px #0847F7';

function NodeShell({ data, className = '' }: NodeProps & { className?: string }) {
  return (
    <div className={`hex-cut p-4 text-xs text-cl-primary shadow-lg max-w-[200px] bg-cl-surface1 border border-cl-gray/10 ${className}`}>
      <div className="font-semibold text-white tracking-tight truncate leading-snug">{data.label}</div>
      {data.source && (
        <div className="text-cl-muted mt-1 text-[10px] uppercase tracking-wider">src: {data.source}</div>
      )}
      {data.detail && (
        <div className="text-cl-muted mt-1 leading-tight">{data.detail}</div>
      )}
    </div>
  );
}

const nodeTypes = {
  asset: (props: NodeProps) => (
    <NodeShell
      {...props}
      className="bg-cl-blue border-transparent"
    />
  ),
  priceobservation: (props: NodeProps) => (
    <NodeShell
      {...props}
      className="border-cl-wash border-[1.5px] bg-cl-surface2"
      data={{
        ...props.data,
        label: `Price: $${props.data.value ?? '?'}`,
        detail: `Round: ${props.data.round_id ?? '?'}`,
      }}
    />
  ),
  reserveattestation: (props: NodeProps) => (
    <NodeShell
      {...props}
      className="border-cl-blue border-[1.5px] bg-cl-surface2"
      data={{
        ...props.data,
        label: `Reserves: ${props.data.amount ?? '?'}`,
        detail: `Round: ${props.data.round_id ?? '?'}`,
      }}
    />
  ),
  childclaim: (props: NodeProps) => (
    <NodeShell
      {...props}
      className="text-[10px] p-2 bg-cl-surface1 border-cl-gray/20"
      data={{
        ...props.data,
        label: `Child Claim`,
        detail: `${props.data.asset_id ?? '?'} | ${props.data.present ? 'Present' : 'Missing'}`,
      }}
    />
  ),
  liability: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Current Liability`,
        detail: `Minted: ${props.data.minted_units ?? '?'} units`,
      }}
    />
  ),
  stamp: (props: NodeProps) => {
    // The Cover stamp is the one that carries the number the whole system
    // exists to produce, so put it on the node rather than behind a click.
    const justified = props.data?.payload?.justified_amount;
    const showAmount =
      props.data?.walker_name === 'Cover' && justified != null;
    
    let roleDescription = "";
    if (props.data?.walker_name === 'Freshness') roleDescription = "Verifies data age limits";
    if (props.data?.walker_name === 'Cover') roleDescription = "Calculates overcollateralization";
    if (props.data?.walker_name === 'Auditor') roleDescription = "Final transaction approval";

    return (
      <NodeShell
        {...props}
        className={
          props.data.color === 'green' ? 'border-cl-green border-[1.5px]' :
          props.data.color === 'yellow' ? 'border-cl-yellow border-[1.5px]' :
          props.data.color === 'red' ? 'border-cl-red border-[1.5px]' :
          'border-cl-unknown border-[1.5px]'
        }
        data={{
          ...props.data,
          label: `${props.data.walker_name ?? '?'} Decision`,
          detail: showAmount
            ? `Approved: ${Number(justified).toLocaleString()}`
            : roleDescription,
        }}
      />
    );
  },
  mintrecord: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Mint Authorization`,
        detail: `Approved Mint: ${props.data.minted_amount ?? '?'} units`,
      }}
    />
  ),
};

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  /** Edge types the walker currently on screen traverses. These animate. */
  traverses?: readonly string[];
  /** Walker whose stamp node just landed - it gets a green ring. */
  activeWalker?: string | null;
}

export function GraphView({
  nodes,
  edges,
  traverses = [],
  activeWalker = null,
}: GraphViewProps) {
  const decoratedEdges = useMemo(
    () =>
      edges.map((e) => {
        const hot = traverses.includes(String(e.label ?? ''));
        const isVisiting = activeWalker != null && activeWalker !== 'Ingest';
        if (!hot) return {
          ...e,
          style: { stroke: '#0847F7', strokeWidth: 1.5, opacity: 0.55 },
          labelStyle: { fill: '#F5F7FA', fontWeight: 500, fontSize: 10 },
          labelBgStyle: { fill: '#1A2030', fillOpacity: 0.8 },
        };
        return {
          ...e,
          animated: isVisiting,
          style: { stroke: HOT_STROKE, strokeWidth: 2.5, opacity: 1 },
          labelStyle: { fill: '#DCEBFF', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: '#0847F7', fillOpacity: 0.9, rx: 4, ry: 4 },
        };
      }),
    [edges, traverses, activeWalker]
  );

  const decoratedNodes = useMemo(() => {
    if (!activeWalker) return nodes;
    return nodes.map((n) => {
      const isActiveStamp =
        n.type === 'stamp' && n.data?.walker_name === activeWalker;
      if (!isActiveStamp) return n;
      return { ...n, className: 'animate-pulse-ring', style: { ...n.style, boxShadow: HOT_RING } };
    });
  }, [nodes, activeWalker]);

  return (
    <div className="h-[520px] rounded-[12px] border border-cl-gray/10 bg-cl-bg overflow-hidden relative">
      <ReactFlow
        nodes={decoratedNodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(245,247,250,0.04)" gap={24} size={1.5} />
        <Controls className="[&>button]:bg-cl-surface2 [&>button]:border-cl-gray/10 [&>button]:text-cl-primary" />
      </ReactFlow>
    </div>
  );
}
