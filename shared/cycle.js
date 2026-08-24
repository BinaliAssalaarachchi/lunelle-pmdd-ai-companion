import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
} from './constants.js';

/**
 * Phase boundaries are expressed as a fraction of a textbook 28-day cycle so
 * they scale to the user's own cycle length.
 */
const FOLLICULAR_END_RATIO = 13 / 28;
const OVULATORY_END_RATIO = 16 / 28;

function normalizeCycleLength(cycleLength) {
  const length = Math.round(Number(cycleLength));
  return Number.isFinite(length) && length > 0 ? length : DEFAULT_CYCLE_LENGTH;
}

function normalizePeriodLength(periodLength, cycleLength) {
  const length = Math.round(Number(periodLength));
  if (!Number.isFinite(length) || length < 1) return DEFAULT_PERIOD_LENGTH;
  return Math.min(length, cycleLength);
}

export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function daysBetween(startDateStr, endDateStr) {
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  const msPerDay = 24 * 60 * 60 * 1000;
  // Rounding absorbs the one-hour drift when a DST boundary falls in between.
  return Math.round((end - start) / msPerDay);
}

export function calculateCycleDay(
  lastPeriodStart,
  date,
  cycleLength = DEFAULT_CYCLE_LENGTH,
) {
  const length = normalizeCycleLength(cycleLength);
  const daysSinceStart = daysBetween(lastPeriodStart, date);
  // Dates before the anchor wrap backwards into the previous cycle rather than
  // collapsing to day 1, so moving the anchor never rewrites past positions.
  return (((daysSinceStart % length) + length) % length) + 1;
}

export function calculateCyclePhase(
  cycleDay,
  cycleLength = DEFAULT_CYCLE_LENGTH,
  periodLength = DEFAULT_PERIOD_LENGTH,
) {
  const length = normalizeCycleLength(cycleLength);
  const menstrualEnd = normalizePeriodLength(periodLength, length);
  const follicularEnd = Math.max(
    menstrualEnd,
    Math.round(FOLLICULAR_END_RATIO * length),
  );
  const ovulatoryEnd = Math.max(
    follicularEnd,
    Math.round(OVULATORY_END_RATIO * length),
  );

  if (cycleDay <= menstrualEnd) {
    return 'menstrual';
  }
  if (cycleDay <= follicularEnd) {
    return 'follicular';
  }
  if (cycleDay <= ovulatoryEnd) {
    return 'ovulatory';
  }
  return 'luteal';
}

export function getDaysUntilPeriod(cycleDay, cycleLength = DEFAULT_CYCLE_LENGTH) {
  const length = normalizeCycleLength(cycleLength);
  // The next period starts on the day after the cycle's final day, so the last
  // day of a cycle is 1 day out, not 0.
  if (cycleDay >= length) {
    return 1;
  }
  return length - cycleDay + 1;
}
