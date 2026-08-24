import { DEFAULT_CYCLE_LENGTH } from './constants.js';
import { addDays, formatDate } from './cycle.js';

/** How many daily symptom logs to generate (historical through today). */
export const SEED_LOG_DAYS = 30;

/**
 * Cycle day assigned to "today" so the dashboard opens in late luteal —
 * the PMDD-relevant window — instead of Day 1 menstrual.
 * Must be in 1..cycleLength; values near 22 keep ~6 days until the next period.
 */
export const SEED_TODAY_CYCLE_DAY = 22;

/**
 * Build a date-relative seed timeline.
 * - lastPeriodStart is several weeks before today (today is SEED_TODAY_CYCLE_DAY)
 * - log range ends on today (no future dates)
 * - re-running on any calendar date yields the same cycle position for "today"
 */
export function buildSeedTimeline(
  today = formatDate(new Date()),
  {
    cycleLength = DEFAULT_CYCLE_LENGTH,
    seedDays = SEED_LOG_DAYS,
    todayCycleDay = SEED_TODAY_CYCLE_DAY,
  } = {},
) {
  const length =
    Number.isFinite(Number(cycleLength)) && Number(cycleLength) > 0
      ? Math.round(Number(cycleLength))
      : DEFAULT_CYCLE_LENGTH;
  const clampedTodayDay = Math.min(
    Math.max(Math.round(Number(todayCycleDay)) || SEED_TODAY_CYCLE_DAY, 1),
    length,
  );
  const days = Math.max(1, Math.round(Number(seedDays)) || SEED_LOG_DAYS);

  const lastPeriodStart = addDays(today, -(clampedTodayDay - 1));
  const rangeStart = addDays(today, -(days - 1));

  return {
    today,
    lastPeriodStart,
    rangeStart,
    seedDays: days,
    todayCycleDay: clampedTodayDay,
    cycleLength: length,
  };
}

/** Inclusive list of YYYY-MM-DD dates from rangeStart through today. */
export function enumerateSeedDates(timeline) {
  const dates = [];
  for (let offset = 0; offset < timeline.seedDays; offset += 1) {
    dates.push(addDays(timeline.rangeStart, offset));
  }
  return dates;
}
