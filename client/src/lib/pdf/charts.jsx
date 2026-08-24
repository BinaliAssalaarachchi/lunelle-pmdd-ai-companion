import { Circle, G, Line, Path, Rect, Svg, Text as SvgText } from '@react-pdf/renderer';
import { colors } from './theme.js';

const PHASE_COLORS = colors.phase;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function PhaseBarChart({ phases = [], width = 499 }) {
  const rowHeight = 28;
  const labelWidth = 78;
  const valueWidth = 92;
  const barMax = Math.max(width - labelWidth - valueWidth, 80);
  const height = Math.max(phases.length * rowHeight, rowHeight);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {phases.map((phase, index) => {
        const y = index * rowHeight;
        const ratio = clamp(Number(phase.averageSeverity) / 6, 0, 1);
        const barWidth = Math.max(4, ratio * barMax);
        const fill = PHASE_COLORS[phase.phase] || colors.clay;
        return (
          <G key={phase.phase || index}>
            <SvgText
              x={0}
              y={y + 14}
              fill={colors.ink}
              fontSize={8.5}
              fontFamily="Helvetica"
            >
              {phase.label}
            </SvgText>
            <Rect
              x={labelWidth}
              y={y + 6}
              width={barMax}
              height={10}
              rx={5}
              fill={colors.sand}
            />
            <Rect
              x={labelWidth}
              y={y + 6}
              width={barWidth}
              height={10}
              rx={5}
              fill={fill}
            />
            <SvgText
              x={labelWidth + barMax + 8}
              y={y + 14}
              fill={colors.moss}
              fontSize={8}
              fontFamily="Helvetica"
            >
              {Number(phase.averageSeverity).toFixed(2)} · {phase.daysLogged}d
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export function SeverityTimelineChart({ logs = [], width = 499, height = 168 }) {
  if (!logs.length) return null;

  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxY = 6;
  const minY = 1;

  const xAt = (index) =>
    logs.length === 1
      ? padL + chartW / 2
      : padL + (index / (logs.length - 1)) * chartW;
  const yAt = (value) => {
    const t = (clamp(Number(value) || minY, minY, maxY) - minY) / (maxY - minY);
    return padT + (1 - t) * chartH;
  };

  const points = logs.map((log, index) => ({
    x: xAt(index),
    y: yAt(log.averageSeverity),
    phase: log.cyclePhase,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  const yTicks = [1, 2, 3, 4, 5, 6];
  const labelCount = Math.min(4, logs.length);
  const xLabels = Array.from({ length: labelCount }, (_, position) => {
    const index =
      labelCount === 1
        ? 0
        : Math.round((position / (labelCount - 1)) * (logs.length - 1));
    const date = String(logs[index].date || '').slice(5);
    return { index, date: date.replace('-', '/') };
  });

  const markerStep = Math.max(1, Math.ceil(logs.length / 12));

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {yTicks.map((tick) => {
        const y = yAt(tick);
        return (
          <G key={tick}>
            <Line
              x1={padL}
              x2={padL + chartW}
              y1={y}
              y2={y}
              stroke={colors.line}
              strokeWidth={0.6}
            />
            <SvgText
              x={padL - 6}
              y={y + 3}
              fill={colors.faint}
              fontSize={7}
              fontFamily="Helvetica"
              textAnchor="end"
            >
              {String(tick)}
            </SvgText>
          </G>
        );
      })}
      <Path d={areaPath} fill="rgba(244, 114, 182, 0.12)" />
      <Path
        d={linePath}
        fill="none"
        stroke={colors.clayDeep}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point, index) => {
        if (index % markerStep !== 0 && index !== points.length - 1) return null;
        return (
          <Circle
            key={`pt-${index}`}
            cx={point.x}
            cy={point.y}
            r={2.4}
            fill={colors.cream}
            stroke={PHASE_COLORS[point.phase] || colors.clay}
            strokeWidth={1.4}
          />
        );
      })}
      {xLabels.map((label) => (
        <SvgText
          key={`x-${label.index}`}
          x={xAt(label.index)}
          y={height - 8}
          fill={colors.moss}
          fontSize={7.5}
          fontFamily="Helvetica"
          textAnchor="middle"
        >
          {label.date}
        </SvgText>
      ))}
    </Svg>
  );
}

export function TimelineStrip({ logs = [], width = 499, height = 22 }) {
  if (!logs.length) return null;
  const gap = logs.length > 60 ? 0.4 : 1;
  const cell = Math.max(2, (width - gap * (logs.length - 1)) / logs.length);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {logs.map((log, index) => {
        const severity = clamp(Number(log.averageSeverity) || 1, 1, 6);
        const t = (severity - 1) / 5;
        const fill = t < 0.25 ? colors.sand : t < 0.5 ? '#fbcfe8' : t < 0.75 ? colors.clay : colors.clayDeep;
        return (
          <Rect
            key={`${log.date}-${index}`}
            x={index * (cell + gap)}
            y={4}
            width={cell}
            height={14}
            rx={logs.length > 50 ? 0.5 : 1.5}
            fill={fill}
          />
        );
      })}
    </Svg>
  );
}
