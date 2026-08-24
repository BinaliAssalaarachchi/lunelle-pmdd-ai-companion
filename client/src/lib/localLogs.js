import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from '../../../shared/constants.js';
import { emptyImpact, emptySymptoms } from '../../../shared/symptoms.js';
import {
  calculateCycleDay,
  calculateCyclePhase,
} from '../../../shared/cycle.js';
import { buildDemoDataset } from './demoData.js';

const STORAGE_KEY = 'lunelle.symptomLogs.v2';
const PROFILE_KEY = 'lunelle.profile';

export function createEmptyLog(date, profile) {
  const cycleLength = profile?.cycleLength ?? DEFAULT_CYCLE_LENGTH;
  const periodLength = profile?.periodLength ?? DEFAULT_PERIOD_LENGTH;
  const lastPeriodStart = profile?.lastPeriodStart;
  const cycleDay = lastPeriodStart
    ? calculateCycleDay(lastPeriodStart, date, cycleLength)
    : 1;
  const cyclePhase = calculateCyclePhase(cycleDay, cycleLength, periodLength);

  return {
    date,
    cycleDay,
    cyclePhase,
    symptoms: emptySymptoms(1),
    impact: emptyImpact(1),
    notes: '',
  };
}

export function getLocalProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return buildDemoDataset().profile;
}

export function setLocalProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getLocalLogsMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  const seeded = {};
  for (const log of buildDemoDataset().logs) {
    seeded[log.date] = {
      ...log,
      impact: { ...emptyImpact(1), ...(log.impact ?? {}) },
      notes: log.notes ?? '',
    };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function getLocalLog(date) {
  return getLocalLogsMap()[date] ?? null;
}

export function upsertLocalLog(log) {
  const map = getLocalLogsMap();
  map[log.date] = log;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  return log;
}
