const INSIGHTS_KEY = 'lunelle.insights';

export function getLocalInsights() {
  try {
    const raw = localStorage.getItem(INSIGHTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function prependLocalInsight(insight) {
  const next = [
    {
      id: insight.id || `local-${Date.now()}`,
      ...insight,
    },
    ...getLocalInsights(),
  ].slice(0, 20);
  localStorage.setItem(INSIGHTS_KEY, JSON.stringify(next));
  return next;
}

export function setLocalInsights(insights) {
  localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
}
