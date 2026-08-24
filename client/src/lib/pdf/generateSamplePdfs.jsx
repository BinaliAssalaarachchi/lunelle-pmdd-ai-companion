/**
 * Build demo report payloads and write Personal + Clinician PDFs.
 * Run from client/: npx vite-node src/lib/pdf/generateSamplePdfs.jsx
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  DEMO_USER,
  SEVERITY_MAX,
  SEVERITY_MIN,
} from '../../../../shared/constants.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
} from '../../../../shared/cycle.js';
import {
  buildSeedTimeline,
  enumerateSeedDates,
} from '../../../../shared/seedTimeline.js';
import { IMPACT_IDS, SYMPTOM_IDS } from '../../../../shared/symptoms.js';
import { buildReportPayload } from '../../../../server/src/services/reportData.js';
import { renderToBuffer } from '@react-pdf/renderer';
import { ClinicianReportDocument } from './ClinicianReportDocument.jsx';
import { PersonalReportDocument } from './PersonalReportDocument.jsx';
import { buildReportViewModel } from './reportModel.js';

const MOOD = ['depressed_mood', 'anxiety', 'mood_swings', 'anger'];
const PHYSICAL = ['fatigue', 'appetite', 'sleep', 'physical_symptoms'];
const COGNITIVE = ['concentration'];
const BEHAVIORAL = ['overwhelmed', 'reduced_interest'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function severityForSymptom(symptomId, cycleDay) {
  const mood = MOOD.includes(symptomId);
  const physical = PHYSICAL.includes(symptomId);
  const cognitive = COGNITIVE.includes(symptomId);
  const behavioral = BEHAVIORAL.includes(symptomId);

  if (cycleDay <= 5) {
    if (mood || physical) return 2;
    return 1;
  }
  if (cycleDay <= 13) return 1;
  if (cycleDay <= 16) return mood ? 3 : 2;
  if (cycleDay <= 21) return mood ? 4 : 3;
  if (cycleDay <= 27) {
    if (mood) return SEVERITY_MAX;
    if (physical || cognitive || behavioral) return 5;
    return 5;
  }
  return 3;
}

function buildSymptoms(cycleDay) {
  return SYMPTOM_IDS.reduce((symptoms, id) => {
    symptoms[id] = clamp(severityForSymptom(id, cycleDay), SEVERITY_MIN, SEVERITY_MAX);
    return symptoms;
  }, {});
}

function buildImpact(cycleDay) {
  let base;
  if (cycleDay <= 13) base = { productivity: 1, activities: 1, relationships: 1 };
  else if (cycleDay <= 16) base = { productivity: 2, activities: 1, relationships: 2 };
  else if (cycleDay <= 21) base = { productivity: 3, activities: 3, relationships: 3 };
  else if (cycleDay <= 27) base = { productivity: 5, activities: 5, relationships: 6 };
  else base = { productivity: 2, activities: 2, relationships: 2 };
  return IMPACT_IDS.reduce((impact, id) => {
    impact[id] = base[id];
    return impact;
  }, {});
}

function buildNotes(cycleDay, cyclePhase) {
  if (cycleDay >= 22 && cycleDay <= 27) {
    return 'Late luteal day — symptoms feel especially intense today.';
  }
  if (cyclePhase === 'luteal') {
    return 'Early luteal — noticing symptoms starting to build.';
  }
  if (cyclePhase === 'follicular') {
    return 'Feeling relatively stable today.';
  }
  return null;
}

export function buildDemoLogs() {
  const timeline = buildSeedTimeline();
  const dates = enumerateSeedDates(timeline);
  return dates.map((date) => {
    const cycleDay = calculateCycleDay(
      timeline.lastPeriodStart,
      date,
      DEFAULT_CYCLE_LENGTH,
    );
    const cyclePhase = calculateCyclePhase(
      cycleDay,
      DEFAULT_CYCLE_LENGTH,
      DEFAULT_PERIOD_LENGTH,
    );
    return {
      date,
      cycleDay,
      cyclePhase,
      symptoms: buildSymptoms(cycleDay),
      impact: buildImpact(cycleDay),
      notes: buildNotes(cycleDay, cyclePhase),
    };
  });
}

export function buildDemoReport(format = 'personal') {
  const logs = buildDemoLogs();
  return buildReportPayload({
    logs,
    profile: {
      displayName: DEMO_USER.displayName,
      email: DEMO_USER.email,
      cycleLength: DEFAULT_CYCLE_LENGTH,
      periodLength: DEFAULT_PERIOD_LENGTH,
      lastPeriodStart: buildSeedTimeline().lastPeriodStart,
    },
    insights: [
      {
        generatedAt: new Date().toISOString(),
        content:
          'Mood and irritability ratings were higher on luteal-phase days than on follicular-phase days in this window. Fatigue and sleep changes often rose alongside mood ratings. These observations describe logged data only and are not a diagnosis.',
      },
    ],
    format,
    dateRange: {
      start: logs[0].date,
      end: logs[logs.length - 1].date,
    },
  });
}

function assertPdf(buffer, label) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new Error(`${label}: renderer did not return a buffer`);
  }
  const bytes = Buffer.from(buffer);
  const head = bytes.subarray(0, 5).toString('latin1');
  if (head !== '%PDF-') {
    throw new Error(`${label}: missing PDF header (got ${JSON.stringify(head)})`);
  }
  const latin = bytes.toString('latin1');
  const pages = (latin.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  if (pages < 2) {
    throw new Error(`${label}: expected multiple pages, found ${pages}`);
  }
  return { bytes, pages, size: bytes.length };
}

function assertViewModel(report, kind) {
  const model = buildReportViewModel(report);
  if (model.daysTracked < 20) {
    throw new Error(`${kind}: expected seeded days, got ${model.daysTracked}`);
  }
  if (model.symptoms.length < 8) {
    throw new Error(`${kind}: expected full symptom table`);
  }
  if (model.phases.length !== 4) {
    throw new Error(`${kind}: expected 4 cycle phases`);
  }
  if (model.notes.length < 1) {
    throw new Error(`${kind}: expected personal notes from demo logs`);
  }
  return model;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(here, '../../../tmp/reports');
  await mkdir(outDir, { recursive: true });
  globalThis.__LUNELLE_PDF_LOGO__ = await readFile(
    path.resolve(here, '../../assets/lunelle-logo-mark.png'),
  );

  const personalReport = buildDemoReport('personal');
  const clinicianReport = buildDemoReport('clinician');
  const personalModel = assertViewModel(personalReport, 'personal');
  const clinicianModel = assertViewModel(clinicianReport, 'clinician');

  const personalBuf = await renderToBuffer(
    <PersonalReportDocument report={personalReport} />,
  );
  const clinicianBuf = await renderToBuffer(
    <ClinicianReportDocument report={clinicianReport} />,
  );

  const personalInfo = assertPdf(personalBuf, 'personal');
  const clinicianInfo = assertPdf(clinicianBuf, 'clinician');

  const personalPath = path.join(outDir, `lunelle-personal-${personalReport.dateRange.end}.pdf`);
  const clinicianPath = path.join(
    outDir,
    `lunelle-clinician-${clinicianReport.dateRange.end}.pdf`,
  );
  await writeFile(personalPath, personalInfo.bytes);
  await writeFile(clinicianPath, clinicianInfo.bytes);

  console.log(
    JSON.stringify(
      {
        ok: true,
        personal: {
          path: personalPath,
          pages: personalInfo.pages,
          bytes: personalInfo.size,
          daysTracked: personalModel.daysTracked,
          sections: [
            'cover',
            'overview',
            'symptom-summary',
            'cycle-patterns',
            'timeline',
            'notes',
            'ai-summary',
            'disclaimer',
          ],
        },
        clinician: {
          path: clinicianPath,
          pages: clinicianInfo.pages,
          bytes: clinicianInfo.size,
          daysTracked: clinicianModel.daysTracked,
          discussionPoints: clinicianModel.discussionPoints.length,
          sections: [
            'header',
            'reporting-summary',
            'symptom-table',
            'cycle-phase',
            'pattern-summary',
            'notes',
            'discussion-points',
            'disclaimer',
          ],
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

