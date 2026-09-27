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

const HOT_STROKE = '#22c55e';
const HOT_RING = '0 0 0 2px #22c55e, 0 0 18px rgba(34,197,94,0.55)';

function NodeShell({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-200 shadow-lg max-w-[180px]">
      <div className="font-semibold text-neutral-100 truncate">{data.label}</div>
      {data.source && (
        <div className="text-neutral-500 mt-1">src: {data.source}</div>
      )}
      {data.detail && (
        <div className="text-neutral-400 mt-1">{data.detail}</div>
      )}
    </div>
  );
}

const nodeTypes = {
  asset: NodeShell,
  priceobservation: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Price: ${props.data.value ?? '?'} (${props.data.source ?? '?'})`,
      }}
    />
  ),
  reserveattestation: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Reserve: ${props.data.amount ?? '?'} (${props.data.source ?? '?'})`,
      }}
    />
  ),
  childclaim: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Child: ${props.data.asset_id ?? '?'} present=${String(props.data.present ?? '?')}`,
      }}
    />
  ),
  liability: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Liability: ${props.data.minted_units ?? '?'}`,
      }}
    />
  ),
  stamp: (props: NodeProps) => {
    // The Cover stamp is the one that carries the number the whole system
    // exists to produce, so put it on the node rather than behind a click.
    const justified = props.data?.payload?.justified_amount;
    const showAmount =
      props.data?.walker_name === 'Cover' && justified != null;
    return (
      <NodeShell
        {...props}
        data={{
          ...props.data,
          label: `${props.data.walker_name ?? '?'}: ${props.data.color ?? 'pending'}`,
          detail: showAmount
            ? `justified ${Number(justified).toLocaleString()}`
            : undefined,
        }}
      />
    );
  },
  mintrecord: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `Mint: ${props.data.minted_amount ?? '?'}`,
      }}
    />
  ),
};

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  /** Edge types the walker currently on screen traverses. These animate. */
  traverses?: readonly string[];
  /** Walker whose stamp node just landed — it gets a green ring. */
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
        if (!hot) return e;
        return {
          ...e,
          animated: true,
          style: { stroke: HOT_STROKE, strokeWidth: 2.5 },
          labelStyle: { fill: HOT_STROKE, fontWeight: 600 },
        };
      }),
    [edges, traverses]
  );

  const decoratedNodes = useMemo(() => {
    if (!activeWalker) return nodes;
    return nodes.map((n) => {
      const isActiveStamp =
        n.type === 'stamp' && n.data?.walker_name === activeWalker;
      if (!isActiveStamp) return n;
      return { ...n, style: { ...n.style, boxShadow: HOT_RING, borderRadius: 8 } };
    });
  }, [nodes, activeWalker]);

  return (
    <div className="h-[520px] rounded-lg border border-neutral-800 bg-neutral-950">
      <ReactFlow
        nodes={decoratedNodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls className="[&>button]:bg-neutral-800 [&>button]:border-neutral-700 [&>button]:text-neutral-300" />
      </ReactFlow>
    </div>
  );
}
