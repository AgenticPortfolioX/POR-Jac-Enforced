// frontend/src/lib/constants.ts
// Purpose: Application constants and color mappings
// Owner walker/module: shared
// Spec: see PRD §4, §5, §9
// Status: SCAFFOLD — no logic implemented

export const JAC_CLOUD_URL =
  process.env.NEXT_PUBLIC_JAC_URL ?? "http://localhost:8000";

export const COLORS = {
  green: "#10B981",
  yellow: "#F59E0B",
  red: "#EF4444",
  unknown: "#6B7280",
} as const;

export const COLOR_RANKS = {
  green: 0,
  yellow: 1,
  red: 2,
  unknown: 3,
} as const;
