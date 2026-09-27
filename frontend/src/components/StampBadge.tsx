import { WALKER_BRAND_COLORS } from '@/lib/constants';

type Color = 'green' | 'caution' | 'red' | 'unknown';

const colorMap: Record<Color, string> = {
  green: 'border-cl-green text-cl-green bg-cl-green/10',
  caution: 'border-cl-caution text-cl-caution bg-cl-caution/10',
  red: 'border-cl-red text-cl-red bg-cl-red/10',
  unknown: 'border-cl-unknown text-cl-unknown bg-cl-unknown/10',
};

interface StampBadgeProps {
  walker: string;
  color: Color | null;
  findings?: string[];
  narration?: string | null;
}

export function StampBadge({ walker, color, findings = [], narration = null }: StampBadgeProps) {
  const borderPill = color ? colorMap[color] : 'border-cl-gray/10 text-cl-muted';
  const label = color ?? 'pending';
  const brandColor = WALKER_BRAND_COLORS[walker] || '#F5F7FA';

  return (
    <div className={`relative flex flex-col justify-start rounded-[12px] border bg-cl-surface1 px-5 py-4 overflow-hidden min-w-[220px] transition-colors duration-300 ${color ? 'border-cl-gray/20' : 'border-cl-gray/10'}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: brandColor }} />
      
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-cl-primary font-semibold">
          {walker} Walker
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${borderPill}`}>
          {label}
        </span>
      </div>

      {findings.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] uppercase text-cl-muted tracking-wider font-semibold mb-1">Findings</div>
          {findings.map((r, i) => (
            <div key={i} className="flex items-start text-xs text-cl-primary leading-tight">
              <span className="mr-1.5 opacity-60">›</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {narration && (
        <div className="mt-2">
          <div className="text-[10px] uppercase text-cl-muted tracking-wider font-semibold mb-1">Counsel Report</div>
          <div className="text-xs text-cl-primary leading-relaxed italic border-l-2 border-cl-gray/20 pl-2">
            "{narration}"
          </div>
        </div>
      )}
    </div>
  );
}
