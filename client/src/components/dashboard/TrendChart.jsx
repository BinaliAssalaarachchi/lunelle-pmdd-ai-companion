import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  SEVERITY_LABELS,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../../shared/constants.js';

/* Hexes mirror the chart tokens in styles/index.css (SVG attrs need literals) */
const LINES = [
  { key: 'anger', color: '#f472b6', name: 'Angry / irritable' },
  { key: 'anxiety', color: '#14b8a6', name: 'Anxious / tense' },
  { key: 'fatigue', color: '#fb7185', name: 'Tired / low energy' },
];

const SEVERITY_TICKS = Array.from(
  { length: SEVERITY_MAX - SEVERITY_MIN + 1 },
  (_, i) => SEVERITY_MIN + i,
);

export function TrendChart({ data, embedded = false }) {
  const chart = (
    <div className={embedded ? 'h-64 w-full' : 'h-72 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#dde6e6" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="cycleDay"
            tick={{ fill: '#4b5563', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#dde6e6' }}
            label={{
              value: 'Cycle day',
              position: 'insideBottom',
              offset: -2,
              fill: '#4b5563',
              fontSize: 12,
            }}
          />
          <YAxis
            domain={[SEVERITY_MIN, SEVERITY_MAX]}
            ticks={SEVERITY_TICKS}
            tick={{ fill: '#4b5563', fontSize: 12 }}
            tickFormatter={(v) => SEVERITY_LABELS[v] || String(v)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #dde6e6',
              background: '#ffffff',
              boxShadow: '0 10px 28px rgba(31, 41, 55, 0.08)',
            }}
            labelStyle={{ color: '#1f2937', fontWeight: 600 }}
            itemStyle={{ color: '#4b5563' }}
            formatter={(value, name) => [
              value == null
                ? 'Not logged'
                : `${value} — ${SEVERITY_LABELS[Math.round(value)] || value}`,
              name,
            ]}
            labelFormatter={(day) => `Cycle day ${day}`}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: '#4b5563' }}
          />
          <ReferenceArea
            x1={17}
            x2={28}
            fill="#ec4899"
            fillOpacity={0.07}
            strokeOpacity={0}
          />
          {LINES.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2.25}
              dot={false}
              connectNulls
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) {
    return chart;
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Symptom trends
          </h2>
          <p className="mt-1 text-base text-moss">
            Severity by cycle day (1–6) — shaded band is the luteal phase
          </p>
        </div>
        <span className="chip px-3 py-1 text-sm">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-plum" />
          Days 17–28
        </span>
      </div>
      {chart}
    </section>
  );
}
