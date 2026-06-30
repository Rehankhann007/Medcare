import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { useApp } from '../context/AppContext';
import {
  Mail, ShieldCheck, MailQuestion, ArrowLeft, LogIn, Eye, EyeOff, User, Lock
} from 'lucide-react';

// ─── Helper ────────────────────────────────────────────────────────────────────
const InputField = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, required, extra }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-4 h-5 w-5 text-slate-400 pointer-events-none" />}
        <input
          type={isPassword && show ? 'text' : type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`w-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-4 ${Icon ? 'pl-12' : 'pl-4'} pr-${isPassword ? '12' : '4'} text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors focus:border-primary`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
      {extra && <p className="text-xs text-slate-400 dark:text-slate-500 px-1">{extra}</p>}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const Auth = ({ setCurrentPage }) => {
  const { login, showToast } = useApp();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'

  // Sign-up state
  const [step, setStep] = useState(1); // 1 = form, 2 = OTP entry
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(''));
  const [mockOtpHint, setMockOtpHint] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const otpInputsRef = useRef([]);

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [loading, setLoading] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown((p) => p - 1), 1000);
    } else if (countdown === 0) setCanResend(true);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const resetTab = (tab) => {
    setActiveTab(tab);
    setStep(1);
    setRegName(''); setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginIdentifier(''); setLoginPassword('');
    setOtpDigits(Array(6).fill(''));
    setMockOtpHint('');
    setCountdown(30); setCanResend(false);
  };

  // ── Send OTP for signup ──────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!regName || !regUsername || !regEmail || !regPassword) {
      return showToast('Sabhi fields fill karo.', 'error');
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(regUsername)) {
      return showToast('Username 3-20 characters ka hona chahiye (letters, numbers, _ only).', 'error');
    }
    if (regPassword.length < 6) {
      return showToast('Password kam se kam 6 characters ka hona chahiye.', 'error');
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, name: regName })
      });
      const data = await res.json();
      if (data.success) {
        setStep(2);
        setCountdown(30);
        setCanResend(false);
        setOtpDigits(Array(6).fill(''));
        if (data.mockOtp) setMockOtpHint(data.mockOtp);
        showToast(data.message, 'success');
      } else {
        showToast(data.message || 'OTP bhejne me error.', 'error');
      }
    } catch {
      showToast('Network error. Dobara try karo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP + Complete Registration ──────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) return showToast('6-digit OTP enter karo.', 'error');

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          username: regUsername,
          email: regEmail,
          password: regPassword,
          otp
        })
      });
      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        showToast('Account ban gaya! Welcome to MedCare 🎉', 'success');
        setCurrentPage('home');
      } else {
        showToast(data.message || 'Registration failed.', 'error');
      }
    } catch {
      showToast('Network error. Dobara try karo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Password Login ───────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      return showToast('Username/email aur password dono chahiye.', 'error');
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        showToast('Welcome back! 👋', 'success');
        setCurrentPage('home');
      } else {
        showToast(data.message || 'Login failed.', 'error');
      }
    } catch {
      showToast('Network error. Dobara try karo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Google Login ─────────────────────────────────────────────────────────────
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleBtnRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);

  const sendGoogleCredentialToBackend = async (credential) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        showToast('Google se login ho gaya! 🎉', 'success');
        setCurrentPage('home');
      } else {
        showToast(data.message || 'Google sign-in failed.', 'error');
      }
    } catch {
      showToast('Google login error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initialize Google Identity Services once the script + Client ID are ready,
  // and render the official Google button into our hidden container.
  // Using renderButton (instead of prompt()/One Tap) avoids the
  // accounts.google.com/gsi/status preflight call that 403s when the
  // current origin isn't in Google Cloud Console's authorized list, and is
  // the FedCM-compliant path going forward.
useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 200);
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => sendGoogleCredentialToBackend(response.credential),
          use_fedcm_for_prompt: true
        });
        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          const isDark = document.documentElement.classList.contains('dark');
          const btnWidth = Math.min(googleBtnRef.current.offsetWidth || 360, 400);
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: isDark ? 'filled_black' : 'outline',
            size: 'large',
            shape: 'pill',
            width: btnWidth,
            logo_alignment: 'center',
            text: activeTab === 'register' ? 'signup_with' : 'signin_with'
          });
        }
        setGoogleReady(true);
      } catch (err) {
        console.error('Google Identity Services init failed:', err);
        setGoogleReady(false);
      }
    };
    tryInit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GOOGLE_CLIENT_ID, activeTab]);

  // Fallback: mock Google login for local/dev testing without a real Client ID
  const handleMockGoogleLogin = async () => {
    setLoading(true);
    try {
      const seedEmail = loginIdentifier || regEmail || 'googleuser@gmail.com';
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: null, // null triggers mock on backend
          email: seedEmail.includes('@') ? seedEmail : `${seedEmail}@gmail.com`,
          name: seedEmail.split('@')[0].replace(/[^a-zA-Z ]/g, ' ') || 'Google User',
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedEmail}`
        })
      });
      const data = await res.json();
      if (data.success) {
        login(data.token, data.user);
        showToast('Google se login ho gaya! 🎉 (dev mock)', 'success');
        setCurrentPage('home');
      } else {
        showToast('Google sign-in failed.', 'error');
      }
    } catch {
      showToast('Google login error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Input handling ───────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpInputsRef.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // ─── Sidebar content ─────────────────────────────────────────────────────────
  const sidebarFeatures = activeTab === 'login'
    ? ['Username ya Gmail se seedha login', 'Password-protected secure access', 'Google account se 1-click login']
    : ['Username, Gmail, Password se signup', 'OTP se email verify hogi', 'Google se bhi signup kar sakte ho'];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-6xl grid gap-8 lg:grid-cols-[1fr_1.1fr]">

        {/* ── Left Panel ── */}
        <div className="hidden lg:flex flex-col justify-between rounded-[36px] overflow-hidden shadow-[0_50px_140px_rgba(15,23,42,0.18)] bg-gradient-to-br from-primary to-secondary text-white">
          <div className="relative p-10 space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 border border-white/10 backdrop-blur-sm">
              <span className="text-lg">🏥</span>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/70">MedCare Secure Access</p>
                <p className="font-black text-xl">{activeTab === 'login' ? 'Fast & Secure Login' : 'Join MedCare'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-black leading-tight">
                {activeTab === 'login' ? 'Login with username or email.' : 'Sign up in just a few steps.'}
              </h1>
              <p className="max-w-md text-sm text-white/80 leading-relaxed">
                {activeTab === 'login'
                  ? 'Apna username ya Gmail aur password enter karo. Google se bhi login kar sakte ho.'
                  : 'Username, email aur password se account banao. OTP se email verify hogi.'}
              </p>
            </div>
            <div className="space-y-4">
              {sidebarFeatures.map((text, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-white/90">
                  <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/15 text-white">✓</span>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative p-10 overflow-hidden border-t border-white/10">
            <div className="absolute left-6 top-6 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-10 bottom-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="relative rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.28em] text-white/60">Why MedCare</p>
              <p className="mt-4 text-sm text-white/80 leading-relaxed">Smart, secure healthcare — instant login, reliable drug support, seamless order tracking.</p>
              <div className="mt-6 grid gap-3">
                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">⚡</span>
                  <p className="text-sm">Fast onboarding for patients and staff.</p>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">🔒</span>
                  <p className="text-sm">Encrypted passwords and OTP-verified accounts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="relative rounded-[36px] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 overflow-hidden">
          <div className="absolute -right-16 top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -left-12 bottom-10 h-28 w-28 rounded-full bg-secondary/10 blur-3xl" />

          <button onClick={() => setCurrentPage('home')}
            className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </button>

          {/* Tab switcher */}
          <div className="grid gap-3 mb-8 sm:grid-cols-2">
            {['login', 'register'].map((tab) => (
              <button key={tab} onClick={() => resetTab(tab)}
                className={`rounded-3xl py-3 text-sm font-semibold transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/80'}`}>
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ════ LOGIN FORM ════ */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="mb-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Welcome back!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Username ya email se login karo.</p>
              </div>

              <InputField
                icon={User}
                label="Username ya Email"
                placeholder="rahul123 ya rahul@gmail.com"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
              />
              <InputField
                icon={Lock}
                label="Password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />

              <button type="submit" disabled={loading}
                className="w-full rounded-3xl bg-primary py-4 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-70">
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-200 dark:border-slate-800" />
                <p className="relative mx-auto w-max bg-white dark:bg-slate-900 px-4 text-xs uppercase text-slate-400">Ya phir</p>
              </div>

              {GOOGLE_CLIENT_ID ? (
                <div ref={activeTab === 'login' ? googleBtnRef : null} className="flex justify-center" />
              ) : (
                <button type="button" onClick={handleMockGoogleLogin} disabled={loading}
                  className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-4 text-sm font-semibold text-slate-700 dark:text-slate-100 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google se Login (dev mock)
                </button>
              )}
            </form>
          )}

          {/* ════ REGISTER FORM ════ */}
          {activeTab === 'register' && step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="mb-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Account banao</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">OTP se email verify hogi.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  icon={User}
                  label="Full Name"
                  placeholder="Rahul Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
                <InputField
                  icon={User}
                  label="Username"
                  placeholder="rahul123"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  required
                  extra="3-20 chars, letters/numbers/_ only"
                />
              </div>

              <InputField
                icon={Mail}
                label="Gmail / Email"
                type="email"
                placeholder="rahul@gmail.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />

              <InputField
                icon={Lock}
                label="Password"
                type="password"
                placeholder="Kam se kam 6 characters"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                extra="Minimum 6 characters"
              />

              <button type="submit" disabled={loading}
                className="w-full rounded-3xl bg-primary py-4 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-70">
                {loading ? 'OTP bhej rahe hain...' : 'OTP Bhejo & Verify Karo'}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-200 dark:border-slate-800" />
                <p className="relative mx-auto w-max bg-white dark:bg-slate-900 px-4 text-xs uppercase text-slate-400">Ya phir</p>
              </div>

              {GOOGLE_CLIENT_ID ? (
                <div ref={activeTab === 'register' ? googleBtnRef : null} className="flex justify-center" />
              ) : (
                <button type="button" onClick={handleMockGoogleLogin} disabled={loading}
                  className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-4 text-sm font-semibold text-slate-700 dark:text-slate-100 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google se Sign Up (dev mock)
                </button>
              )}
            </form>
          )}

          {/* ════ OTP VERIFICATION STEP ════ */}
          {activeTab === 'register' && step === 2 && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="mb-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">OTP Verify Karo</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">6-digit code bheja gaya hai.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                <div className="flex items-center gap-3">
                  <MailQuestion className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">OTP bheja gaya</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{regEmail}</p>
                  </div>
                </div>
                {mockOtpHint && (
                  <p className="mt-3 rounded-2xl bg-secondary/10 border border-secondary/20 px-4 py-3 text-sm text-secondary-dark dark:text-secondary">
                    Dev OTP: <span className="font-bold">{mockOtpHint}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">6-Digit OTP</label>
                <div className="grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpInputsRef.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(e, i)}
                      className="h-14 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center text-xl font-bold text-slate-900 dark:text-slate-100 outline-none transition-colors focus:border-primary"
                    />
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full rounded-3xl bg-secondary py-4 text-sm font-semibold text-white transition-all hover:bg-secondary/90 disabled:opacity-70">
                {loading ? 'Verify ho raha hai...' : 'Verify & Account Banao'}
              </button>

              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <button type="button" onClick={() => setStep(1)} className="font-semibold text-primary hover:underline">
                  ← Wapas jao
                </button>
                <div>
                  {canResend ? (
                    <button type="button" onClick={handleSendOtp} className="font-semibold text-primary hover:underline">
                      OTP Dobara Bhejo
                    </button>
                  ) : (
                    <span>Resend in <span className="font-semibold text-slate-700 dark:text-slate-200">{countdown}s</span></span>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
