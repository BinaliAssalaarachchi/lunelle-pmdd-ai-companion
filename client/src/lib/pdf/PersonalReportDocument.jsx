import { Document, Page, Text, View } from '@react-pdf/renderer';
import { PhaseBarChart, SeverityTimelineChart, TimelineStrip } from './charts.jsx';
import {
  BrandMark,
  DataTable,
  LegendRow,
  ReportPageChrome,
  SectionHeading,
  StatGrid,
  shared,
} from './components.jsx';
import { buildReportViewModel, formatLongDate, formatShortDate } from './reportModel.js';
import {
  OBSERVED_NOTE,
  PERSONAL_DISCLAIMER,
  SCALE_NOTE,
  colors,
  fonts,
} from './theme.js';

function Cover({ model }) {
  const period = `${formatLongDate(model.rangeStart)}  –  ${formatLongDate(model.rangeEnd)}`;
  return (
    <View wrap={false} style={{ marginBottom: 6 }}>
      <BrandMark />
      <Text style={shared.kicker}>Personal record</Text>
      <Text style={shared.h1}>Personal Symptom Report</Text>
      <Text style={shared.metaLine}>Reporting period  ·  {period}</Text>
      <Text style={shared.metaLine}>
        Generated  ·  {formatLongDate(model.generatedAt)}
      </Text>
      <Text style={[shared.bodyMuted, { marginTop: 6 }]}>
        A structured summary of symptoms you logged in Lunelle. Prepared for{' '}
        {model.patientName}.
      </Text>
    </View>
  );
}

