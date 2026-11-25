import { useState } from 'react';
import { AlertCircle, ArrowRight, ChartNoAxesCombined, Eye, EyeOff, Headphones, ShieldCheck, UsersRound } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { isFirebaseConfigured } from '../firebase/client';
import { sendPasswordReset } from '../services/authService';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const { language, setLanguage } = usePreferences();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const address = email.trim() || window.prompt('Enter the email address for your account:');
    if (!address) return;
    setError('');
    setMessage('');
    try {
      await sendPasswordReset(address);
      setMessage(isFirebaseConfigured ? 'Password reset instructions have been sent to your email.' : 'Demo mode has no email delivery. Use the demo password shown below.');
    } catch (resetError) {
      setError(resetError.message || 'Could not send the password reset email.');
    }
  }

  return (
    <div className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <div className="brand-mark"><ChartNoAxesCombined size={22} strokeWidth={2.2} /></div>
          <span>call<span>miner</span></span>
        </div>
        <div className="login-brand-content">
          <div className="login-eyebrow"><span /> CONVERSATION INTELLIGENCE</div>
          <h1>Every conversation<br />holds an opportunity.</h1>
          <p>Turn customer conversations into better experiences, stronger teams, and measurable growth.</p>
          <div className="login-feature"><span><Headphones size={18} /></span><div><strong>Understand every call</strong><small>One clear view of your customer conversations</small></div></div>
          <div className="login-feature"><span><ShieldCheck size={18} /></span><div><strong>Coach with confidence</strong><small>Quality insights your team can act on</small></div></div>
          <div className="login-feature"><span><UsersRound size={18} /></span><div><strong>Help every agent thrive</strong><small>Celebrate wins and find opportunities to grow</small></div></div>
        </div>
        <div className="login-brand-footer">© 2026 Call Miner, Inc. <span>Built for better conversations.</span></div>
      </section>
      <section className="login-form-panel">
        <div className="login-language">
          <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>{language === 'en' ? 'العربية' : 'English'}</button>
        </div>
        <div className="login-form-wrap">
          <div className="login-mobile-logo"><div className="brand-mark"><ChartNoAxesCombined size={21} /></div><strong>call<span>miner</span></strong></div>
          <div className="login-welcome"><div className="welcome-icon"><span /></div><h2>Welcome back</h2><p>Sign in to your workspace to continue.</p></div>
          <form onSubmit={submit}>
            <label className="form-label" htmlFor="email">Work email</label>
            <input id="email" className="form-control auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="username" required />
            <div className="password-label"><label className="form-label" htmlFor="password">Password</label><button type="button" className="text-button" onClick={resetPassword}>Forgot password?</button></div>
            <div className="password-input-wrap"><input id="password" className="form-control auth-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {error && <div className="form-error"><AlertCircle size={16} />{error}</div>}
            {message && <div className="form-success">{message}</div>}
            <button type="submit" className="btn btn-primary-custom login-submit" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
          </form>
          {!isFirebaseConfigured && <div className="demo-access"><strong>Demo workspace</strong><span>Choose an account, then use <b>Demo123!</b></span><div className="demo-account-buttons">
            {[['Admin', 'admin@callminer.demo'], ['Supervisor', 'supervisor@callminer.demo'], ['Agent', 'agent@callminer.demo']].map(([role, address]) => <button key={role} type="button" onClick={() => { setEmail(address); setPassword('Demo123!'); }}><span>{role}</span><small>{address}</small></button>)}
          </div></div>}
          <div className="login-security"><ShieldCheck size={15} />Secure, role-based access</div>
        </div>
        <div className="login-help">Need access? Contact your workspace administrator.</div>
      </section>
    </div>
  );
}
