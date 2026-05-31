/* ============================================================
   SPINZY — STUDENT SCREENS CORE (S1 Onboarding, S2 Diagnostic, S3 Dashboard)
   ============================================================ */

/* ============ S1 — ONBOARDING ============ */
function OnboardingScreen({ onDone, theme, scenario }) {
  const [authed, setAuthed] = useState(scenario === 'consent');
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: '', dob: '', board: '', grade: '', subjects: [], lang: '' });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // age gate: derive from dob year
  const age = useMemo(() => {
    if (!data.dob) return null;
    const y = parseInt(data.dob.split('-')[0] || data.dob.slice(-4));
    return y ? 2026 - y : null;
  }, [data.dob]);
  const needsConsent = age !== null && age < 13;

  const steps = ['name', 'dob', 'board', 'subjects', 'lang'];
  if (needsConsent) steps.push('consent');
  const total = steps.length;
  const cur = steps[step];

  const next = () => step < total - 1 ? setStep(step + 1) : onDone();
  const canNext = {
    name: data.name.trim().length > 1,
    dob: !!data.dob,
    board: data.board && data.grade,
    subjects: data.subjects.length > 0,
    lang: !!data.lang,
    consent: data.consentDone,
  }[cur];

  const update = (k, v) => setData(d => ({ ...d, [k]: v }));
  const toggleSubj = s => setData(d => ({ ...d, subjects: d.subjects.includes(s) ? d.subjects.filter(x => x !== s) : [...d.subjects, s] }));

  if (!authed) return <AuthScreen role="student" onAuthed={(info) => { setAuthed(true); if (info?.email) setData(d => ({ ...d, email: info.email })); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* progress */}
      <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><I.chevL size={22} /></button>}
        <div style={{ flex: 1 }}><Bar value={step + 1} max={total} h={6} /></div>
        <Mono style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{step + 1}/{total}</Mono>
      </div>

      <div key={cur} className="spz-fade-up" style={{ flex: 1, padding: '28px 24px', overflow: 'auto' }}>
        {cur === 'name' && (
          <Step title={`Let’s get started`} sub="What should Vidya call you?">
            <FauxInput value={data.name} placeholder="Your first name" onType={v => update('name', v)} autofocus />
          </Step>
        )}
        {cur === 'dob' && (
          <Step title="When were you born?" sub="This personalises your study plan.">
            <FauxInput value={data.dob} placeholder="DD-MM-YYYY" onType={v => update('dob', v)} mono />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {[{ l: 'Age 11 (demo)', v: '01-01-2015' }, { l: 'Age 15 (demo)', v: '01-01-2011' }].map(o => (
                <button key={o.v} onClick={() => update('dob', o.v)} style={chipBtn(data.dob === o.v)}>{o.l}</button>
              ))}
            </div>
            {needsConsent && <Note icon="shield" text="You’re under 13 — we’ll need a parent’s consent in a moment (DPDP rule)." />}
          </Step>
        )}
        {cur === 'board' && (
          <Step title="Your board & grade" sub="We’ll align content to your syllabus.">
            <FieldLabel>Board</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {['CBSE', 'ICSE', 'State Board'].map(b => <button key={b} onClick={() => update('board', b)} style={chipBtn(data.board === b)}>{b}</button>)}
            </div>
            <FieldLabel>Grade</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[4,5,6,7,8,9,10,11,12].map(g => <button key={g} onClick={() => update('grade', g)} style={{ ...chipBtn(data.grade === g), width: 46, justifyContent: 'center' }}><Mono>{g}</Mono></button>)}
            </div>
          </Step>
        )}
        {cur === 'subjects' && (
          <Step title="Pick your subjects" sub="Choose what you want to focus on.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.values(SUBJECTS).map(s => {
                const on = data.subjects.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSubj(s.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                    background: on ? `color-mix(in oklch, ${s.color} 12%, var(--surface))` : 'var(--surface)',
                    border: `1.5px solid ${on ? s.color : 'var(--border)'}`, transition: 'all .15s', textAlign: 'left',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17 }}>{s.abbr}</div>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{s.name}</span>
                    <div style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${on ? s.color : 'var(--border-strong)'}`, background: on ? s.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{on && <I.check size={15} stroke={3} />}</div>
                  </button>
                );
              })}
            </div>
          </Step>
        )}
        {cur === 'lang' && (
          <Step title="Preferred language" sub="Vidya can explain in your comfort language.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['English', 'Hindi', 'Hinglish (mix)'].map(l => {
                const on = data.lang === l;
                return (
                  <button key={l} onClick={() => update('lang', l)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderRadius: 14, cursor: 'pointer',
                    background: on ? 'var(--primary-soft)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, textAlign: 'left',
                  }}>
                    <I.globe size={22} style={{ color: on ? 'var(--primary)' : 'var(--text-faint)' }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{l}</span>
                    {on && <I.check size={20} stroke={3} style={{ color: 'var(--primary)' }} />}
                  </button>
                );
              })}
            </div>
          </Step>
        )}
        {cur === 'consent' && (
          <Step title="Parent consent" sub="A quick approval keeps Aarav’s data safe.">
            <Note icon="shield" text="Under DPDP rules, learners under 13 need verified parental consent before any data is processed." />
            <div style={{ marginTop: 18 }}>
              <FieldLabel>Parent’s email</FieldLabel>
              <FauxInput value={data.pemail || ''} placeholder="parent@email.com" onType={v => update('pemail', v)} />
            </div>
            {!otpSent ? (
              <div style={{ marginTop: 16 }}><Btn full disabled={!data.pemail} icon={<I.send size={18} />} onClick={() => setOtpSent(true)}>Send consent link</Btn></div>
            ) : (
              <div className="spz-fade-up" style={{ marginTop: 18, padding: 16, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.send size={17} /></div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Consent link sent</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 12 }}>We emailed a secure approval link to <b style={{ color: 'var(--text)' }}>{data.pemail}</b>. Your parent taps it to approve — no code to type.</div>
                <Btn full size="sm" variant="secondary" onClick={() => update('consentDone', true)} icon={<I.checkCircle size={16} />}>{data.consentDone ? 'Parent approved ✓' : 'Simulate parent approval (demo)'}</Btn>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10 }}>Link expires in 30 min. <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Resend</span></div>
              </div>
            )}
          </Step>
        )}
      </div>

      <div style={{ padding: '12px 24px 28px', background: 'var(--bg)' }}>
        <Btn full size="lg" disabled={!canNext} iconRight={<I.arrowR size={20} />} onClick={next}>
          {step === total - 1 ? 'Start diagnostic' : 'Continue'}
        </Btn>
      </div>
    </div>
  );
}

function Step({ title, sub, children }) {
  return (
    <div>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, textWrap: 'balance' }}>{title}</h1>
      {sub && <p style={{ margin: '0 0 26px', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.45 }}>{sub}</p>}
      {children}
    </div>
  );
}
function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{children}</div>;
}
function FauxInput({ value, placeholder, onType, mono, autofocus }) {
  const ref = useRef(null);
  useEffect(() => { if (autofocus && ref.current) ref.current.focus(); }, []);
  return (
    <input ref={ref} value={value} placeholder={placeholder} onChange={e => onType(e.target.value)}
      style={{
        width: '100%', height: 54, padding: '0 18px', borderRadius: 14, outline: 'none',
        border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
        fontSize: 16, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: 500,
        transition: 'border .15s',
      }}
      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'} />
  );
}
function OtpInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          flex: 1, height: 58, borderRadius: 14, border: `1.5px solid ${value.length === i ? 'var(--primary)' : 'var(--border)'}`,
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600,
        }}>{value[i] || ''}</div>
      ))}
      <input value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0,4))} inputMode="numeric"
        autoFocus style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
      <button onClick={() => onChange('1234')} style={{ ...chipBtn(false), height: 58 }}>Auto</button>
    </div>
  );
}
function Note({ icon, text }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, background: 'var(--primary-soft)', marginTop: 16 }}>
      <div style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>{React.createElement(I[icon] || I.info, { size: 19 })}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, textWrap: 'pretty' }}>{text}</div>
    </div>
  );
}
const chipBtn = (on) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
  background: on ? 'var(--primary)' : 'var(--surface)', color: on ? 'var(--on-brand)' : 'var(--text)',
  border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-sans)',
  transition: 'all .15s',
});

Object.assign(window, { OnboardingScreen, Step, FieldLabel, FauxInput, Note, chipBtn });
