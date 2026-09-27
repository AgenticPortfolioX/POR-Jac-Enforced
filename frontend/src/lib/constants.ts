export const JAC_CLOUD_URL =
  process.env.NEXT_PUBLIC_JAC_URL ?? 'http://localhost:8000';

export const ASSET_ID = 'asset-1';

export const COLOR_GREEN = 'green';
export const COLOR_YELLOW = 'yellow';
export const COLOR_RED = 'red';
export const COLOR_UNKNOWN = 'unknown';

export const WALKER_ORDER = ['Freshness', 'Cover', 'Auditor'] as const;
export type WalkerName = (typeof WALKER_ORDER)[number];
