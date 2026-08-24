const SECTION_ALIASES = {
  summary: 'mainPattern',
  'main pattern': 'mainPattern',
  'pattern summary': 'mainPattern',
  'observed patterns': 'whatStoodOut',
  'what stood out': 'whatStoodOut',
  'luteal phase notes': 'whatThisMayMean',
  'what this may mean': 'whatThisMayMean',
  'what you might notice': 'whatThisMayMean',
  'gentle suggestions': 'gentleSuggestions',
  disclaimer: 'disclaimer',
};

/**
 * Split insight markdown into named sections for the structured Insights UI.
 * Supports both v2 headings and legacy Pattern Summary / Luteal Phase Notes.
 */
export function parseInsightContent(content) {
  const text = String(content || '').trim();
  const sections = {
    mainPattern: '',
    whatStoodOut: '',
    whatThisMayMean: '',
    gentleSuggestions: '',
    disclaimer: '',
  };

  if (!text) return sections;

  let working = text;
  let preamble = '';
  if (!working.startsWith('## ')) {
    const headingIndex = working.search(/^##\s+/m);
    if (headingIndex > 0) {
      preamble = working.slice(0, headingIndex).trim();
      working = working.slice(headingIndex).trim();
    } else if (headingIndex === -1) {
      sections.mainPattern = working;
      return sections;
    }
  }

  const parts = working.split(/^##\s+/m).filter(Boolean);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    const body = (newline === -1 ? '' : part.slice(newline + 1)).trim();
    const key = SECTION_ALIASES[title.toLowerCase()];
    if (key) {
      sections[key] = body;
    }
  }

  if (preamble) {
    sections.gentleSuggestions = sections.gentleSuggestions
      ? `${sections.gentleSuggestions}\n\n${preamble}`
      : preamble;
  }

  return sections;
}

export function formatInsightDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
