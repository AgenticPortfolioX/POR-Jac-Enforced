type Color = 'green' | 'yellow' | 'red' | 'unknown';

const colorMap: Record<Color, string> = {
  green: 'border-cl-green text-cl-green bg-cl-green/10',
  yellow: 'border-cl-yellow text-cl-yellow bg-cl-yellow/10',
  red: 'border-cl-red text-cl-red bg-cl-red/10',
  unknown: 'border-cl-unknown text-cl-unknown bg-cl-unknown/10',
};

const leftBarMap: Record<Color, string> = {
  green: 'bg-cl-green',
  yellow: 'bg-cl-yellow',
  red: 'bg-cl-red',
  unknown: 'bg-cl-unknown',
};

interface StampBadgeProps {
  walker: string;
  color: Color | null;
}

export function StampBadge({ walker, color }: StampBadgeProps) {
  const borderPill = color ? colorMap[color] : 'border-cl-gray/10 text-cl-muted';
  const leftBar = color ? leftBarMap[color] : 'bg-transparent';
  const label = color ?? 'pending';

  return (
    <div className={`relative flex flex-col justify-center rounded-[12px] border bg-cl-surface1 px-5 py-3 overflow-hidden min-w-[180px] transition-colors duration-300 ${color ? 'border-cl-gray/20' : 'border-cl-gray/10'}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${leftBar}`} />
      <span className="text-xs uppercase tracking-wider text-cl-muted mb-1 font-semibold">{walker}</span>
      <span className={`self-start rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${borderPill}`}>
        {label}
      </span>
    </div>
  );
}
