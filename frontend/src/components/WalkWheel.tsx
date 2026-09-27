'use client';

import { WALK_STEPS, type WalkEntry } from '@/lib/constants';

/**
 * The Walk State wheel: four 90-degree slices, clockwise from 12 o'clock, in
 * walk order (Ingest, Freshness, Cover, Auditor).
 *
 * Slices are divided by the walkers' colors:
 * - Ingest: White
 * - Freshness: Green
 * - Cover: Blue
 * - Auditor: Silver
 *
 * Each segment turns Gold as the walker completes its check.
 * When the mint is approved, the center circle turns Gold.
 */

type SliceState =
  | 'idle'
  | 'running'
  | 'done'
  | 'green'
  | 'caution'
  | 'red'
  | 'unknown';

const WALKER_BRAND_COLORS: Record<string, string> = {
  Ingest: '#FFFFFF',
  Freshness: '#05C46B',
  Cover: '#0847F7',
  Auditor: '#CBD5E1',
};

const GOLD_COLOR = '#D4AF37';

const FAILED_LABEL: Partial<Record<SliceState, string>> = {
  red: 'REFUSED',
  unknown: 'UNKNOWN',
};

const CENTER = 50;
const RIM_RADIUS = 47;
const ARC_RADIUS = 36;
const TICK_INNER = 25;
const TICK_OUTER = 31;
const SLICE_DEGREES = 90;

