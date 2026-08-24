import {
  Font,
  Image,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import logoUrl from '../../assets/lunelle-logo-mark.png?inline';
import { colors, fonts } from './theme.js';

Font.registerHyphenationCallback((word) => [word]);

function resolveLogoSrc() {
  if (typeof logoUrl === 'string' && logoUrl.startsWith('data:')) return logoUrl;
  if (globalThis.__LUNELLE_PDF_LOGO__) return globalThis.__LUNELLE_PDF_LOGO__;
  if (typeof window !== 'undefined') return logoUrl;
  return logoUrl;
}

const PHASE_COLORS = colors.phase;

export const shared = StyleSheet.create({
  page: {
    backgroundColor: colors.cream,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  chrome: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  chromeBody: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 48,
  },
  runningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 0.6,
    borderBottomColor: colors.line,
  },
  runningText: {
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.moss,
    fontFamily: fonts.bodyBold,
  },
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.8,
    borderTopColor: colors.line,
    paddingTop: 6,
    marginTop: 8,
  },
  footerLeftText: {
    fontSize: 7.5,
    color: colors.moss,
    fontFamily: fonts.body,
  },
  footerRightText: {
    fontSize: 7.5,
    color: colors.moss,
    fontFamily: fonts.body,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 34,
    height: 34,
    marginRight: 10,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.pineDeep,
    letterSpacing: 0.4,
  },
  kicker: {
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.moss,
    fontFamily: fonts.bodyBold,
    marginBottom: 4,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 1.2,
    marginBottom: 8,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.8,
    borderBottomColor: colors.line,
  },
  bodyMuted: {
    fontSize: 9,
    color: colors.moss,
    lineHeight: 1.45,
  },
  metaLine: {
    fontSize: 9,
    color: colors.moss,
    marginBottom: 2,
  },
  section: {
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 0.8,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  statCard: {
    width: '33.33%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  statInner: {
    backgroundColor: colors.paper,
    borderWidth: 0.8,
    borderColor: colors.line,
    borderLeftWidth: 2.5,
    borderLeftColor: colors.clay,
    borderRadius: 6,
    padding: 10,
    minHeight: 58,
  },
  statLabel: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.moss,
    fontFamily: fonts.bodyBold,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  table: {
    borderWidth: 0.8,
    borderColor: colors.line,
    borderRadius: 6,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: colors.sand,
    borderBottomWidth: 0.8,
    borderBottomColor: colors.line,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 7.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.moss,
    fontFamily: fonts.bodyBold,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  trAlt: {
    backgroundColor: colors.paper,
  },
  td: {
    fontSize: 8.5,
    color: colors.ink,
    fontFamily: fonts.body,
    lineHeight: 1.35,
  },
  tdMuted: {
    fontSize: 8,
    color: colors.moss,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    borderWidth: 0.8,
    borderColor: colors.line,
    backgroundColor: colors.claySoft,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 8,
    color: colors.clayDeep,
    fontFamily: fonts.bodyBold,
  },
  phaseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
    marginTop: 2,
  },
  callout: {
    backgroundColor: colors.paper,
    borderWidth: 0.8,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderLeftColor: colors.clay,
    borderRadius: 6,
    padding: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 7,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.moss,
    fontFamily: fonts.bodyBold,
  },
  disclaimer: {
    backgroundColor: colors.sand,
    borderRadius: 6,
    padding: 10,
    fontSize: 8,
    color: colors.moss,
    lineHeight: 1.45,
  },
  noteCard: {
    borderBottomWidth: 0.6,
    borderBottomColor: colors.line,
    paddingVertical: 7,
  },
});

export function BrandMark({ size = 34, light = false }) {
  const src = resolveLogoSrc();
  return (
    <View style={shared.brandRow}>
      {src ? (
        <Image src={src} style={{ width: size, height: size, marginRight: 10 }} />
      ) : null}
      <Text style={[shared.wordmark, light ? { color: colors.cream } : null]}>
        Lunelle
      </Text>
    </View>
  );
}

export function ReportPageChrome({
  children,
  pageNumber = 1,
  totalPages = 1,
  variant = 'personal',
  title,
  generatedLabel,
}) {
  const accent = variant === 'clinician' ? colors.pineDeep : colors.clay;
  return (
    <View style={shared.chrome}>
      <View style={{ height: 5, backgroundColor: accent }} />
      <View style={shared.chromeBody}>
        {pageNumber > 1 ? (
          <View style={shared.runningRow}>
            <Text style={shared.runningText}>{`Lunelle  ·  ${title}`}</Text>
            <Text style={shared.runningText}>Confidential</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{children}</View>
        <View style={shared.footerBar} wrap={false}>
          <Text style={shared.footerLeftText}>
            {`${title}  ·  Generated ${generatedLabel}`}
          </Text>
          <Text style={shared.footerRightText}>
            {`Page ${pageNumber} of ${totalPages}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SectionHeading({ children }) {
  return (
    <View wrap={false} minPresenceAhead={72}>
      <Text style={shared.h2}>{children}</Text>
    </View>
  );
}

export function StatGrid({ items, accent = colors.clay }) {
  return (
    <View style={shared.statGrid}>
      {items.map((item) => (
        <View key={item.label} style={shared.statCard} wrap={false}>
          <View style={[shared.statInner, { borderLeftColor: item.accent || accent }]}>
            <Text style={shared.statLabel}>{item.label}</Text>
            <Text style={shared.statValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <View style={shared.table}>
      <View style={shared.thead} wrap={false} minPresenceAhead={56}>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={[shared.th, { width: col.width, textAlign: col.align || 'left' }]}
          >
            {col.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={row.id || index}
          wrap={false}
          style={[shared.tr, index % 2 === 1 ? shared.trAlt : null, index === rows.length - 1 ? { borderBottomWidth: 0 } : null]}
        >
          {columns.map((col) => (
            <View key={col.key} style={{ width: col.width }}>
              <Text
                style={[
                  shared.td,
                  col.muted ? shared.tdMuted : null,
                  col.align === 'right' ? { textAlign: 'right' } : null,
                  col.align === 'center' ? { textAlign: 'center' } : null,
                ]}
              >
                {row[col.key]}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PhaseChip({ phase, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={[
          shared.phaseDot,
          { backgroundColor: PHASE_COLORS[phase] || colors.clay },
        ]}
      />
      <Text style={{ fontSize: 8.5, color: colors.ink }}>{label}</Text>
    </View>
  );
}

export function LegendRow() {
  const items = [
    ['Menstrual', colors.phase.menstrual],
    ['Follicular', colors.phase.follicular],
    ['Ovulatory', colors.phase.ovulatory],
    ['Luteal', colors.phase.luteal],
  ];
  return (
    <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 2 }}>
      {items.map(([label, color]) => (
        <View
          key={label}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: color,
              marginRight: 4,
            }}
          />
          <Text style={{ fontSize: 7.5, color: colors.moss }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
