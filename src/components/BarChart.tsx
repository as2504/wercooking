import { useId, useState } from 'react';

export interface Bar {
  label: string;
  value: number;
  /** Full label for tooltip / table, e.g. "Thu, 8 Oct". */
  detail?: string;
}

/**
 * Single-series vertical bar chart (inline SVG, no library).
 * One hue, rounded data-end, recessive grid, per-bar hover/tap tooltip, and a table view.
 */
export function BarChart({
  data,
  title,
  format = (n) => String(n),
  height = 160,
  color = '#C2410C',
}: {
  data: Bar[];
  title: string;
  format?: (n: number) => string;
  height?: number;
  color?: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const W = 320;
  const padL = 36;
  const padB = 22;
  const padT = 10;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const plotH = height - padB - padT;
  const step = (W - padL) / data.length;
  const barW = Math.min(28, step - 2); // >= 2px surface gap between bars
  const ticks = [0, nice / 2, nice];
  const peak = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);

  return (
    <figure className="m-0">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-labelledby={`${id}-t`} onMouseLeave={() => setActive(null)}>
          <title id={`${id}-t`}>{`${title}: ${data.map((d) => `${d.detail ?? d.label} ${format(d.value)}`).join(', ')}`}</title>
          {ticks.map((t) => {
            const y = padT + plotH - (t / nice) * plotH;
            return (
              <g key={t}>
                <line x1={padL} x2={W} y1={y} y2={y} stroke="#EADFD3" strokeWidth={1} />
                <text x={padL - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#6F5E52">
                  {compact(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / nice) * plotH;
            const x = padL + i * step + (step - barW) / 2;
            const y = padT + plotH - h;
            const r = Math.min(4, h / 2, barW / 2);
            return (
              <g key={i}>
                {/* Hit target larger than the mark */}
                <rect
                  x={padL + i * step}
                  y={padT}
                  width={step}
                  height={plotH + padB}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(active === i ? null : i)}
                  aria-hidden="true"
                />
                {h > 0 && (
                  <path
                    d={`M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`}
                    fill={color}
                    opacity={active === null || active === i ? 1 : 0.45}
                    pointerEvents="none"
                  />
                )}
                <text x={padL + i * step + step / 2} y={height - 6} textAnchor="middle" fontSize="10" fill={active === i ? '#2B1D14' : '#6F5E52'} fontWeight={active === i ? 700 : 400} pointerEvents="none">
                  {d.label}
                </text>
                {i === peak && active === null && d.value > 0 && (
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#2B1D14" pointerEvents="none">
                    {format(d.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${((padL + active * step + step / 2) / W) * 100}%` }}
            role="status"
          >
            <span className="block text-white/70">{data[active].detail ?? data[active].label}</span>
            <span className="font-bold">{format(data[active].value)}</span>
          </div>
        )}
      </div>
      <figcaption className="mt-1 flex justify-end">
        <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </figcaption>
      {showTable && (
        <table className="mt-1 w-full text-sm">
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-line">
                <th scope="row" className="py-1 text-left font-normal">{d.detail ?? d.label}</th>
                <td className="py-1 text-right font-semibold tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

function niceMax(n: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const m = n / p;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * p;
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}
