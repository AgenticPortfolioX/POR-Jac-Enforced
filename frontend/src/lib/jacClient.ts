// frontend/src/lib/jacClient.ts
// Purpose: HTTP client stub for interacting with Jac Cloud walker endpoints
// Owner walker/module: shared
// Spec: see PRD §9
// Status: SCAFFOLD — no logic implemented

/*
 * Endpoint Table (PRD §9):
 * ------------------------------------------------------------------------------------------
 * Method | Path                  | Walker              | Description
 * ------------------------------------------------------------------------------------------
 * POST   | /walker/ingest        | IngestWalker        | Ingest oracle feeds / fixture observations
 * POST   | /walker/freshness     | FreshnessWalker     | Evaluate feed freshness and staleness
 * POST   | /walker/cover         | CoverWalker         | Evaluate collateral coverage ratio
 * POST   | /walker/auditor       | AuditorWalker       | Aggregate checks and produce Stamp
 * POST   | /walker/act           | ActWalker           | Trigger EVM mint and attestation
 * POST   | /walker/counsel       | CounselWalker       | Get explanation & mitigation steps
 * POST   | /walker/demo_control  | DemoControlWalker   | Execute demo path (happy/yellow/unknown)
 * GET    | /graph/state          | N/A                 | Fetch current graph nodes & edges
 * ------------------------------------------------------------------------------------------
 */

export async function runIngest(source: string, fixtureName?: string): Promise<any> {
  throw new Error("not implemented");
}

export async function runFreshness(maxStalenessSeconds?: number): Promise<any> {
  throw new Error("not implemented");
}

export async function runCover(minCoverageRatio?: number): Promise<any> {
  throw new Error("not implemented");
}

export async function runAuditor(): Promise<any> {
  throw new Error("not implemented");
}

export async function runAct(recipient: string, amount: number): Promise<any> {
  throw new Error("not implemented");
}

export async function runCounsel(stampId?: string): Promise<any> {
  throw new Error("not implemented");
}

export async function runDemoControl(path: 'happy' | 'yellow' | 'unknown'): Promise<any> {
  throw new Error("not implemented");
}

export async function getGraphState(): Promise<any> {
  throw new Error("not implemented");
}
