interface CounselPanelProps {
  narration: string | null;
  enabled: boolean;
}

export function CounselPanel({ narration, enabled }: CounselPanelProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Counsel
      </h2>
      {!enabled ? (
        <p className="italic text-neutral-500">
          Counsel is blind until three stamps exist.
        </p>
      ) : (
        <p className="text-neutral-200 leading-relaxed">{narration ?? '...'}</p>
      )}
    </div>
  );
}
