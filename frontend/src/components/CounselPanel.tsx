interface CounselPanelProps {
  narration: string | null;
  enabled: boolean;
}

export function CounselPanel({ narration, enabled }: CounselPanelProps) {
  return (
    <div className="rounded-[12px] border border-cl-gray/10 bg-[#0A0D14] p-4 text-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cl-muted px-1">
        Counsel
      </h2>
      {!enabled ? (
        <p className="text-cl-muted opacity-50 px-1 text-xs">
          Counsel is blind until three stamps exist.
        </p>
      ) : (
        <p className="text-cl-primary text-xs leading-relaxed px-1 opacity-90">{narration ?? '...'}</p>
      )}
    </div>
  );
}
