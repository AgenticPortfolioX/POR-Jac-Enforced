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
    <div className="rounded-[12px] border border-cl-gray/10 bg-cl-surface1 p-4 mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cl-muted px-1">
        Active Policy
      </h2>
      <ul className="space-y-1.5 px-1">
        {Object.entries(POLICY).map(([key, value]) => (
          <li key={key} className="flex justify-between items-center text-xs border-b border-cl-gray/5 pb-1 last:border-0 last:pb-0">
            <span className="text-cl-muted capitalize">{key.replace(/_/g, ' ')}</span>
            <span className="font-mono text-cl-primary bg-cl-surface2 px-1.5 py-0.5 rounded text-[10px]">{String(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
