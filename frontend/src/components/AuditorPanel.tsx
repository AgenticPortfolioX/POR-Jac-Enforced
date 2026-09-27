interface AuditorPanelProps {
  reasons: string[];
}

export function AuditorPanel({ reasons }: AuditorPanelProps) {
  return (
    <div className="rounded-[12px] border border-cl-gray/10 bg-cl-surface2 p-4 text-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cl-muted px-1">
        Auditor Findings
      </h2>
      {reasons.length === 0 ? (
        <p className="text-cl-muted opacity-50 px-1 text-xs">No findings yet.</p>
      ) : (
        <ul className="space-y-1.5 px-1">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-cl-muted leading-tight">
              <span className="text-cl-green shrink-0">✓</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
