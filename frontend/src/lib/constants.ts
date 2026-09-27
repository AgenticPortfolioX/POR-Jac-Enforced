export const JAC_CLOUD_URL =
  process.env.NEXT_PUBLIC_JAC_URL ?? 'http://localhost:8000';

export const ASSET_ID = 'asset-1';

export const COLOR_GREEN = 'green';
export const COLOR_CAUTION = 'caution';
export const COLOR_RED = 'red';
export const COLOR_UNKNOWN = 'unknown';

export const WALKER_ORDER = ['Freshness', 'Cover', 'Auditor'] as const;
export type WalkerName = (typeof WALKER_ORDER)[number];

/** One walker, and what it is doing when it is on screen. */
export interface WalkStep {
  walker: string;
  intent: string;
  /** Edge types this walker reads or writes. These animate while it runs. */
  traverses: readonly string[];
}

/**
 * The visible walk. The UI drives these one at a time rather than calling
 * DemoControl, so each walker can be seen arriving, traversing and stamping.
 * `DemoControl` still exists for the CLI and for tests - it runs all four in
 * one frame, which is correct server-side but invisible on screen.
 */
export const WALK_STEPS: readonly WalkStep[] = [
  {
    walker: 'Ingest',
    intent: 'reading the PoR and price feeds',
    traverses: ['HasPrice', 'HasReserve', 'HasLiability', 'DependsOn'],
  },
  {
    walker: 'Freshness',
    intent: 'checking the clocks',
    traverses: ['HasPrice', 'HasReserve'],
  },
  {
    walker: 'Cover',
    intent: 'sizing the mint against coverage',
    traverses: ['HasPrice', 'HasReserve', 'HasLiability', 'DependsOn'],
  },
  {
    walker: 'Auditor',
    intent: 'attacking the claim',
    traverses: ['HasPrice', 'HasReserve', 'HasLiability', 'DependsOn'],
  },
] as const;

/** The fixture and child state that define each demo path. */
export const PATH_CONFIG = {
  approved: { fixture: 'por_live', childPresent: true },
  caution: { fixture: 'por_flat', childPresent: true },
  unknown: { fixture: 'por_live', childPresent: false },
} as const;

export type PathName = keyof typeof PATH_CONFIG;

/** How long each walker stays highlighted, in ms. */
export const WALK_STEP_MS = 2500;

export const WALKER_BRAND_COLORS: Record<string, string> = {
  Freshness: '#05C46B', // green
  Cover: '#0847F7', // blue
  Auditor: '#FFDD59', // caution
  Act: '#F5F7FA', // primary
  Counsel: '#F5F7FA',
};
