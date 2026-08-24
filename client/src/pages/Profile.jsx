import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mayaAvatar from '../assets/maya-avatar.png';
import {
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from '../components/profile/SettingsSection.jsx';
import { LoadingState } from '../components/ui/states.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useProfileSettings } from '../hooks/useProfileSettings.js';
import { PartnerSharingSection } from '../components/profile/PartnerSharingSection.jsx';

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'L';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-base font-semibold text-ink">
        {label}
      </span>
      {children}
    </label>
  );
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

const TRACK_TOGGLES = [
  { key: 'trackMood', label: 'Mood' },
  { key: 'trackPhysical', label: 'Physical' },
  { key: 'trackCognitive', label: 'Focus' },
  { key: 'trackBehavioral', label: 'Daily life' },
];

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    logout,
    deleteAccount,
    updateDisplayName,
    changePassword,
  } = useAuth();
  const { loading, saving, error, profile, setProfile, saveProfile } =
    useProfileSettings();

  const [nameDraft, setNameDraft] = useState('');
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile?.displayName) setNameDraft(profile.displayName);
  }, [profile?.displayName]);

  function flash(message) {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2500);
  }

  function updatePreference(key, value) {
    setDirty(true);
    setProfile((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!profile) return;
    setFormError('');
    try {
      const nextName = nameDraft.trim();
      if (nextName && nextName !== (user?.displayName || profile.displayName)) {
        await updateDisplayName(nextName);
      }
      await saveProfile({ ...profile, displayName: nextName || profile.displayName });
      setDirty(false);
      flash('Saved');
    } catch (err) {
      setFormError(err.message || 'Could not save');
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setFormError('');
    if (nextPassword !== confirmPassword) {
      setFormError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      flash('Password updated');
    } catch (err) {
      setFormError(err.message || 'Could not update password');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Delete your account and all symptom data permanently? This cannot be undone.',
    );
    if (!confirmed) return;

    setDeleting(true);
    setFormError('');
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Could not delete account');
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  if (loading || !profile) {
    return <LoadingState message="Loading your profile…" />;
  }

  const prefs = profile.preferences;
  const displayName = user?.displayName || profile.displayName;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <header>
        <p className="eyebrow mb-3">Account</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          Profile
        </h1>
      </header>

      {status ? (
        <p className="rounded-2xl border-2 border-fern bg-cream px-4 py-3 text-sm text-pine-deep">
          {status}
        </p>
      ) : null}
      {formError || error ? (
        <p className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-ink" role="alert">
          {formError || error}
        </p>
      ) : null}

      <form onSubmit={handleSave} className="space-y-6">
        <SettingsSection title="You" icon={<IconPerson />}>
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pine font-display text-2xl font-semibold text-cream">
              {displayName === 'Maya' ? (
                <img src={mayaAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsFromName(displayName)
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold text-ink">
                {displayName}
              </p>
              <p className="mt-0.5 text-base text-moss">{user?.email}</p>
            </div>
          </div>

          <Field label="Display name">
            <input
              type="text"
              required
              value={nameDraft}
              onChange={(event) => {
                setDirty(true);
                setNameDraft(event.target.value);
              }}
              className="input-field min-h-[44px] px-3 py-3 text-base"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="input-field min-h-[44px] px-3 py-3 text-base opacity-80"
            />
          </Field>
        </SettingsSection>

        <SettingsSection
          title="Cycle"
          description="Used on Home, Track, and Insights."
          icon={<IconCalendar />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cycle length (days)">
              <input
                type="number"
                min={21}
                max={45}
                value={profile.cycleLength}
                onChange={(event) => {
                  setDirty(true);
                  setProfile((current) => ({
                    ...current,
                    cycleLength: Number(event.target.value),
                  }));
                }}
                className="input-field min-h-[44px] px-3 py-3 text-base"
              />
            </Field>
            <Field label="Period length (days)">
              <input
                type="number"
                min={2}
                max={10}
                value={profile.periodLength}
                onChange={(event) => {
                  setDirty(true);
                  setProfile((current) => ({
                    ...current,
                    periodLength: Number(event.target.value),
                  }));
                }}
                className="input-field min-h-[44px] px-3 py-3 text-base"
              />
            </Field>
          </div>
          <Field label="Last period start">
            <input
              type="date"
              value={profile.lastPeriodStart || ''}
              onChange={(event) => {
                setDirty(true);
                setProfile((current) => ({
                  ...current,
                  lastPeriodStart: event.target.value || null,
                }));
              }}
              className="input-field min-h-[44px] px-3 py-3 text-base"
            />
          </Field>

          <p className="text-base font-semibold text-ink">What you track</p>
          <div className="grid grid-cols-2 gap-2">
            {TRACK_TOGGLES.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-2xl bg-cream/55 px-3 py-2.5"
              >
                <span className="text-base font-medium text-ink">{item.label}</span>
                <SettingsToggle
                  label={item.label}
                  checked={Boolean(prefs[item.key])}
                  onChange={(value) => updatePreference(item.key, value)}
                />
              </label>
            ))}
          </div>

          <SettingsRow
            label="Daily reminder"
            hint={
              prefs.dailyReminder
                ? `Around ${prefs.reminderTime || '09:00'}`
                : 'Off'
            }
          >
            <SettingsToggle
              label="Daily reminder"
              checked={Boolean(prefs.dailyReminder)}
              onChange={(value) => updatePreference('dailyReminder', value)}
            />
          </SettingsRow>
          {prefs.dailyReminder ? (
            <Field label="Reminder time">
              <input
                type="time"
                value={prefs.reminderTime || '09:00'}
                onChange={(event) =>
                  updatePreference('reminderTime', event.target.value)
                }
                className="input-field min-h-[44px] max-w-xs px-3 py-3 text-base"
              />
            </Field>
          ) : null}

          <SettingsRow
            label="Notifications"
            hint="Stored with your profile."
          >
            <SettingsToggle
              label="Enable notifications"
              checked={Boolean(prefs.notificationsEnabled)}
              onChange={(value) =>
                updatePreference('notificationsEnabled', value)
              }
            />
          </SettingsRow>

          <SettingsRow
            label="AI insights"
            hint="How Lunelle presents reflections."
          >
            <SettingsToggle
              label="AI insights enabled"
              checked={Boolean(prefs.aiInsightsEnabled)}
              onChange={(value) =>
                updatePreference('aiInsightsEnabled', value)
              }
            />
          </SettingsRow>
          {prefs.aiInsightsEnabled ? (
            <Field label="Insight frequency">
              <select
                value={prefs.insightFrequency || 'on_demand'}
                onChange={(event) =>
                  updatePreference('insightFrequency', event.target.value)
                }
                className="input-field min-h-[44px] px-3 py-3 text-base"
              >
                <option value="on_demand">On demand only</option>
                <option value="weekly">Weekly summaries</option>
                <option value="monthly">Monthly reflections</option>
              </select>
            </Field>
          ) : null}

          <button
            type="submit"
            disabled={saving || !dirty}
            className="btn-accent mt-1 min-h-[48px] px-6 py-3 text-sm"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </SettingsSection>
      </form>

      <PartnerSharingSection />

      <SettingsSection title="Privacy & security" icon={<IconShield />}>
        <p className="text-base leading-relaxed text-moss">
          Your logs stay under your account. Lunelle is not a medical diagnosis
          or a substitute for professional care.
        </p>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <p className="text-base font-semibold text-ink">Password</p>
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input-field min-h-[44px] px-3 py-3 text-base"
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New password">
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                className="input-field min-h-[44px] px-3 py-3 text-base"
                required
              />
            </Field>
            <Field label="Confirm">
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input-field min-h-[44px] px-3 py-3 text-base"
                required
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="btn-login-soft min-h-[44px] px-5 py-2.5 text-sm"
          >
            {passwordSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <Link
          to="/reports"
          className="group flex min-h-[44px] items-center justify-between gap-3 border-t border-white/50 pt-3 text-base font-semibold text-ink"
        >
          Export my data
          <span aria-hidden="true" className="text-moss group-hover:text-clay-deep">
            →
          </span>
        </Link>

        <p className="text-sm leading-relaxed text-moss">
          If you feel unsafe, contact local emergency services or{' '}
          <a
            href="https://www.iasp.info/suicidalthoughts/"
            target="_blank"
            rel="noreferrer"
            className="link-accent"
          >
            iasp.info/suicidalthoughts
          </a>
          .
        </p>

        <button
          type="button"
          disabled={deleting}
          onClick={handleDeleteAccount}
          className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-danger/35 px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete account & data'}
        </button>
      </SettingsSection>

      <div className="flex justify-center pt-2 md:justify-start">
        <button
          type="button"
          onClick={handleLogout}
          className="btn-accent min-h-[48px] px-8 py-3 text-sm"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
