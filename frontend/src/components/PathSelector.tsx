interface PathSelectorProps {
  onSelect: (path: string) => void;
  disabled?: boolean;
}

const PATHS = [
  { key: 'live', label: '⚡ Live Feed', desc: 'Chainlink Sepolia' },
  { key: 'approved', label: '✅ Approved Path', desc: 'All green' },
  { key: 'caution', label: '⚠️ Caution Path', desc: 'Flat reserve' },
  { key: 'unknown', label: '❌ Unknown Path', desc: 'Missing child' },
];

export function PathSelector({ onSelect, disabled }: PathSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      {PATHS.map((p) => (
        <button
          key={p.key}
          id={`path-${p.key}`}
          onClick={() => onSelect(p.key)}
          disabled={disabled}
          className="flex justify-between items-center rounded-[8px] border border-cl-gray/10 bg-cl-surface2 px-4 py-3 hover:bg-cl-gray/5 hover:border-cl-gray/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors w-full text-left"
        >
          <span className="font-semibold text-sm text-cl-primary">{p.label}</span>
          <span className="text-xs text-cl-muted">{p.desc}</span>
        </button>
      ))}
    </div>
  );
}
