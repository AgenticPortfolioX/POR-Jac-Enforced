interface AuditorPanelProps {
  reasons: string[];
}

export function AuditorPanel({ reasons }: AuditorPanelProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Auditor Findings
      </h2>
      {reasons.length === 0 ? (
        <p className="text-neutral-500 italic">No findings yet.</p>
      ) : (
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className="text-neutral-200">
              — {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
