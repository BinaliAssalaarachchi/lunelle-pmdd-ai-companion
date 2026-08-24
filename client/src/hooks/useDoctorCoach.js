import { useCallback, useRef, useState } from 'react';
import { sendCoachMessage } from '../lib/coachApi.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const SLOW_HINT_MS = 12000;

function friendlyError(message, code) {
  if (code === 'MESSAGE_REQUIRED') return 'Write a short note first.';
  if (code === 'CLIENT_EVIDENCE_REJECTED') {
    return 'This Coach only uses your saved tracking. Try again without extra data.';
  }
  if (code === 'GEMINI_API_KEY_MISSING' || code === 'GEMINI_UNAVAILABLE') {
    return "We couldn't prepare that just now. Please try again.";
  }
  if (/fetch|network|unavailable|timeout/i.test(message || '')) {
    return "We couldn't reach the Coach just now. Please try again.";
  }
  return message || "We couldn't prepare that just now. Please try again.";
}

export function useDoctorCoach() {
  const { getIdToken } = useAuth();
  const [turns, setTurns] = useState([]);
  const [sending, setSending] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState(null);
  const sendingRef = useRef(false);

  const send = useCallback(
    async (rawMessage) => {
      const message = String(rawMessage || '').trim();
      if (!message || sendingRef.current) return null;

      sendingRef.current = true;
      setSending(true);
      setSlowHint(false);
      setError(null);
      const slowTimer = setTimeout(() => setSlowHint(true), SLOW_HINT_MS);

      const userTurn = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: message,
      };
      setTurns((current) => {
        const last = current[current.length - 1];
        if (last?.role === 'user' && last.text === message) return current;
        return [...current, userTurn];
      });

      try {
        const token = await getIdToken();
        const { ok, data } = await sendCoachMessage({
          token,
          message,
          turns,
        });

        if (!ok) {
          throw Object.assign(new Error(data.error || 'Request failed'), {
            code: data.code,
          });
        }

        if (!data?.safety || !data?.reflection) {
          throw new Error("We couldn't prepare that just now. Please try again.");
        }

        const coachTurn = {
          id: `coach-${Date.now()}`,
          role: 'coach',
          reply: data,
        };
        setTurns((current) => [...current, coachTurn]);
        return data;
      } catch (err) {
        setError(friendlyError(err.message, err.code));
        return null;
      } finally {
        clearTimeout(slowTimer);
        setSlowHint(false);
        setSending(false);
        sendingRef.current = false;
      }
    },
    [getIdToken, turns],
  );

  const reset = useCallback(() => {
    setTurns([]);
    setError(null);
    setSlowHint(false);
  }, []);

  return {
    turns,
    sending,
    slowHint,
    error,
    send,
    reset,
  };
}
