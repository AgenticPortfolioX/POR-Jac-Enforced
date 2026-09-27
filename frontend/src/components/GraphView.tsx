'use client';

import { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WALKER_BRAND_COLORS } from '@/lib/constants';

function NodeShell({ data, className = '', style }: NodeProps & { className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`hex-cut p-4 text-xs text-cl-primary shadow-lg max-w-[200px] bg-cl-surface1 border border-cl-gray/10 ${className}`}>
      <Handle type="target" position={Position.Top} id="top" className="invisible" />
      <Handle type="target" position={Position.Left} id="left" className="invisible" />
      <Handle type="target" position={Position.Right} id="target-right" className="invisible" />
      <div className="font-semibold text-white tracking-tight truncate leading-snug">{data.label}</div>
      {data.source && (
        <div className="text-cl-muted mt-1 text-[10px] uppercase tracking-wider">src: {data.source}</div>
      )}
      {data.detail && (
        <div className="text-cl-muted mt-1 leading-tight">{data.detail}</div>
      )}
      <Handle type="source" position={Position.Bottom} id="bottom" className="invisible" />
      <Handle type="source" position={Position.Right} id="right" className="invisible" />
      <Handle type="source" position={Position.Left} id="source-left" className="invisible" />
    </div>
  );
}

const nodeTypes = {
  asset: (props: NodeProps) => (
    <NodeShell
      {...props}
      className="bg-cl-surface2 border-transparent !py-2.5"
      data={{
        ...props.data,
        label: (
          <div className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="14" height="14" className="shrink-0">
              <path fill="#2A5ADA" fillRule="evenodd" clipRule="evenodd" d="M16 2L30 10.08v11.84L16 30L2 21.92V10.08L16 2zm0 6.6l-8.28 4.77v9.26L16 27.4l8.28-4.77v-9.26L16 8.6z" />
            </svg>
            <span className="truncate">Proof of Reserve PUSD</span>
          </div>
        ),
        detail: <div className="text-center w-full">Chainlink Secured</div>,
        source: undefined
      }}
    />
  ),
  priceobservation: (props: NodeProps) => (
    <NodeShell
      {...props}
      className="border-cl-blue border-[1.5px] bg-cl-surface2"
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
  childclaim: (props: NodeProps) => {
    const rawAsset = props.data.asset_id;
    const assetName = (!rawAsset || rawAsset === 'USDC') ? 'PUSD' : rawAsset;
    return (
      <NodeShell
        {...props}
        className="text-[10px] p-2 bg-cl-surface1 border-cl-gray/20"
        data={{
          ...props.data,
          label: `Child Claim`,
          detail: `${assetName} | ${props.data.present ? 'Present' : 'Missing'}`,
        }}
      />
    );
  },
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
    const justified = props.data?.payload?.justified_amount;
    const showAmount =
      props.data?.walker_name === 'Cover' && justified != null;
    
    let roleDescription = "";
    if (props.data?.walker_name === 'Freshness') roleDescription = "Verifies data age limits";
    if (props.data?.walker_name === 'Cover') roleDescription = "Calculates overcollateralization";
    if (props.data?.walker_name === 'Auditor') roleDescription = "Final transaction approval";

    const isGreen = props.data.color === 'green';
    const borderStyle = props.data.customBorderColor ? { borderColor: props.data.customBorderColor } : undefined;
    const baseClass = props.data.customBorderColor 
      ? 'border-[1.5px]' 
      : (isGreen ? 'border-cl-green border-[1.5px]' :
         props.data.color === 'caution' ? 'border-cl-caution border-[1.5px]' :
         props.data.color === 'red' ? 'border-cl-red border-[1.5px]' :
         'border-cl-unknown border-[1.5px]');

    return (
      <NodeShell
        {...props}
        className={baseClass}
        style={borderStyle}
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
  mintrecord: (props: NodeProps) => {
    const isMinted = props.data.tx_hash != null || props.data.isMinted === true;
    const isApproved = props.data.isApproved ?? false;
    const rawAmount = props.data.minted_amount ?? props.data.amount ?? 250000;
    const numericAmount = typeof rawAmount === 'number'
      ? rawAmount
      : (Number(String(rawAmount).replace(/,/g, '')) || 250000);
    const formattedAmount = numericAmount.toLocaleString();

    let detail = 'Council Gate: Awaiting Approval';
    if (isMinted) {
      detail = `Council Approved: ${formattedAmount} units`;
    } else if (isApproved) {
      detail = `Council: Ready to Mint (${formattedAmount} units)`;
    }

    const borderColor = isMinted || isApproved || props.data.customBorderColor
      ? (props.data.customBorderColor || '#D4AF37')
      : '#4B5563';

    return (
      <NodeShell
        {...props}
        className="border-[1.5px]"
        style={{ borderColor }}
        data={{
          ...props.data,
          label: 'Mint Authorization',
          detail,
        }}
      />
    );
  },
  walkertoken: (props: NodeProps) => (
    <div 
      className="hex-cut flex items-center justify-center px-4 py-2 text-white font-bold text-[11px] uppercase tracking-wider shadow-lg whitespace-nowrap border border-white/20"
      style={{ backgroundColor: props.data.tokenColor || '#0847F7' }}
    >
      {props.data.label}
    </div>
  ),
};

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  traverses?: readonly string[];
  activeWalker?: string | null;
}

const HOP_QUEUES: Record<string, string[]> = {
  Freshness: ['asset', 'priceobservation', 'reserveattestation', 'FreshnessStamp'],
  Cover: ['asset', 'liability', 'asset', 'reserveattestation', 'childclaim', 'CoverStamp'],
  Auditor: ['asset', 'reserveattestation', 'childclaim', 'AuditorStamp', 'FreshnessStamp', 'AuditorStamp', 'CoverStamp', 'AuditorStamp'],
  Act: ['asset', 'FreshnessStamp', 'CoverStamp', 'AuditorStamp', 'mintrecord']
};

function getNodeKey(n: Node) {
  if (n.type === 'stamp') return `${n.data.walker_name}Stamp`;
  return n.type;
}

export function GraphView({
  nodes,
  edges,
  activeWalker = null,
}: GraphViewProps) {
  const activeColor = activeWalker ? (WALKER_BRAND_COLORS[activeWalker] || '#0847F7') : '#0847F7';
  const [hopIndex, setHopIndex] = useState(-1);

  useEffect(() => {
    if (!activeWalker || activeWalker === 'Ingest' || activeWalker === 'Counsel') {
      setHopIndex(-1);
      return;
    }
    const queue = HOP_QUEUES[activeWalker] || [];
    if (queue.length === 0) {
      setHopIndex(-1);
      return;
    }
    setHopIndex(0);
    
    const intervalMs = Math.floor(2500 / queue.length);
    let currentHop = 0;
    const interval = setInterval(() => {
      currentHop++;
      if (currentHop >= queue.length) {
        clearInterval(interval);
      } else {
        setHopIndex(currentHop);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeWalker]);

  const isAnimating = activeWalker && activeWalker !== 'Ingest' && activeWalker !== 'Counsel' && hopIndex >= 0;
  const queue = isAnimating ? (HOP_QUEUES[activeWalker!] || []) : [];
  const currentKey = isAnimating ? queue[hopIndex] : null;

  let liveEdgeId: string | null = null;
  const completedEdgeIds = new Set<string>();

  if (isAnimating && hopIndex > 0) {
    const prevNode = nodes.find(n => getNodeKey(n) === queue[hopIndex - 1]);
    const currNode = nodes.find(n => getNodeKey(n) === queue[hopIndex]);
    if (prevNode && currNode) {
      const match = edges.find(
        e => (e.source === prevNode.id && e.target === currNode.id) ||
             (e.source === currNode.id && e.target === prevNode.id)
      );
      liveEdgeId = match ? match.id : `e-${prevNode.id}-${currNode.id}`;
    }
    for (let i = 1; i < hopIndex; i++) {
      const pNode = nodes.find(n => getNodeKey(n) === queue[i - 1]);
      const cNode = nodes.find(n => getNodeKey(n) === queue[i]);
      if (pNode && cNode) {
        const match = edges.find(
          e => (e.source === pNode.id && e.target === cNode.id) ||
               (e.source === cNode.id && e.target === pNode.id)
        );
        completedEdgeIds.add(match ? match.id : `e-${pNode.id}-${cNode.id}`);
      }
    }
  }

  const decoratedEdges = useMemo(() => edges.map(e => {
    const isLive = e.id === liveEdgeId;
    const isCompleted = completedEdgeIds.has(e.id);
    
    if (isLive) {
      return {
        ...e,
        animated: false,
        style: { stroke: activeColor, strokeWidth: 2.5, opacity: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: activeColor },
      };
    } else if (isCompleted) {
      return {
        ...e,
        animated: false,
        style: { stroke: activeColor, strokeWidth: 1.5, opacity: 0.7 }
      };
    } else {
      return {
        ...e,
        animated: false,
        style: { stroke: '#6D7380', strokeWidth: 1.5, opacity: 0.3 }
      };
    }
  }), [edges, liveEdgeId, completedEdgeIds, activeColor]);

  const isActing = activeWalker === 'Act';
  const showGold = isActing;

  const decoratedNodes = useMemo(() => {
    const renderNodes = nodes.map(n => {
      const key = getNodeKey(n);
      const isCurrent = key === currentKey;
      const isFinalHop = isAnimating && hopIndex === queue.length - 1;
      
      let opacity = 1;
      if (isAnimating) {
        opacity = isCurrent ? 1 : 0.2;
      }

      let shadow = undefined;
      let extraClass = '';
      let customBorderColor = undefined;

      if (n.type === 'stamp' && n.data?.color === 'green') {
        customBorderColor = showGold ? '#D4AF37' : (WALKER_BRAND_COLORS[n.data.walker_name] || '#10B981');
      } else if (n.type === 'mintrecord') {
        customBorderColor = (n.data?.isApproved || n.data?.isMinted || showGold) ? '#D4AF37' : '#4B5563';
      }

      if (isAnimating && isCurrent) {
        if (isFinalHop && n.type === 'stamp') {
          extraClass = 'animate-pulse-ring';
        } else {
          shadow = `0 0 0 2px ${activeColor}`;
        }
      }

      return {
        ...n,
        data: {
          ...n.data,
          customBorderColor
        },
        style: {
          ...n.style,
          opacity,
          boxShadow: shadow,
          transition: 'opacity 0.3s ease-in-out, box-shadow 0.2s, border-color 0.8s ease-in-out',
        },
        className: `${n.className || ''} ${extraClass}`
      };
    });

    if (isAnimating && currentKey) {
      const targetNode = renderNodes.find(n => getNodeKey(n) === currentKey);
      if (targetNode) {
        renderNodes.push({
          id: 'walker-token',
          type: 'walkertoken',
          position: {
            x: targetNode.position.x + 40,
            y: targetNode.position.y - 20
          },
          data: { label: `${activeWalker} Walker`, tokenColor: activeColor },
          style: {
            zIndex: 1000,
            transition: 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none'
          }
        });
      }
    }

    return renderNodes;
  }, [nodes, isAnimating, currentKey, hopIndex, queue.length, activeColor, activeWalker, showGold]);

  return (
    <div className="h-[528px] rounded-[12px] border border-cl-gray/10 bg-cl-bg overflow-hidden relative">
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

