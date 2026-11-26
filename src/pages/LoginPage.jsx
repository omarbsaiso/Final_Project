import { useState } from 'react';
import { AlertCircle, ArrowRight, ChartNoAxesCombined, Eye, EyeOff, Headphones, ShieldCheck, UsersRound } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { sendPasswordReset } from '../services/authService';

export default function LoginPage() {
  const { user, loading, login, signup } = useAuth();
  const { language, setLanguage } = usePreferences();
  const isArabic = language === 'ar';
  const text = (arabic, english) => isArabic ? arabic : english;
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!loading && user) return <Navigate to="/" replace />;

  async function authenticate(action) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await action();
      navigate('/', { replace: true });
    } catch (authError) {
      setError(authError.message || text('تعذر تسجيل الدخول. يرجى المحاولة مجددًا.', 'Sign-in failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError(text('يرجى إدخال عنوان بريد إلكتروني صحيح.', 'Enter a valid email address.'));
      return;
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError(text('يرجى إدخال الاسم الكامل.', 'Enter your full name.'));
      return;
    }
    if (!password || (mode === 'signup' && password.length < 6)) {
      setError(mode === 'signup'
        ? text('يجب ألا تقل كلمة المرور عن 6 أحرف.', 'The password must be at least 6 characters.')
        : text('يرجى إدخال كلمة المرور.', 'Enter your password.'));
      return;
    }
    authenticate(() => mode === 'signup'
      ? signup(name.trim(), cleanEmail, password, language)
      : login(cleanEmail, password, language));
  }

  async function resetPassword() {
    const address = email.trim() || window.prompt(text('أدخل البريد الإلكتروني المرتبط بحسابك:', 'Enter the email address for your account:'));
    if (!address) return;
    setError('');
    setMessage('');
    try {
      await sendPasswordReset(address, language);
      setMessage(text('تم إرسال تعليمات إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.', 'Password reset instructions have been sent to your email.'));
    } catch (resetError) {
      setError(resetError.message || text('تعذر إرسال رسالة إعادة تعيين كلمة المرور.', 'Could not send the password reset email.'));
    }
  }

  return (
    <div className="login-page" lang={language} dir={isArabic ? 'rtl' : 'ltr'}>
      <section className="login-brand-panel">
        <div className="login-brand">
          <div className="brand-mark"><ChartNoAxesCombined size={22} strokeWidth={2.2} /></div>
          <span>call<span>miner</span></span>
        </div>
        <div className="login-brand-content">
          <div className="login-eyebrow"><span /> {text('ذكاء المحادثات', 'CONVERSATION INTELLIGENCE')}</div>
          <h1>{isArabic ? <>في كل محادثة<br />فرصة للتطور.</> : <>Every conversation<br />holds an opportunity.</>}</h1>
          <p>{text('حوّل محادثات العملاء إلى تجارب أفضل وفرق أقوى ونمو ملموس.', 'Turn customer conversations into better experiences, stronger teams, and measurable growth.')}</p>
          <div className="login-feature"><span><Headphones size={18} /></span><div><strong>{text('افهم كل مكالمة', 'Understand every call')}</strong><small>{text('رؤية واضحة لجميع محادثات عملائك', 'One clear view of your customer conversations')}</small></div></div>
          <div className="login-feature"><span><ShieldCheck size={18} /></span><div><strong>{text('طوّر الأداء بثقة', 'Coach with confidence')}</strong><small>{text('مؤشرات جودة تساعد فريقك على التحسن', 'Quality insights your team can act on')}</small></div></div>
          <div className="login-feature"><span><UsersRound size={18} /></span><div><strong>{text('ساعد فريقك على النجاح', 'Help every agent thrive')}</strong><small>{text('اكتشف نقاط القوة وفرص التطوير', 'Celebrate wins and find opportunities to grow')}</small></div></div>
        </div>
        <div className="login-brand-footer">© 2026 Call Miner <span>{text('لخدمة عملاء أفضل.', 'Built for better conversations.')}</span></div>
      </section>
      <section className="login-form-panel">
        <div className="login-language"><button type="button" onClick={() => setLanguage(isArabic ? 'en' : 'ar')}>{isArabic ? 'English' : 'العربية'}</button></div>
        <div className="login-form-wrap">
          <div className="login-mobile-logo"><div className="brand-mark"><ChartNoAxesCombined size={21} /></div><strong>call<span>miner</span></strong></div>
          <div className="login-welcome"><div className="welcome-icon"><span /></div><h2>{mode === 'login' ? text('مرحبًا بعودتك', 'Welcome back') : text('إنشاء حساب جديد', 'Create an account')}</h2><p>{mode === 'login' ? text('سجّل الدخول للمتابعة إلى مساحة العمل.', 'Sign in to your workspace to continue.') : text('أنشئ حسابك وابدأ باستخدام مساحة العمل.', 'Create your account to get started.')}</p></div>
          <form onSubmit={submit} noValidate>
            {mode === 'signup' && <>
              <label className="form-label" htmlFor="full-name">{text('الاسم الكامل', 'Full name')}</label>
              <input id="full-name" className="form-control auth-input" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder={text('أدخل اسمك الكامل', 'Enter your full name')} autoComplete="name" required />
            </>}
            <label className="form-label" htmlFor="email">{text('البريد الإلكتروني', 'Email address')}</label>
            <input id="email" className="form-control auth-input" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required />
            <div className="password-label"><label className="form-label" htmlFor="password">{text('كلمة المرور', 'Password')}</label>{mode === 'login' && <button type="button" className="text-button" onClick={resetPassword}>{text('نسيت كلمة المرور؟', 'Forgot password?')}</button>}</div>
            <div className="password-input-wrap"><input id="password" className="form-control auth-input" type={showPassword ? 'text' : 'password'} dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? text('6 أحرف على الأقل', 'At least 6 characters') : text('أدخل كلمة المرور', 'Enter your password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 6 : undefined} required /><button type="button" className="password-toggle" aria-label={showPassword ? text('إخفاء كلمة المرور', 'Hide password') : text('إظهار كلمة المرور', 'Show password')} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {error && <div className="form-error" role="alert"><AlertCircle size={16} />{error}</div>}
            {message && <div className="form-success" role="status">{message}</div>}
            <button type="submit" className="btn btn-primary-custom login-submit" disabled={busy}>{busy ? text('جارٍ التحقق…', 'Please wait…') : <>{mode === 'login' ? text('تسجيل الدخول', 'Sign in') : text('إنشاء الحساب', 'Create account')} <ArrowRight size={17} /></>}</button>
          </form>
          <div className="login-switch">{mode === 'login' ? text('ليس لديك حساب؟', 'No account yet?') : text('لديك حساب بالفعل؟', 'Already have an account?')} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}>{mode === 'login' ? text('إنشاء حساب', 'Sign up') : text('تسجيل الدخول', 'Sign in')}</button></div>
          <div className="login-security"><ShieldCheck size={15} />{text('تسجيل دخول آمن وصلاحيات محددة', 'Secure sign-in with role-based access')}</div>
        </div>
        <div className="login-help">{text('للمساعدة، يرجى التواصل مع مسؤول مساحة العمل.', 'Need access? Contact your workspace administrator.')}</div>
      </section>
    </div>
  );
}
