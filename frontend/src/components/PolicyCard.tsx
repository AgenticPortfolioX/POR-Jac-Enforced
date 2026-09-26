// frontend/src/components/PolicyCard.tsx
// Purpose: Display active policy configuration values
// Owner walker/module: frontend
// Spec: see PRD §12
// Status: IMPLEMENTED — Prompt 12

const POLICY = {
  max_price_age_seconds: 300,
  max_reserve_age_seconds: 3600,
  min_coverage_ratio: 1.0,
  coverage_floor_ratio: 0.95,
  flat_reserve_epsilon: 0.001,
  flat_reserve_windows: 3,
  child_max_age_seconds: 3600,
};

export function PolicyCard() {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Active Policy
      </h2>
      <ul className="space-y-1">
        {Object.entries(POLICY).map(([key, value]) => (
          <li key={key} className="flex justify-between text-xs">
            <span className="text-neutral-400">{key.replace(/_/g, ' ')}</span>
            <span className="font-mono text-neutral-200">{String(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
