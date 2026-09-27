type Color = 'green' | 'yellow' | 'red' | 'unknown';

const colorMap: Record<Color, string> = {
  green: 'bg-green-600 text-white',
  yellow: 'bg-yellow-500 text-black',
  red: 'bg-red-600 text-white',
  unknown: 'bg-neutral-600 text-neutral-300',
};

interface StampBadgeProps {
  walker: string;
  color: Color | null;
}

export function StampBadge({ walker, color }: StampBadgeProps) {
  const pill = color ? colorMap[color] : 'bg-neutral-800 text-neutral-500';
  const label = color ?? 'pending';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-800 px-4 py-2">
      <span className="text-sm font-medium text-neutral-300">{walker}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${pill}`}>
        {label}
      </span>
    </div>
  );
}
