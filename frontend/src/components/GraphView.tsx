'use client';

import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

function NodeShell({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-200 shadow-lg max-w-[180px]">
      <div className="font-semibold text-neutral-100 truncate">{data.label}</div>
      {data.source && (
        <div className="text-neutral-500 mt-1">src: {data.source}</div>
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
  stamp: (props: NodeProps) => (
    <NodeShell
      {...props}
      data={{
        ...props.data,
        label: `${props.data.walker_name ?? '?'}: ${props.data.color ?? 'pending'}`,
      }}
    />
  ),
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
}

export function GraphView({ nodes, edges }: GraphViewProps) {
  return (
    <div className="h-[520px] rounded-lg border border-neutral-800 bg-neutral-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
