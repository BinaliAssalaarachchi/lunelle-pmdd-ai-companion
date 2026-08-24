import { apiUrl } from './apiUrl.js';

export const COACH_DISCLAIMER =
  'This helps you describe your own logged data. It is not medical advice, a diagnosis, or a substitute for care.';

export const COACH_STARTERS = [
  {
    id: 'explain',
    label: 'Explain my symptoms',
    message: 'How should I explain my symptoms to my doctor?',
  },
  {
    id: 'anxiety',
    label: 'Tell them about my anxiety',
    message: 'What should I tell my doctor about my anxiety?',
  },
  {
    id: 'appointment',
    label: 'Prepare for my appointment',
    message: 'Can you help me prepare for my appointment?',
  },
];

export function turnsToRecentTurns(turns) {
  return (Array.isArray(turns) ? turns : [])
    .slice(-2)
    .map((turn) => ({
      role: turn.role === 'coach' ? 'coach' : 'user',
      text: String(
        turn.role === 'coach'
          ? turn.reply?.doctorScript ||
              turn.reply?.redirect ||
              turn.reply?.followUp ||
              ''
          : turn.text || '',
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 280),
    }))
    .filter((turn) => turn.text);
}

/** Exact body the Coach UI sends. Never includes logs, notes, or statistics. */
export function buildCoachRequest(message, turns = []) {
  return {
    message: String(message || '').trim(),
    recentTurns: turnsToRecentTurns(turns),
  };
}

export async function sendCoachMessage({ token, message, turns = [] }) {
  const body = buildCoachRequest(message, turns);
  const response = await fetch(apiUrl('/api/coach/message'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data, body };
}
