/* ============================================================
   SPINZY — SHARED AUTH (Google OAuth · Magic link · Email+password)
   No phone OTP. Used by both student (S1) and parent (P1).
   ============================================================ */
function AuthScreen({ role = 'student', onAuthed }) {
  const [mode, setMode] = useState('signup');     // signup | signin
  const [method, setMethod] = useState('password'); // password | magic
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const isParent = role === 'parent';
  const heading = isParent
    ? (mode === 'signup' ? 'Create your parent account' : 'Welcome back')
    : (mode === 'signup' ? 'Create your account' : 'Welcome back');
  const sub = isParent
    ? 'Follow your child’s exam-prep journey.'
    : 'Let’s set up your personalised study plan.';

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit = method === 'magic' ? emailValid : (emailValid && pw.length >= 6);

  const oauth = () => { setBusy(true); setTimeout(() => onAuthed({ method: 'google', email: 'aarav@gmail.com' }), 1100); };
  const submit = () => {
    if (method === 'magic') { setSent(true); return; }
    setBusy(true); setTimeout(() => onAuthed({ method: 'password', email }), 900);
  };

  // ---- OAuth / submitting spinner ----
  if (busy) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 99, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spz-spin 0.8s linear infinite', marginBottom: 22 }} />
        <div style={{ fontSize: 15.5, fontWeight: 700 }}>Signing you in…</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Securely verifying your account</div>
      </div>
    );
  }

  // ---- Magic link sent ----
  if (sent) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 30, textAlign: 'center' }}>
        <div style={{ width: 78, height: 78, borderRadius: 24, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}><I.send size={34} /></div>
        <h1 style={{ margin: '0 0 10px', fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Check your inbox</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 290, textWrap: 'pretty' }}>We sent a secure sign-in link to <b style={{ color: 'var(--text)' }}>{email}</b>. Tap it to continue — no password needed.</p>
        <div style={{ width: '100%', maxWidth: 300, marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn full size="lg" onClick={() => onAuthed({ method: 'magic', email })} icon={<I.checkCircle size={19} />}>Open link (demo)</Btn>
          <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Use a different email</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><I.grad size={24} /></div>
          <div><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>Spinzy</div><div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{isParent ? 'Parent' : 'Student'}</div></div>
        </div>

        <h1 style={{ margin: '0 0 6px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, textWrap: 'balance' }}>{heading}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{sub}</p>

        {/* Google OAuth */}
        <button onClick={oauth} style={{ width: '100%', height: 52, borderRadius: 14, background: 'var(--surface)', border: '1.5px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
          <GoogleG />Continue with Google
        </button>

        {/* divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>or</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* email */}
        <FieldLabel>Email</FieldLabel>
        <FauxInput value={email} placeholder="you@email.com" onType={setEmail} />

        {/* password (only in password method) */}
        {method === 'password' && (
          <div className="spz-fade-up" style={{ marginTop: 14 }}>
            <FieldLabel>Password</FieldLabel>
            <FauxInput value={pw} placeholder={mode === 'signup' ? 'Create a password (min 6)' : 'Your password'} onType={setPw} />
            {mode === 'signin' && <div style={{ textAlign: 'right', marginTop: 8 }}><button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}>Forgot password?</button></div>}
          </div>
        )}

        {/* primary */}
        <div style={{ marginTop: 18 }}>
          <Btn full size="lg" disabled={!canSubmit} onClick={submit} iconRight={<I.arrowR size={19} />}>
            {method === 'magic' ? 'Email me a magic link' : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </Btn>
        </div>

        {/* method toggle */}
        <button onClick={() => setMethod(m => m === 'password' ? 'magic' : 'password')} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {React.createElement(method === 'password' ? I.send : I.lock, { size: 15 })}
          {method === 'password' ? 'Email me a magic link instead' : 'Use email & password instead'}
        </button>
      </div>

      {/* footer: switch signup/signin + legal */}
      <div style={{ padding: '12px 24px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {mode === 'signup' ? 'Already have an account?' : 'New to Spinzy?'}{' '}
          <button onClick={() => setMode(m => m === 'signup' ? 'signin' : 'signup')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}>{mode === 'signup' ? 'Sign in' : 'Create one'}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, color: 'var(--text-faint)' }}>
          <I.shield size={13} style={{ flexShrink: 0 }} /><span style={{ fontSize: 10.5, lineHeight: 1.4, textAlign: 'center' }}>By continuing you agree to our Terms & DPDP Privacy Policy.</span>
        </div>
      </div>
    </div>
  );
}

/* placeholder Google mark — 4-band ring, not the trademark wordmark */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="#4285F4" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(-45 10 10)" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#EA4335" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(135 10 10)" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#FBBC05" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(80 10 10)" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#34A853" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(195 10 10)" />
      <text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)" fontFamily="var(--font-sans)">G</text>
    </svg>
  );
}
Object.assign(window, { AuthScreen, GoogleG });
