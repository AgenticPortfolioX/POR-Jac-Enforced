'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import { fetchGraph, runWalker, seedAsset } from '@/lib/jacClient';
import {
  ASSET_ID,
  WALKER_ORDER,
  WALK_STEPS,
  WALK_STEP_MS,
  PATH_CONFIG,
  type PathName,
  type WalkStep,
} from '@/lib/constants';
import type { Stamp } from '@/lib/types';
import { GraphView } from '@/components/GraphView';
import { StampBadge } from '@/components/StampBadge';
import { AuditorPanel } from '@/components/AuditorPanel';
import { CounselPanel } from '@/components/CounselPanel';
import { PathSelector } from '@/components/PathSelector';
import { MintButton } from '@/components/MintButton';
import { ExplorerLink } from '@/components/ExplorerLink';
import { PolicyCard } from '@/components/PolicyCard';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One completed walker in the current walk. */
interface WalkEntry {
  walker: string;
  /** Absent for Ingest, which reports sources rather than a verdict. */
  color?: string;
}

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
  // The walk, made visible: which walker is on screen, and what each has said.
  const [activeStep, setActiveStep] = useState<WalkStep | null>(null);
  const [walkLog, setWalkLog] = useState<WalkEntry[]>([]);

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
      // Graph not yet seeded - ignore
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

  /**
   * Walk the path one walker at a time, refreshing and re-highlighting between
   * each so the traversal is visible rather than instantaneous.
   *
   * DemoControl would run all four in a single server-side frame - same result,
   * nothing to watch. Here each walker is its own request against the same
   * asset, which also means a stamp can be seen flipping colour in place.
   */
  const runPath = async (path: string) => {
    setPending(true);
    setNarration(null);
    setTxHash(null);
    setError(null);
    setWalkLog([]);
    try {
      // Seed asset first (idempotent) - returns the node id the walkers need.
      const nd = await ensureSeeded();
      const cfg = PATH_CONFIG[path as PathName] ?? PATH_CONFIG.happy;

      for (const step of WALK_STEPS) {
        setActiveStep(step);
        const body =
          step.walker === 'Ingest'
            ? {
                use_fixture: true,
                fixture_name: cfg.fixture,
                child_present: cfg.childPresent,
              }
            : {};
        const report = await runWalker<Record<string, unknown>>(
          step.walker,
          body,
          nd
        );
        await refresh(nd);
        setWalkLog((log) => [
          ...log,
          { walker: step.walker, color: report?.color as string | undefined },
        ]);
        await sleep(WALK_STEP_MS);
      }
      setActiveStep(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setActiveStep(null);
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
          recipient: '0x748ABdeF0775132E8F941e1513152D5eb02D3a4B',
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

      {/* Walk - the traversal, made visible */}
      <section>
        <div className="mb-2 flex items-baseline gap-3">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500">
            Walk
          </h2>
          <span className="text-xs text-neutral-400">
            {activeStep
              ? `${activeStep.walker} - ${activeStep.intent}…`
              : walkLog.length > 0
                ? 'walk complete'
                : 'pick a path to walk the claim'}
          </span>
        </div>
        <ol className="flex flex-wrap gap-2">
          {WALK_STEPS.map((s) => {
            const entry = walkLog.find((l) => l.walker === s.walker);
            const isActive = activeStep?.walker === s.walker;
            const verdict = entry ? (entry.color ?? 'done') : null;
            const tone =
              verdict === 'green'
                ? 'border-green-700 text-green-300'
                : verdict === 'yellow'
                  ? 'border-yellow-700 text-yellow-300'
                  : verdict === 'red'
                    ? 'border-red-700 text-red-300'
                    : verdict === 'done'
                      ? 'border-neutral-600 text-neutral-300'
                      : 'border-neutral-800 text-neutral-600';
            return (
              <li
                key={s.walker}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${tone} ${
                  isActive ? 'ring-2 ring-green-500' : ''
                }`}
              >
                <div className="font-semibold">{s.walker}</div>
                <div className="text-neutral-500">
                  {verdict ?? (isActive ? 'walking…' : 'queued')}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Policy Card */}
      <PolicyCard />

      {/* Graph View */}
      <GraphView
        nodes={nodes}
        edges={edges}
        traverses={activeStep?.traverses ?? []}
        activeWalker={
          activeStep && activeStep.walker !== 'Ingest' ? activeStep.walker : null
        }
      />

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
