import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PhaseBarChart } from './charts.jsx';
import {
  BrandMark,
  DataTable,
  ReportPageChrome,
  SectionHeading,
  shared,
} from './components.jsx';
import { buildReportViewModel, formatLongDate, formatShortDate } from './reportModel.js';
import {
  CLINICIAN_DISCLAIMER,
  OBSERVED_NOTE,
  SCALE_NOTE,
  colors,
  fonts,
} from './theme.js';

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.cream,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  headerBand: {
    backgroundColor: colors.pineDeep,
    marginHorizontal: -48,
    marginTop: -16,
    marginBottom: 16,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 48,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.cream,
    marginBottom: 6,
  },
  headerMeta: {
    fontSize: 9,
    color: '#ccfbf1',
    marginBottom: 2,
  },
  metricRow: {
    flexDirection: 'row',
    borderWidth: 0.8,
    borderColor: colors.line,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  metricCell: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRightWidth: 0.8,
    borderRightColor: colors.line,
    backgroundColor: colors.paper,
  },
  metricLabel: {
    fontSize: 7,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.moss,
    fontFamily: fonts.bodyBold,
    marginBottom: 3,
  },
  metricValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  phaseGrid: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginTop: 8,
  },
  phaseCard: {
    width: '25%',
    paddingHorizontal: 4,
  },
  phaseInner: {
    borderWidth: 0.8,
    borderColor: colors.line,
    borderTopWidth: 3,
    borderRadius: 5,
    padding: 8,
    minHeight: 92,
  },
  promptItem: {
    flexDirection: 'row',
    marginBottom: 7,
    alignItems: 'flex-start',
  },
  promptIndex: {
    width: 16,
    fontFamily: fonts.bodyBold,
    fontSize: 8.5,
    color: colors.pineDeep,
  },
  promptText: {
    flex: 1,
    fontSize: 8.5,
    color: colors.ink,
    lineHeight: 1.4,
  },
});

function Header({ model }) {
  return (
    <View style={styles.headerBand} wrap={false}>
      <BrandMark light size={30} />
      <Text style={styles.title}>Symptom Report for Clinical Discussion</Text>
      <Text style={styles.headerMeta}>
        Reporting period  {formatLongDate(model.rangeStart)}  –  {formatLongDate(model.rangeEnd)}
      </Text>
      <Text style={styles.headerMeta}>
        Generated  {formatLongDate(model.generatedAt)}
        {model.patientName ? `   ·   Prepared for ${model.patientName}` : ''}
      </Text>
    </View>
  );
}

