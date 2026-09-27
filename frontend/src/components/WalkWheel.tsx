'use client';

import { WALK_STEPS, type WalkEntry } from '@/lib/constants';

/**
 * The Walk State wheel: four 90-degree slices, clockwise from 12 o'clock, in
 * walk order (Ingest, Freshness, Cover, Auditor). It reports one thing only —
 * which walkers have landed a stamp — so it reads at a glance next to the graph.
 *
 * A slice is lit only by the walker that owns it; earlier slices stay lit and
 * later ones stay dim, so the wheel doubles as a progress indicator.
 */

type SliceState =
  | 'idle'
  | 'running'
  | 'done'
  | 'green'
  | 'caution'
  | 'red'
  | 'unknown';

/**
 * Idle, running and done are the wheel's own vocabulary. The rest are the
 * verdict colours the stamps already use, so a slice and its badge agree.
 */
const SLICE_COLOR: Record<SliceState, string> = {
  idle: 'rgba(154, 163, 181, 0.08)', // graphite at 8% — the unlit track
  running: '#22D3EE', // soft cyan
  done: '#E2E8F0', // cool white / silver — Ingest reports sources, not a verdict
  green: '#05C46B',
  caution: '#FFDD59',
  red: '#FF5E57',
  unknown: '#B4636B', // muted rose-red
};

/** A slice that did not pass says so in place of the walker's name. */
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
  // A walker that reported without a colour still completed.
  return 'done';
}

interface WalkWheelProps {
  log: readonly WalkEntry[];
  activeWalker: string | null;
}

export function WalkWheel({ log, activeWalker }: WalkWheelProps) {
  const slices = WALK_STEPS.map((step, index) => {
    const entry = log.find((l) => l.walker === step.walker);
    const state = resolveState(step.walker, entry, activeWalker === step.walker);
    return { step, index, state };
  });

  const greenCount = slices.filter((s) => s.state === 'green').length;
  const anyFailed = slices.some((s) => s.state === 'red' || s.state === 'unknown');
  const anyCaution = slices.some((s) => s.state === 'caution');
  const allSettled = slices.every((s) => s.state !== 'idle' && s.state !== 'running');
  const ingestDone = slices[0]?.state === 'done';
  const enforcementGreen = greenCount === 3 && ingestDone;

  const status = anyFailed
    ? 'Refused'
    : anyCaution
      ? 'Caution'
      : activeWalker
        ? 'Running'
        : allSettled
          ? 'Done'
          : log.length > 0
            ? 'Refused' // a walk that stopped short means a walker refused
            : 'Idle';

  // The rim carries the terminal verdict; it stays dark until the walk settles.
  const halo = anyFailed
    ? SLICE_COLOR.red
    : anyCaution
      ? SLICE_COLOR.caution
      : enforcementGreen
        ? SLICE_COLOR.green
        : null;

  const caption =
    anyFailed || anyCaution ? 'Issuance locked' : `${greenCount} / 4 green`;

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
          className="text-[10px] uppercase tracking-wider"
          style={{
            color:
              status === 'Done'
                ? SLICE_COLOR.green
                : status === 'Caution'
                  ? SLICE_COLOR.caution
                  : status === 'Refused'
                    ? SLICE_COLOR.red
                    : undefined,
          }}
        >
          {status}
        </span>
      </div>

      <div className="relative mx-auto h-[48px] w-[140px]">
        <svg
          viewBox="0 0 100 100"
          className="absolute left-1/2 top-1/2 h-[48px] w-[48px] -translate-x-1/2 -translate-y-1/2"
          role="img"
          aria-label={`Walk state, ${status}. ${summary}`}
        >
          {/* The rim. Thin and dark until the walk settles, then it takes the verdict. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RIM_RADIUS}
            fill="none"
            strokeWidth={2.5}
            stroke={halo ?? 'rgba(245, 247, 250, 0.10)'}
            style={
              halo
                ? { filter: `drop-shadow(0 0 3px ${halo})` }
                : undefined
            }
          />
          {slices.map(({ step, index, state }) => {
            const lit = state !== 'idle';
            const color = SLICE_COLOR[state];
            return (
              <g key={step.walker}>
                <path
                  d={arcPath(index * SLICE_DEGREES)}
                  fill="none"
                  strokeWidth={10}
                  strokeLinecap="butt"
                  stroke={SLICE_COLOR.idle}
                />
                <path
                  className={`wheel-slice ${
                    state === 'running' ? 'wheel-slice-running' : ''
                  }`}
                  d={arcPath(index * SLICE_DEGREES)}
                  fill="none"
                  strokeWidth={10}
                  strokeLinecap="butt"
                  stroke={color}
                  opacity={lit ? 1 : 0}
                  style={lit ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}
                />
                <path
                  className="wheel-slice"
                  d={tickPath(index * SLICE_DEGREES)}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  stroke={lit ? color : 'rgba(154, 163, 181, 0.35)'}
                  opacity={lit ? 0.9 : 0.5}
                />
              </g>
            );
          })}
        </svg>

        {slices.map(({ step, index, state }) => (
          <span
            key={step.walker}
            className={`absolute text-[9px] uppercase leading-none tracking-wider ${
              LABEL_POSITION[index]
            } ${
              state === 'idle'
                ? 'text-cl-muted'
                : state === 'red' || state === 'unknown'
                  ? 'text-cl-red'
                  : 'text-cl-primary'
            }`}
          >
            {FAILED_LABEL[state] ?? step.walker}
          </span>
        ))}
      </div>

      <p className="mt-1 text-center text-[10px] leading-none text-cl-muted">
        {caption}
      </p>
    </div>
  );
}
