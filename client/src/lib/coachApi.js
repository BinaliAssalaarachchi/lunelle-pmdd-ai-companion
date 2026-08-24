export const COACH_DISCLAIMER =
  'This helps you describe your own logged data. It is not medical advice, a diagnosis, or a substitute for care.';

export const COACH_STARTERS = [
  {
    id: 'anxiety',
    label: 'Explain my anxiety',
    message: "I don't know how to explain how bad my anxiety gets to my doctor.",
  },
  {
    id: 'week_before',
    label: 'The week before my period',
    message:
      'Help me describe what the week before my period looks like in my tracking.',
  },
  {
    id: 'impact',
    label: 'Work and relationships',
    message:
      'Help me talk to my doctor about how this affects work and relationships.',
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
  const response = await fetch('/api/coach/message', {
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
