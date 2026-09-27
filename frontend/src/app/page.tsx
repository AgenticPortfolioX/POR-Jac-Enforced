'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import { fetchGraph, runWalker, seedAsset } from '@/lib/jacClient';
import { ASSET_ID, WALKER_ORDER } from '@/lib/constants';
import type { Stamp } from '@/lib/types';
import { GraphView } from '@/components/GraphView';
import { StampBadge } from '@/components/StampBadge';
import { AuditorPanel } from '@/components/AuditorPanel';
import { CounselPanel } from '@/components/CounselPanel';
import { PathSelector } from '@/components/PathSelector';
import { MintButton } from '@/components/MintButton';
import { ExplorerLink } from '@/components/ExplorerLink';
import { PolicyCard } from '@/components/PolicyCard';

export default function HomePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stamps, setStamps] = useState<Record<string, Stamp>>({});
  const [auditorReasons, setAuditorReasons] = useState<string[]>([]);
  const [narration, setNarration] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requested, setRequested] = useState(1000000);
  const [error, setError] = useState<string | null>(null);
  // Graph node id of the seeded Asset. Every walker except SeedAsset runs only
  // when spawned ON this node (POST /walker/{Name}/{nodeId}), so nothing in the
  // UI can read or write the graph until SeedAsset has reported it.
  const [nodeId, setNodeId] = useState<string | null>(null);

  const refresh = useCallback(async (nd: string) => {
    try {
      const g = await fetchGraph(ASSET_ID, nd);
      setNodes(g.nodes);
      setEdges(g.edges);
      const byName: Record<string, Stamp> = {};
      for (const n of g.nodes) {
        if ((n.data as { nodeType?: string }).nodeType === 'Stamp') {
          const s = n.data as unknown as Stamp;
          byName[s.walker_name] = s;
        }
      }
      setStamps(byName);
      if (byName['Auditor']) {
        setAuditorReasons(byName['Auditor'].reasons);
      }
    } catch {
      // Graph not yet seeded — ignore
    }
  }, []);

  /** Ensure the Asset exists and remember its node id. Idempotent. */
  const ensureSeeded = useCallback(async (): Promise<string> => {
    if (nodeId) return nodeId;
    const nd = await seedAsset(process.env.NEXT_PUBLIC_POR_TOKEN_ADDRESS ?? '');
    setNodeId(nd);
    return nd;
  }, [nodeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nd = await ensureSeeded();
        if (!cancelled) await refresh(nd);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureSeeded, refresh]);

  const allGreen = WALKER_ORDER.every((w) => stamps[w]?.color === 'green');
  const stampsReady = WALKER_ORDER.every((w) => w in stamps);
  const justified = (stamps['Cover']?.payload?.justified_amount as number) ?? 0;

  const runPath = async (path: string) => {
    setPending(true);
    setNarration(null);
    setTxHash(null);
    setError(null);
    try {
      // Seed asset first (idempotent) — returns the node id DemoControl needs.
      const nd = await ensureSeeded();
      await runWalker('DemoControl', { path, asset_id: ASSET_ID }, nd);
      await refresh(nd);
    } catch (e) {
      setError(String(e));
    } finally {
      setPending(false);
    }
  };

  const onMint = async () => {
    setPending(true);
    setError(null);
    try {
      const nd = await ensureSeeded();
      type ActResponse = { minted: boolean; tx?: string; reason?: string };
      const res = await runWalker<ActResponse>(
        'Act',
        {
          asset_id: ASSET_ID,
          requested_amount: requested,
          recipient: '0x0000000000000000000000000000000000000000',
          token_address: process.env.NEXT_PUBLIC_POR_TOKEN_ADDRESS ?? '',
          attestation_address:
            process.env.NEXT_PUBLIC_POR_ATTESTATION_ADDRESS ?? '',
        },
        nd
      );
      if (res.minted && res.tx) {
        setTxHash(res.tx);
      } else {
        setError(res.reason ?? 'Mint refused');
      }
      await refresh(nd);
      // Ask Counsel
      type CounselResponse = { spoken: boolean; narration?: string };
      const counsel = await runWalker<CounselResponse>(
        'Counsel',
        { asset_id: ASSET_ID },
        nd
      );
      if (counsel.spoken) {
        setNarration(counsel.narration ?? null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Proof of Reserve,{' '}
          <span className="text-green-500">Jac Enforced</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          PoR attests. Jac enforces. The printer is the proof.
        </p>
      </header>

      {/* Path Selector */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-neutral-500">
          Demo Path
        </h2>
        <PathSelector onSelect={runPath} disabled={pending} />
      </section>

      {/* Policy Card */}
      <PolicyCard />

      {/* Graph View */}
      <GraphView nodes={nodes} edges={edges} />

      {/* Stamp Badges */}
      <section className="flex gap-3 flex-wrap">
        {WALKER_ORDER.map((w) => (
          <StampBadge
            key={w}
            walker={w}
            color={(stamps[w]?.color as 'green' | 'yellow' | 'red' | 'unknown') ?? null}
          />
        ))}
      </section>

      {/* Auditor Panel */}
      <AuditorPanel reasons={auditorReasons} />

      {/* Counsel Panel */}
      <CounselPanel narration={narration} enabled={stampsReady} />

      {/* Mint Row */}
      <section className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="requested-amount"
            className="text-sm text-neutral-400"
          >
            Requested amount:
          </label>
          <input
            id="requested-amount"
            type="number"
            value={requested}
            onChange={(e) => setRequested(Number(e.target.value))}
            className="w-36 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <MintButton
          enabled={allGreen}
          justified={justified}
          onMint={onMint}
          pending={pending}
        />
        <ExplorerLink txHash={txHash} />
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </main>
  );
}
