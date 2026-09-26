// frontend/src/components/PathSelector.tsx
// Purpose: Select the demo path (happy / yellow / unknown)
// Owner walker/module: frontend
// Spec: see PRD §12
// Status: IMPLEMENTED — Prompt 12

interface PathSelectorProps {
  onSelect: (path: string) => void;
  disabled?: boolean;
}

const PATHS = [
  { key: 'happy', label: '✅ Happy Path', desc: 'All green' },
  { key: 'yellow', label: '⚠️ Yellow Path', desc: 'Flat reserve' },
  { key: 'unknown', label: '❌ Unknown Path', desc: 'Missing child' },
];

export function PathSelector({ onSelect, disabled }: PathSelectorProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      {PATHS.map((p) => (
        <button
          key={p.key}
          id={`path-${p.key}`}
          onClick={() => onSelect(p.key)}
          disabled={disabled}
          className="flex flex-col items-start rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          <span className="font-semibold text-sm text-neutral-100">{p.label}</span>
          <span className="text-xs text-neutral-400 mt-0.5">{p.desc}</span>
        </button>
      ))}
    </div>
  );
}
