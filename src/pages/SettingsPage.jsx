import { useEffect, useState } from 'react';
import { Bell, Check, Globe2, LockKeyhole, Save, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { updateCurrentProfile } from '../services/authService';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { language, setLanguage } = usePreferences();
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState(() => localStorage.getItem('call-miner-notifications') !== 'false');
  const [weeklyReport, setWeeklyReport] = useState(() => localStorage.getItem('call-miner-weekly-report') === 'true');
  const [aiConfig, setAiConfig] = useState(null);

  useEffect(() => { setName(user.name || ''); setEmail(user.email || ''); }, [user]);
  useEffect(() => {
    fetch('/api/config').then((response) => response.ok ? response.json() : null).then(setAiConfig).catch(() => setAiConfig(null));
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await updateCurrentProfile(user, { name: name.trim(), language });
      setUser(updated);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  function updateNotification(key, value) {
    if (key === 'notifications') {
      setNotifications(value);
      localStorage.setItem('call-miner-notifications', String(value));
    } else {
      setWeeklyReport(value);
      localStorage.setItem('call-miner-weekly-report', String(value));
    }
  }

  return (
    <div className="page-enter">
      <div className="page-heading"><div><div className="eyebrow-label">YOUR WORKSPACE <span className="eyebrow-dot" /> PREFERENCES</div><h1>Profile & settings</h1><p>Manage your personal information, language, and notifications.</p></div></div>
      {error && <div className="alert alert-warning">{error}</div>}
      <div className="settings-layout">
        <nav className="settings-nav"><a className="active" href="#profile"><UserRound size={17} />Profile</a><a href="#preferences"><Globe2 size={17} />Preferences</a><a href="#notifications"><Bell size={17} />Notifications</a><a href="#security"><LockKeyhole size={17} />Account</a></nav>
        <div className="settings-content">
          <section className="panel settings-section" id="profile"><div className="settings-section-heading"><div className="settings-section-icon"><UserRound size={18} /></div><div><h2>Personal information</h2><p>Update your name and contact details.</p></div></div><form onSubmit={saveProfile}><div className="profile-large-row"><div className="user-avatar avatar-navy profile-large-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><strong>{user.name}</strong><span>{user.role} · {user.team || 'Northstar Support'}</span></div></div><div className="settings-form-grid"><div><label className="form-label" htmlFor="profile-name">Full name</label><input id="profile-name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} required /></div><div><label className="form-label" htmlFor="profile-email">Email address</label><input id="profile-email" className="form-control" value={email} readOnly /><small className="form-text">Contact an administrator to change your email.</small></div></div><div className="settings-save-row">{saved && <span className="saved-state"><Check size={15} />Changes saved</span>}<button className="btn btn-primary-custom" disabled={saving}>{saving ? 'Saving…' : <><Save size={15} />Save changes</>}</button></div></form></section>
          <section className="panel settings-section" id="preferences"><div className="settings-section-heading"><div className="settings-section-icon"><Globe2 size={18} /></div><div><h2>Language & region</h2><p>Choose your language and display direction.</p></div></div><div className="settings-preference-row"><div><strong>Display language</strong><span>Controls language and right-to-left layout.</span></div><select className="form-select language-select" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="ar">العربية — Arabic</option></select></div><div className="rtl-info"><Globe2 size={15} />Arabic applies right-to-left page direction. Some demo content remains in English.</div></section>
          <section className="panel settings-section" id="notifications"><div className="settings-section-heading"><div className="settings-section-icon"><Bell size={18} /></div><div><h2>Notifications</h2><p>Choose which workspace updates you want to see.</p></div></div><div className="toggle-setting"><div><strong>In-app notifications</strong><span>Quality alerts and important workspace activity.</span></div><button className={`switch-control ${notifications ? 'switch-on' : ''}`} onClick={() => updateNotification('notifications', !notifications)} aria-pressed={notifications} aria-label="Toggle in-app notifications"><i /></button></div><div className="toggle-setting"><div><strong>Weekly quality summary</strong><span>A weekly digest of team performance and call trends.</span></div><button className={`switch-control ${weeklyReport ? 'switch-on' : ''}`} onClick={() => updateNotification('weeklyReport', !weeklyReport)} aria-pressed={weeklyReport} aria-label="Toggle weekly quality summary"><i /></button></div></section>
          <section className="panel settings-section account-section" id="security"><div className="settings-section-heading"><div className="settings-section-icon"><LockKeyhole size={18} /></div><div><h2>Account access</h2><p>Your workspace identity and permissions.</p></div></div><div className="account-info-row"><span>Role</span><strong>{user.role}</strong></div><div className="account-info-row"><span>Workspace</span><strong>Northstar Support</strong></div><div className="account-info-row"><span>Account status</span><strong className="active-status-dot">Active</strong></div><div className="account-info-row"><span>Speech-to-text</span><strong>{aiConfig ? `${aiConfig.sttProvider} · ${aiConfig.sttConfigured ? 'Configured' : 'Missing API key'}` : 'Backend unavailable'}</strong></div><div className="account-info-row"><span>LLM analysis</span><strong>{aiConfig ? `${aiConfig.llmProvider} · ${aiConfig.llmConfigured ? aiConfig.llmModel : 'Missing API key'}` : 'Backend unavailable'}</strong></div></section>
        </div>
      </div>
    </div>
  );
}