/** A point at `angle` degrees clockwise from 12 o'clock. */
function point(angle: number, radius: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function arcPath(startAngle: number): string {
  const [x0, y0] = point(startAngle, ARC_RADIUS);
  const [x1, y1] = point(startAngle + SLICE_DEGREES, ARC_RADIUS);
  return `M ${x0} ${y0} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${x1} ${y1}`;
}

/** A short tick pointing inward from the arc, at the slice's mid-angle. */
function tickPath(startAngle: number): string {
  const mid = startAngle + SLICE_DEGREES / 2;
  const [x0, y0] = point(mid, TICK_INNER);
  const [x1, y1] = point(mid, TICK_OUTER);
  return `M ${x0} ${y0} L ${x1} ${y1}`;
}

/** Which corner each slice's label sits in. Slice 0 spans 12 to 3 o'clock. */
const LABEL_POSITION = [
  'right-0 top-0 text-right',
  'right-0 bottom-0 text-right',
  'left-0 bottom-0 text-left',
  'left-0 top-0 text-left',
] as const;

function resolveState(
  walker: string,
  entry: WalkEntry | undefined,
  isActive: boolean
): SliceState {
  if (isActive) return 'running';
  if (!entry) return 'idle';
  if (walker === 'Ingest') return 'done';
  if (entry.color === 'green') return 'green';
  if (entry.color === 'caution') return 'caution';
  if (entry.color === 'red') return 'red';
  if (entry.color === 'unknown') return 'unknown';
  return 'done';
}

interface WalkWheelProps {
  log: readonly WalkEntry[];
  activeWalker: string | null;
  isApproved?: boolean;
}

export function WalkWheel({ log, activeWalker, isApproved }: WalkWheelProps) {
  const slices = WALK_STEPS.map((step, index) => {
    const entry = log.find((l) => l.walker === step.walker);
    const state = resolveState(step.walker, entry, activeWalker === step.walker);
    return { step, index, state };
  });

  const hasRun = log.length > 0;
  const greenCount = slices.filter((s) => s.state === 'green').length;
  const anyFailed = slices.some((s) => s.state === 'red' || s.state === 'unknown');
  const anyCaution = slices.some((s) => s.state === 'caution');
  const allSettled = slices.every((s) => s.state !== 'idle' && s.state !== 'running');
  const ingestDone = slices[0]?.state === 'done';
  const enforcementGreen = greenCount === 3 && ingestDone;

  const approved = hasRun && allSettled && (isApproved !== undefined ? isApproved : enforcementGreen);

  const status = !hasRun && !activeWalker
    ? 'Idle'
    : anyFailed
      ? 'Refused'
      : anyCaution
        ? 'Caution'
        : activeWalker
          ? 'Running'
          : approved
            ? 'Approved'
            : allSettled
              ? 'Done'
              : 'Running';

  const halo = approved
    ? GOLD_COLOR
    : anyFailed
      ? '#FF5E57'
      : anyCaution
        ? '#FFDD59'
        : null;

  const caption = !hasRun && !activeWalker
    ? 'Awaiting walk execution'
    : anyFailed || anyCaution
      ? 'Issuance locked'
      : approved
        ? 'Mint Approved (Gold)'
        : `${greenCount} / 3 checks passed`;

  const summary = slices
    .map((s) => `${s.step.walker}: ${s.state}`)
    .join(', ');

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cl-muted">
          Walk State
        </h2>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{
            color:
              approved
                ? GOLD_COLOR
                : status === 'Done'
                  ? '#05C46B'
                  : status === 'Caution'
                    ? '#FFDD59'
                    : status === 'Refused'
                      ? '#FF5E57'
                      : undefined,
          }}
        >
          {status}
        </span>
      </div>

      <div className="relative mx-auto h-[56px] w-[140px]">
        <svg
          viewBox="0 0 100 100"
          className="absolute left-1/2 top-1/2 h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2"
          role="img"
          aria-label={`Walk state, ${status}. ${summary}`}
        >
          {/* Outer Rim */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RIM_RADIUS}
            fill="none"
            strokeWidth={2}
            stroke={halo ?? 'rgba(245, 247, 250, 0.12)'}
            style={
              halo
                ? { filter: `drop-shadow(0 0 4px ${halo})` }
                : undefined
            }
          />

          {/* Slices */}
          {slices.map(({ step, index, state }) => {
            const brandColor = WALKER_BRAND_COLORS[step.walker] || '#FFFFFF';
            const isCompleted = state === 'green' || (step.walker === 'Ingest' && state === 'done');
            const isRunning = state === 'running';
            const isFailed = state === 'red' || state === 'unknown';
            const isWarn = state === 'caution';

            // Each segment turns gold as the walker completes its check
            const sliceColor = isCompleted
              ? GOLD_COLOR
              : isFailed
                ? '#FF5E57'
                : isWarn
                  ? '#FFDD59'
                  : brandColor;

            return (
              <g key={step.walker}>
                {/* Base segment track: divided by walker colors */}
                <path
                  d={arcPath(index * SLICE_DEGREES)}
                  fill="none"
                  strokeWidth={9}
                  strokeLinecap="butt"
                  stroke={brandColor}
                  opacity={0.35}
                />
                {/* Active / Completed glowing slice */}
                <path
                  className={`wheel-slice ${
                    isRunning ? 'wheel-slice-running' : ''
                  }`}
                  d={arcPath(index * SLICE_DEGREES)}
                  fill="none"
                  strokeWidth={9}
                  strokeLinecap="butt"
                  stroke={sliceColor}
                  opacity={isCompleted || isRunning || isFailed || isWarn ? 1 : 0}
                  style={
                    isCompleted
                      ? { filter: `drop-shadow(0 0 3px ${GOLD_COLOR})` }
                      : isRunning
                        ? { filter: `drop-shadow(0 0 3px ${brandColor})` }
                        : undefined
                  }
                />
                {/* Divider tick */}
                <path
                  className="wheel-slice"
                  d={tickPath(index * SLICE_DEGREES)}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  stroke={isCompleted ? GOLD_COLOR : brandColor}
                  opacity={isCompleted ? 0.9 : 0.45}
                />
              </g>
            );
          })}

          {/* Center Circle: turns Gold when mint is approved */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={16}
            className="transition-all duration-700 ease-in-out"
            fill={approved ? GOLD_COLOR : '#141824'}
            stroke={approved ? '#FFF5C0' : 'rgba(245, 247, 250, 0.2)'}
            strokeWidth={approved ? 2 : 1.5}
            style={
              approved
                ? { filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.85))' }
                : undefined
            }
          />

          {/* Center Icon: checkmark on approval, subtle core otherwise */}
          {approved ? (
            <path
              d="M 43 50 L 48 55 L 57 44"
              fill="none"
              stroke="#0E1119"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={3}
              fill="rgba(154, 163, 181, 0.3)"
            />
          )}
        </svg>

        {/* Labels around the wheel */}
        {slices.map(({ step, index, state }) => {
          const brandColor = WALKER_BRAND_COLORS[step.walker] || '#FFFFFF';
          const isCompleted = state === 'green' || (step.walker === 'Ingest' && state === 'done');
          const isRunning = state === 'running';

          return (
            <span
              key={step.walker}
              className={`absolute text-[9px] font-semibold uppercase leading-none tracking-wider transition-colors duration-300 ${
                LABEL_POSITION[index]
              }`}
              style={{
                color: isCompleted
                  ? GOLD_COLOR
                  : isRunning
                    ? brandColor
                    : state === 'red' || state === 'unknown'
                      ? '#FF5E57'
                      : 'rgba(154, 163, 181, 0.6)',
              }}
            >
              {FAILED_LABEL[state] ?? step.walker}
            </span>
          );
        })}
      </div>

      <p className="mt-1 text-center text-[10px] leading-none text-cl-muted">
        {caption}
      </p>
    </div>
  );
}