function ReportingSummary({ model }) {
  const cells = [
    ['Days recorded', String(model.daysTracked)],
    ['Cycles observed', String(model.cyclesCovered)],
    ['Average severity', Number(model.averageSeverity).toFixed(2)],
    ['Highest severity', `${model.highestSeverity} / 6`],
  ];
  return (
    <View style={shared.section}>
      <SectionHeading>Reporting summary</SectionHeading>
      <View style={styles.metricRow} wrap={false}>
        {cells.map(([label, value], index) => (
          <View
            key={label}
            style={[
              styles.metricCell,
              index === cells.length - 1 ? { borderRightWidth: 0 } : null,
            ]}
          >
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={[shared.bodyMuted, { marginTop: 6 }]}>
        Cycle length {model.cycleLength} days
        {model.periodLength ? `  ·  Period length ${model.periodLength} days` : ''}
        {model.averageImpact != null
          ? `  ·  Average functional impact ${Number(model.averageImpact).toFixed(2)}`
          : ''}
      </Text>
      <Text style={[shared.bodyMuted, { marginTop: 3 }]}>{SCALE_NOTE}</Text>
    </View>
  );
}

function SymptomTable({ model }) {
  const rows = model.symptoms.map((item) => ({
    id: item.id,
    symptom: item.shortLabel,
    detail: item.label,
    average: Number(item.averageSeverity).toFixed(2),
    max: String(item.maxSeverity),
    days: `${item.daysPresent}/${item.totalDays}`,
  }));

  return (
    <View style={shared.section}>
      <SectionHeading>Symptom severity table</SectionHeading>
      <View style={shared.table}>
        <View style={shared.thead} wrap={false} minPresenceAhead={56}>
          <Text style={[shared.th, { width: '46%' }]}>Symptom</Text>
          <Text style={[shared.th, { width: '18%', textAlign: 'right' }]}>Average</Text>
          <Text style={[shared.th, { width: '18%', textAlign: 'right' }]}>Maximum</Text>
          <Text style={[shared.th, { width: '18%', textAlign: 'right' }]}>Affected days</Text>
        </View>
        {rows.map((row, index) => (
          <View
            key={row.id}
            wrap={false}
            style={[
              shared.tr,
              index % 2 === 1 ? shared.trAlt : null,
              index === rows.length - 1 ? { borderBottomWidth: 0 } : null,
            ]}
          >
            <View style={{ width: '46%' }}>
              <Text style={[shared.td, { fontFamily: fonts.bodyBold }]}>
                {row.symptom}
              </Text>
              <Text style={[shared.tdMuted, { marginTop: 1 }]}>{row.detail}</Text>
            </View>
            <Text style={[shared.td, { width: '18%', textAlign: 'right' }]}>
              {row.average}
            </Text>
            <Text style={[shared.td, { width: '18%', textAlign: 'right' }]}>
              {row.max}
            </Text>
            <Text style={[shared.td, { width: '18%', textAlign: 'right' }]}>
              {row.days}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CyclePhaseSummary({ model }) {
  return (
    <View style={shared.section}>
      <SectionHeading>Cycle phase summary</SectionHeading>
      <Text style={[shared.bodyMuted, { marginBottom: 8 }]}>{OBSERVED_NOTE}</Text>
      <View wrap={false} style={shared.card}>
        <PhaseBarChart phases={model.phases} />
      </View>
      <View style={styles.phaseGrid} wrap={false}>
        {model.phases.map((phase) => (
          <View key={phase.phase} style={styles.phaseCard}>
            <View
              style={[
                styles.phaseInner,
                { borderTopColor: colors.phase[phase.phase] || colors.pine },
              ]}
            >
              <Text style={[shared.statLabel, { color: colors.ink }]}>
                {phase.label}
              </Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, marginTop: 2 }}>
                {Number(phase.averageSeverity).toFixed(2)}
              </Text>
              <Text style={[shared.bodyMuted, { marginTop: 3, fontSize: 7.5 }]}>
                {phase.daysLogged} days
                {phase.averageImpact != null
                  ? `\nImpact ${Number(phase.averageImpact).toFixed(2)}`
                  : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {model.impactSummary?.length ? (
        <View style={{ marginTop: 10 }} wrap={false} minPresenceAhead={88}>
          <Text style={[shared.statLabel, { marginBottom: 6 }]}>
            Functional impact
          </Text>
          <DataTable
            columns={[
              { key: 'label', header: 'Domain', width: '46%' },
              { key: 'average', header: 'Average', width: '18%', align: 'right' },
              { key: 'luteal', header: 'Luteal avg', width: '18%', align: 'right' },
              { key: 'days', header: 'Affected days', width: '18%', align: 'right' },
            ]}
            rows={model.impactSummary.map((item) => ({
              id: item.id,
              label: item.shortLabel || item.label,
              average: Number(item.average).toFixed(2),
              luteal: Number(item.byPhase?.luteal ?? 0).toFixed(2),
              days: `${item.daysPresent}/${item.totalDays}`,
            }))}
          />
        </View>
      ) : null}
    </View>
  );
}

function PatternSummary({ model }) {
  const lines = model.notablePatterns.length
    ? model.notablePatterns
    : ['Not enough contrast across phases to highlight a dominant pattern in this window.'];

  return (
    <View style={shared.section} wrap={false}>
      <SectionHeading>Symptom pattern summary</SectionHeading>
      <View style={shared.callout}>
        {lines.map((line) => (
          <Text key={line} style={{ fontSize: 9, color: colors.ink, marginBottom: 4 }}>
            {line}
          </Text>
        ))}
        <Text style={[shared.bodyMuted, { marginTop: 4, fontFamily: fonts.bodyOblique }]}>
          Observations are calculated from logged ratings. They are not diagnostic
          impressions.
        </Text>
      </View>
    </View>
  );
}

function UserNotes({ model }) {
  return (
    <View style={shared.section}>
      <SectionHeading>User notes</SectionHeading>
      {model.notes.length === 0 ? (
        <Text style={shared.bodyMuted}>No notes were recorded in this period.</Text>
      ) : (
        model.notes.map((note) => (
          <View key={`${note.date}-${note.notes.slice(0, 12)}`} wrap={false} style={shared.noteCard}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 8, color: colors.moss }}>
              {formatShortDate(note.date)}
              {note.cycleDay ? `  ·  Day ${note.cycleDay}` : ''}
              {note.phaseLabel ? `  ·  ${note.phaseLabel}` : ''}
            </Text>
            <Text style={{ fontSize: 8.5, color: colors.ink, marginTop: 2 }}>
              {note.notes}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function DiscussionPoints({ model }) {
  return (
    <View style={shared.section}>
      <SectionHeading>Discussion points</SectionHeading>
      <Text style={[shared.bodyMuted, { marginBottom: 8 }]}>
        Neutral prompts the user may choose to raise. These are not diagnoses,
        treatment recommendations, or medical claims.
      </Text>
      {model.discussionPoints.map((point, index) => (
        <View key={point} style={styles.promptItem} wrap={false}>
          <Text style={styles.promptIndex}>{index + 1}.</Text>
          <Text style={styles.promptText}>{point}</Text>
        </View>
      ))}
    </View>
  );
}

function Disclaimer() {
  return (
    <View style={shared.section} wrap={false}>
      <SectionHeading>Disclaimer</SectionHeading>
      <Text style={shared.disclaimer}>{CLINICIAN_DISCLAIMER}</Text>
    </View>
  );
}

export function ClinicianReportDocument({ report }) {
  const model = buildReportViewModel(report);
  const title = 'Symptom Report for Clinical Discussion';
  const generatedLabel = formatLongDate(model.generatedAt);

  return (
    <Document
      title={`Lunelle ${title}`}
      author="Lunelle"
      subject={`Clinical discussion summary ${formatShortDate(model.rangeStart)} to ${formatShortDate(model.rangeEnd)}`}
      creator="Lunelle"
    >
      <Page
        size="A4"
        style={styles.page}
        layout={(props) => (
          <ReportPageChrome
            {...props}
            variant="clinician"
            title={title}
            generatedLabel={generatedLabel}
          />
        )}
      >
        <Header model={model} />
        <ReportingSummary model={model} />
        <SymptomTable model={model} />
        <CyclePhaseSummary model={model} />
        <PatternSummary model={model} />
        <UserNotes model={model} />
        <DiscussionPoints model={model} />
        <Disclaimer />
      </Page>
    </Document>
  );
}
