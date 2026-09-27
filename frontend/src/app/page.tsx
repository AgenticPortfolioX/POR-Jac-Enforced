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
  type WalkEntry,
  type WalkStep,
} from '@/lib/constants';
import type { Stamp } from '@/lib/types';
import { GraphView } from '@/components/GraphView';
import { StampBadge } from '@/components/StampBadge';
import { PathSelector } from '@/components/PathSelector';
import { MintButton } from '@/components/MintButton';
import { ExplorerLink } from '@/components/ExplorerLink';
import { PolicyCard } from '@/components/PolicyCard';
import { WalkWheel } from '@/components/WalkWheel';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      const cfg = PATH_CONFIG[path as PathName] ?? PATH_CONFIG.approved;

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
          token_address: process.env.NEXT_PUBLIC_POR_TOKEN_ADDRESS || '0x77a3A9fCe83c715AB8020fe72e94669C3298b321',
          attestation_address:
            process.env.NEXT_PUBLIC_POR_ATTESTATION_ADDRESS || '0x455DF022Fe8A69D59616F4Ee58eE1B23D4fE9116',
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
        <header className="flex flex-col md:flex-row md:items-start justify-between border-b border-cl-gray/10 pb-6 gap-6">
          <div className="shrink-0 mt-2 w-full md:w-1/4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-cl-muted mb-1 font-semibold">Chainlink attestation, Jac enforcement</div>
            <h1 className="text-2xl font-normal tracking-tight text-white">
              Proof of Reserve, Jac Enforced
            </h1>
          </div>
          
          {/* Live Execution Feed */}
          <div className="w-full md:w-1/2 bg-[#0A0C10] border border-cl-gray/10 rounded-[8px] p-3 shadow-inner flex flex-col justify-center min-h-[72px] font-mono text-[11px] overflow-hidden relative">
            {activeStep ? (
              <div className="flex items-start gap-3">
                <span className="text-cl-blue font-bold mt-0.5 animate-pulse">▶</span>
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-white font-bold uppercase">{activeStep.walker} Walker Running...</span>
                    <span className="text-cl-blue animate-pulse uppercase text-[9px] tracking-widest bg-cl-blue/10 px-2 py-0.5 rounded">Processing</span>
                  </div>
                  <span className="text-cl-muted">Action: {activeStep.intent}</span>
                  <span className="text-cl-muted">Reviewing: {activeStep.traverses.join(' → ')}</span>
                </div>
              </div>
            ) : pending ? (
              <div className="flex items-start gap-3">
                <span className="text-cl-primary font-bold mt-0.5 animate-pulse">▶</span>
                <div className="flex flex-col gap-1">
                  <span className="text-white font-bold uppercase">Act Walker Running...</span>
                  <span className="text-cl-muted">Action: Validating 3 prior stamps for minting condition</span>
                </div>
              </div>
            ) : walkLog.length > 0 ? (
              <div className="flex items-center justify-between gap-4 w-full h-full">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className={allGreen ? "text-cl-green font-bold mt-0.5 text-xs shrink-0" : "text-cl-red font-bold mt-0.5 text-xs shrink-0"}>■</span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-white font-bold uppercase text-[12px] tracking-wide">Execution Complete</span>
                    <span className="text-cl-muted text-[11px] leading-snug">
                      {allGreen ? 'All stamps are GREEN. The graph permits minting.' : 'One or more stamps failed the policy graph.'}
                    </span>
                    {!allGreen && auditorReasons.length > 0 && (
                      <span className="text-cl-caution mt-0.5 text-[10px]">Audit Findings: {auditorReasons.join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-center">
                  <div className={`uppercase text-[28px] md:text-[34px] font-black tracking-widest px-6 py-2 rounded-lg border leading-none select-none ${
                    allGreen 
                      ? 'bg-cl-green/15 text-cl-green border-cl-green/50 shadow-[0_0_20px_rgba(5,196,107,0.3)] animate-pulse' 
                      : 'bg-cl-red/15 text-cl-red border-cl-red/50 shadow-[0_0_20px_rgba(255,94,87,0.3)]'
                  }`}>
                    {allGreen ? 'APPROVED' : 'REJECTED'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-cl-muted opacity-50 h-full">
                <span className="font-bold animate-pulse">_</span>
                <span className="uppercase tracking-widest">System Idle. Awaiting execution.</span>
              </div>
            )}
          </div>

          {/* Counsel Walker in Header */}
          <div className="w-full md:w-1/4">
            {(() => {
              const counselColor = !narration ? null : (allGreen ? 'green' : (stamps['Auditor']?.color === 'red' || stamps['Cover']?.color === 'red' ? 'red' : 'caution'));
              
              // Trim narration
              let shortNarration = narration;
              if (narration && allGreen) {
                 shortNarration = "All conditions met. The mint was justified and successfully processed.";
              } else if (narration) {
                 const parts = narration.split('. ');
                 shortNarration = parts[0] + (parts.length > 1 ? '.' : '');
              }

              return (
                <StampBadge
                  key="Counsel"
                  walker="Counsel"
                  color={counselColor}
                  narration={shortNarration}
                />
              );
            })()}
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
                <MintButton
                  enabled={allGreen}
                  justified={justified}
                  onMint={onMint}
                  pending={pending}
                />
              </div>
            </section>

            {/* Walk State - one wheel slice per walker */}
            <section className="rounded-[12px] border border-cl-gray/10 bg-cl-surface1 p-4 shadow-sm">
              <WalkWheel log={walkLog} activeWalker={activeStep?.walker ?? null} />
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

            {/* Walker Documentation */}
            <section className="rounded-[12px] border border-cl-gray/10 bg-cl-surface1 p-6 shadow-sm mt-6">
              <h2 className="mb-4 text-sm uppercase tracking-widest text-cl-primary font-semibold border-b border-cl-gray/10 pb-3">
                Jac Walkers: Sequential Execution
              </h2>
              <p className="text-xs text-cl-muted mb-5 leading-relaxed">
                Jac Walkers execute <strong>strictly 1 at a time (sequentially)</strong>. When you click a path, the walkers traverse the graph in order. Each walker reads the graph, leaves a cryptographic stamp, and passes the baton to the next. The final transaction cannot proceed unless all stamps are present and green.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-[8px] bg-cl-surface2 p-3 border border-cl-gray/5">
                  <div className="text-cl-green font-semibold text-xs mb-1">1. Freshness Walker</div>
                  <div className="text-[10px] text-cl-muted leading-tight">Checks the age of the Chainlink price feed and the reserve attestation against the active policy.</div>
                </div>
                <div className="rounded-[8px] bg-cl-surface2 p-3 border border-cl-gray/5">
                  <div className="text-cl-blue font-semibold text-xs mb-1">2. Cover Walker</div>
                  <div className="text-[10px] text-cl-muted leading-tight">Calculates the justified mint amount based on the proven reserves, price, and current liabilities.</div>
                </div>
                <div className="rounded-[8px] bg-cl-surface2 p-3 border border-cl-gray/5">
                  <div className="text-cl-caution font-semibold text-xs mb-1">3. Auditor Walker</div>
                  <div className="text-[10px] text-cl-muted leading-tight">Verifies structural integrity (like ensuring child claims exist) and flags any flatline reserves.</div>
                </div>
                <div className="rounded-[8px] bg-cl-surface2 p-3 border border-cl-gray/5">
                  <div className="text-cl-primary font-semibold text-xs mb-1">4. Act & Counsel</div>
                  <div className="text-[10px] text-cl-muted leading-tight">Act Walker mints only if all 3 prior stamps are green. Counsel Walker explains any failures if stamps are yellow or red.</div>
                </div>
              </div>
            </section>
          </div>

          {/* Right: Stamp Column + Panels */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <h2 className="text-base uppercase tracking-widest text-white font-bold mb-5 text-center">Verdicts</h2>
            <div className="flex flex-col gap-3">
              {WALKER_ORDER.map((w) => {
                // Hide old database state. Only show a stamp if it completed in the current run's walkLog.
                const hasFinishedTurn = walkLog.some((log) => log.walker === w);
                const stampData = hasFinishedTurn ? stamps[w] : null;
                const isComplete = stampData?.color != null;

                const findings = w === 'Auditor' 
                  ? (hasFinishedTurn ? auditorReasons : [])
                  : isComplete 
                    ? (w === 'Freshness' 
                        ? ['Data age bounds verified', 'Feed liveness confirmed'] 
                        : ['Liability sum verified', 'Coverage ratio computed']) 
                    : [];

                return (
                  <StampBadge
                    key={w}
                    walker={w}
                    color={(stampData?.color as 'green' | 'caution' | 'red' | 'unknown') ?? null}
                    findings={findings}
                  />
                );
              })}
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
