import {
  DEMO_MODE_UNAVAILABLE_MESSAGE,
  isDemoAccountEmail,
} from '../../../shared/demoAccount.js';

export { DEMO_MODE_UNAVAILABLE_MESSAGE };

export function isDemoAccountUser(user) {
  return isDemoAccountEmail(user?.email, {
    VITE_DEMO_EMAIL: import.meta.env.VITE_DEMO_EMAIL,
  });
}
