import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
const LINE_COLORS = {
  anger: '#f472b6',
  anxiety: '#14b8a6',
  fatigue: '#fb7185',
};

const FALLBACK_COLORS = ['#f472b6', '#14b8a6', '#fb7185', '#ec4899'];

const SEVERITY_TICKS = Array.from(
  { length: SEVERITY_MAX - SEVERITY_MIN + 1 },
  (_, i) => SEVERITY_MIN + i,
);

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-cream px-3 py-2 text-sm shadow-lift">
      <p className="mb-1 font-semibold text-ink">Cycle day {label}</p>
      <ul className="space-y-0.5 text-moss">
        {payload.map((entry) => (
          <li key={entry.dataKey}>
            {entry.name}:{' '}
            <span className="font-medium text-ink">
              {entry.value == null
                ? 'Not logged'
                : `${Number(entry.value).toFixed(1)} · ${
                    SEVERITY_LABELS[Math.round(Number(entry.value))] ||
                    entry.value
                  }`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartHeader({ evidence }) {
  return (
    <div className="mb-4">
      <p className="eyebrow mb-2">Across your cycle</p>
      <h2 className="font-display text-2xl font-semibold text-ink">
        Symptom trends
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-moss">
        How your symptoms changed throughout this cycle. Values are averages
        from your logged days (1–6).
      </p>
      {evidence?.currentCycleDay != null ? (
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-clay-deep">
          Current cycle day {evidence.currentCycleDay}
        </p>
      ) : null}
    </div>
  );
}

export function SymptomTrendChart({
  evidence,
  loading = false,
  emptyMessage = 'Log symptoms across a few cycle days to see severity trends here.',
}) {
  const series = evidence?.chartSeries || [];
  const symptoms = evidence?.chartSymptoms || [
    { id: 'anger', label: 'Angry / irritable' },
    { id: 'anxiety', label: 'Anxious / tense' },
    { id: 'fatigue', label: 'Tired / low energy' },
  ];
  const hasPoints = series.some((point) =>
    symptoms.some((symptom) => point[symptom.id] != null),
  );

  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-label="Loading symptom trend chart"
        className="card p-6"
      >
        <div className="mb-4 space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-sand" />
          <div className="h-6 w-44 animate-pulse rounded bg-sand" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-sand/70" />
      </section>
    );
  }

  if (!hasPoints) {
    return (
      <section
        aria-label="Symptom trends unavailable"
        className="rounded-3xl border border-dashed border-line bg-cream p-6"
      >
        <ChartHeader evidence={evidence} />
        <p className="mt-4 text-base text-moss">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section aria-label="Symptom trends by cycle day" className="card p-6">
      <ChartHeader evidence={evidence} />

      <div
        className="h-72 w-full"
        role="img"
        aria-label="Line chart of symptom severity by cycle day from 1 to 6"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
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
            <Tooltip content={<ChartTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: '#4b5563' }}
            />
            {symptoms.map((symptom, index) => (
              <Line
                key={symptom.id}
                type="monotone"
                dataKey={symptom.id}
                name={symptom.label}
                stroke={
                  LINE_COLORS[symptom.id] ||
                  FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                }
                strokeWidth={2.25}
                dot={false}
                connectNulls
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
