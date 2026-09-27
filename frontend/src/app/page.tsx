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
    <main className="min-h-screen bg-cl-bg text-cl-primary p-6 lg:p-8 font-sans">
      <div className="mx-auto max-w-[1400px] space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-cl-gray/10 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cl-muted mb-1 font-semibold">Chainlink attestation, Jac enforcement</div>
            <h1 className="text-2xl font-normal tracking-tight text-white">
              Proof of Reserve, Jac Enforced
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6 items-start">
          
          {/* Left/Top: Command Bar */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <section className="rounded-[12px] border border-cl-gray/10 bg-cl-surface1 p-5 shadow-sm">
              <h2 className="mb-4 text-xs uppercase tracking-wider text-cl-muted font-semibold">
                Demo Path
              </h2>
              <PathSelector onSelect={runPath} disabled={pending} />
            </section>
            
            <section className="rounded-[12px] border border-cl-gray/10 bg-cl-surface1 p-5 shadow-sm">
              <h2 className="mb-4 text-xs uppercase tracking-wider text-cl-muted font-semibold">
                Action
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="requested-amount" className="block text-xs text-cl-muted mb-2 font-medium">
                    Requested amount
                  </label>
                  <input
                    id="requested-amount"
                    type="number"
                    value={requested}
                    onChange={(e) => setRequested(Number(e.target.value))}
                    className="w-full rounded-[8px] border border-cl-gray/20 bg-cl-surface2 px-3 py-2 text-sm text-white focus:outline-none focus:border-cl-blue focus:ring-1 focus:ring-cl-blue transition-colors"
                  />
                </div>
                <MintButton
                  enabled={allGreen}
                  justified={justified}
                  onMint={onMint}
                  pending={pending}
                />
              </div>
            </section>

            {/* Walk Log (Compact) */}
            <section className="rounded-[12px] border border-cl-gray/10 bg-cl-surface1 p-5 shadow-sm">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-xs uppercase tracking-wider text-cl-muted font-semibold">Walk State</h2>
                <span className="text-[10px] text-cl-muted">
                  {activeStep ? activeStep.walker : walkLog.length > 0 ? 'Done' : 'Idle'}
                </span>
              </div>
              <ol className="flex flex-col gap-2">
                {WALK_STEPS.map((s) => {
                  const entry = walkLog.find((l) => l.walker === s.walker);
                  const isActive = activeStep?.walker === s.walker;
                  const verdict = entry ? (entry.color ?? 'done') : null;
                  const tone =
                    verdict === 'green' ? 'border-cl-green text-cl-green' :
                    verdict === 'yellow' ? 'border-cl-yellow text-cl-yellow' :
                    verdict === 'red' ? 'border-cl-red text-cl-red' :
                    verdict === 'done' ? 'border-cl-muted text-cl-primary' :
                    'border-transparent text-cl-muted';
                  return (
                    <li key={s.walker} className={`flex items-center justify-between rounded px-2 py-1.5 text-xs transition-colors border-l-2 ${tone} ${isActive ? 'bg-cl-blue/10 border-l-cl-blue text-cl-blue' : ''} ${!entry && !isActive ? 'opacity-50' : ''}`}>
                      <div className="font-medium">{s.walker}</div>
                      <div className="text-[10px] uppercase opacity-80">
                        {verdict ?? (isActive ? 'working' : 'wait')}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Policy Card */}
            <PolicyCard />
          </div>

          {/* Center: Graph Stage */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            <GraphView
              nodes={nodes}
              edges={edges}
              traverses={activeStep?.traverses ?? []}
              activeWalker={
                activeStep && activeStep.walker !== 'Ingest' ? activeStep.walker : null
              }
            />
            {error && (
              <div className="rounded-[12px] border border-cl-red/50 bg-cl-red/10 px-4 py-3 text-sm text-cl-red">
                {error}
              </div>
            )}
          </div>

          {/* Right: Stamp Column + Panels */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <h2 className="text-xs uppercase tracking-wider text-cl-muted font-semibold mb-2 px-1">Verdicts</h2>
            <div className="flex flex-col gap-3">
              {WALKER_ORDER.map((w) => (
                <StampBadge
                  key={w}
                  walker={w}
                  color={(stamps[w]?.color as 'green' | 'yellow' | 'red' | 'unknown') ?? null}
                />
              ))}
            </div>

            <div className="mt-6">
              <AuditorPanel reasons={auditorReasons} />
            </div>

            <div className="mt-4">
              <CounselPanel narration={narration} enabled={stampsReady} />
            </div>
          </div>

        </div>

        {/* Footer: Etherscan Link */}
        {txHash && (
          <footer className="mt-8 border-t border-cl-gray/10 pt-6 flex justify-center">
            <ExplorerLink txHash={txHash} />
          </footer>
        )}
      </div>
    </main>
  );
}