function Overview({ model }) {
  const frequent =
    model.mostFrequent.length > 0
      ? model.mostFrequent.map((item) => item.shortLabel).join(', ')
      : 'None above baseline';

  return (
    <View style={shared.section}>
      <SectionHeading>Overview</SectionHeading>
      <StatGrid
        items={[
          { label: 'Days logged', value: String(model.daysTracked) },
          {
            label: 'Cycles covered',
            value: String(model.cyclesCovered),
            accent: colors.pine,
          },
          {
            label: 'Average severity',
            value: Number(model.averageSeverity).toFixed(2),
            accent: colors.plum,
          },
          {
            label: 'Highest severity',
            value: `${model.highestSeverity} / 6`,
            accent: colors.ochre,
          },
          {
            label: 'Avg. impact',
            value:
              model.averageImpact == null
                ? '—'
                : Number(model.averageImpact).toFixed(2),
            accent: colors.fern,
          },
          {
            label: 'Cycle length',
            value: `${model.cycleLength} days`,
            accent: colors.pineDeep,
          },
        ]}
      />
      <View style={[shared.card, { marginTop: 4 }]} wrap={false}>
        <Text style={shared.statLabel}>Most frequently reported</Text>
        <Text style={{ fontSize: 10, color: colors.ink, marginTop: 2 }}>
          {frequent}
        </Text>
        <View style={shared.chipRow}>
          {model.mostFrequent.map((item) => (
            <View key={item.id} style={shared.chip}>
              <Text style={shared.chipText}>
                {item.shortLabel}  ·  {item.daysPresent}/{item.totalDays} days
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SymptomSummary({ model }) {
  const rows = model.symptoms.map((item) => ({
    id: item.id,
    symptom: item.shortLabel,
    average: Number(item.averageSeverity).toFixed(2),
    max: String(item.maxSeverity),
    days: `${item.daysPresent} / ${item.totalDays}`,
  }));

  return (
    <View style={shared.section}>
      <SectionHeading>Symptom summary</SectionHeading>
      <Text style={[shared.bodyMuted, { marginBottom: 8 }]}>{SCALE_NOTE}</Text>
      <DataTable
        columns={[
          { key: 'symptom', header: 'Symptom', width: '40%' },
          { key: 'average', header: 'Average', width: '18%', align: 'right' },
          { key: 'max', header: 'Maximum', width: '18%', align: 'right' },
          { key: 'days', header: 'Affected days', width: '24%', align: 'right' },
        ]}
        rows={rows}
      />
    </View>
  );
}

function CyclePatterns({ model }) {
  return (
    <View style={shared.section}>
      <SectionHeading>Cycle & symptom patterns</SectionHeading>
      <Text style={[shared.bodyMuted, { marginBottom: 8 }]}>{OBSERVED_NOTE}</Text>
      <View style={shared.card} wrap={false}>
        <Text style={[shared.statLabel, { marginBottom: 6 }]}>
          Average severity by cycle phase
        </Text>
        <PhaseBarChart phases={model.phases} />
        <LegendRow />
      </View>
      <View style={{ marginTop: 8 }} wrap={false}>
        {model.phases.map((phase) => (
          <View key={phase.phase} wrap={false} style={shared.noteCard}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: colors.phase[phase.phase] || colors.clay,
                    marginRight: 6,
                  }}
                />
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9.5 }}>
                  {phase.label}
                </Text>
              </View>
              <Text style={shared.bodyMuted}>
                {phase.daysLogged} days  ·  avg {Number(phase.averageSeverity).toFixed(2)}
                {phase.averageImpact != null
                  ? `  ·  impact ${Number(phase.averageImpact).toFixed(2)}`
                  : ''}
              </Text>
            </View>
            {phase.topSymptoms.length ? (
              <Text style={[shared.bodyMuted, { marginTop: 3, paddingLeft: 13 }]}>
                Higher in this phase:{' '}
                {phase.topSymptoms
                  .map(
                    (item) =>
                      `${item.shortLabel} (${Number(item.phaseAverage).toFixed(2)})`,
                  )
                  .join('  ·  ')}
              </Text>
            ) : (
              <Text style={[shared.bodyMuted, { marginTop: 3, paddingLeft: 13 }]}>
                No elevated symptoms stood out in the logged days for this phase.
              </Text>
            )}
          </View>
        ))}
      </View>
      {model.notablePatterns.length ? (
        <View style={[shared.callout, { marginTop: 10 }]} wrap={false}>
          <Text style={shared.statLabel}>Data-derived observations</Text>
          {model.notablePatterns.map((pattern) => (
            <Text key={pattern} style={[shared.bodyMuted, { marginTop: 4, color: colors.ink }]}>
              •  {pattern}
            </Text>
          ))}
          <Text style={[shared.bodyMuted, { marginTop: 6, fontFamily: fonts.bodyOblique }]}>
            These statements describe logged averages. They are not a diagnosis.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Timeline({ model }) {
  if (!model.dailyLogs.length) return null;
  return (
    <View style={shared.section}>
      <SectionHeading>Symptom timeline</SectionHeading>
      <Text style={[shared.bodyMuted, { marginBottom: 8 }]}>
        Daily average severity across the reporting period. Marker colour follows
        cycle phase.
      </Text>
      <View style={shared.card} wrap={false}>
        <SeverityTimelineChart logs={model.dailyLogs} />
        <Text style={[shared.statLabel, { marginTop: 8, marginBottom: 2 }]}>
          Intensity strip
        </Text>
        <TimelineStrip logs={model.dailyLogs} />
        <LegendRow />
      </View>
    </View>
  );
}

function PersonalNotes({ model }) {
  return (
    <View style={shared.section}>
      <SectionHeading>Personal notes</SectionHeading>
      {model.notes.length === 0 ? (
        <Text style={shared.bodyMuted}>
          No notes were entered during this reporting period.
        </Text>
      ) : (
        model.notes.map((note) => (
          <View key={`${note.date}-${note.notes.slice(0, 12)}`} wrap={false} style={shared.noteCard}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 8.5, color: colors.ink }}>
              {formatShortDate(note.date)}
              {note.cycleDay ? `  ·  Day ${note.cycleDay}` : ''}
              {note.phaseLabel ? `  ·  ${note.phaseLabel}` : ''}
            </Text>
            <Text style={[shared.bodyMuted, { marginTop: 2, color: colors.ink }]}>
              {note.notes}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function AiSummary({ model }) {
  const excerpt = model.latestInsight?.excerpt;
  return (
    <View style={shared.section} wrap={false}>
      <SectionHeading>AI pattern summary</SectionHeading>
      <View style={shared.callout}>
        <View style={shared.badge}>
          <Text style={shared.badgeText}>AI-generated</Text>
        </View>
        <Text style={[shared.bodyMuted, { marginBottom: 6 }]}>
          The following text is produced by Lunelle from your logged entries. It
          is not a medical diagnosis and should not be read as clinical advice.
        </Text>
        {excerpt ? (
          <Text style={{ fontSize: 9.5, color: colors.ink, lineHeight: 1.45 }}>
            {excerpt}
          </Text>
        ) : (
          <Text style={shared.bodyMuted}>
            No AI pattern summary is available for this period. Insights generated
            in Lunelle will appear here when present.
          </Text>
        )}
        {model.latestInsight?.generatedAt ? (
          <Text style={[shared.bodyMuted, { marginTop: 6 }]}>
            Insight generated {formatLongDate(model.latestInsight.generatedAt)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Disclaimer({ model }) {
  return (
    <View style={shared.section} wrap={false}>
      <SectionHeading>Disclaimer</SectionHeading>
      <Text style={shared.disclaimer}>{PERSONAL_DISCLAIMER}</Text>
      {model.apiDisclaimer ? (
        <Text style={[shared.bodyMuted, { marginTop: 6 }]}>{model.apiDisclaimer}</Text>
      ) : null}
    </View>
  );
}

export function PersonalReportDocument({ report }) {
  const model = buildReportViewModel(report);
  const generatedLabel = formatLongDate(model.generatedAt);
  const title = 'Personal Symptom Report';

  return (
    <Document
      title={`Lunelle ${title}`}
      author="Lunelle"
      subject={`Symptom summary ${formatShortDate(model.rangeStart)} to ${formatShortDate(model.rangeEnd)}`}
      creator="Lunelle"
    >
      <Page
        size="A4"
        style={shared.page}
        layout={(props) => (
          <ReportPageChrome
            {...props}
            variant="personal"
            title={title}
            generatedLabel={generatedLabel}
          />
        )}
      >
        <Cover model={model} />
        <Overview model={model} />
        <SymptomSummary model={model} />
        <CyclePatterns model={model} />
        <Timeline model={model} />
        <PersonalNotes model={model} />
        <AiSummary model={model} />
        <Disclaimer model={model} />
      </Page>
    </Document>
  );
}
