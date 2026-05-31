/* ============================================================
   SPINZY — S2 DIAGNOSTIC ASSESSMENT
   ============================================================ */
function DiagnosticScreen({ onDone, scenario }) {
  // phases: intro -> running -> generating -> results
  const [phase, setPhase] = useState('intro');
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [genPct, setGenPct] = useState(0);

  const Q = DIAGNOSTIC_Q;
  const cur = Q[qi];

  // generation polling sim
  useEffect(() => {
    if (phase !== 'generating') return;
    if (scenario === 'error') return; // stays on error
    setGenPct(0);
    const steps = [18, 42, 67, 88, 100];
    let i = 0;
    const t = setInterval(() => {
      setGenPct(steps[i]); i++;
      if (i >= steps.length) { clearInterval(t); setTimeout(() => setPhase('results'), 700); }
    }, 650);
    return () => clearInterval(t);
  }, [phase]);

  const submit = () => {
    const a = [...answers, picked];
    setAnswers(a); setPicked(null);
    if (qi < Q.length - 1) setQi(qi + 1);
    else setPhase('generating');
  };

  if (phase === 'intro') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', padding: 24 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: 28, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}><I.target size={42} stroke={1.7} /></div>
          <h1 style={{ margin: '0 0 10px', fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', textWrap: 'balance' }}>Let’s find your starting point</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 300, textWrap: 'pretty' }}>A short {Q.length}-question check so Vidya can build a plan that’s actually yours. No grades, no pressure.</p>
          <div style={{ display: 'flex', gap: 20, marginTop: 28 }}>
            {[['clock', `~${Q.length} min`], ['brain', 'Adaptive'], ['shield', 'Private']].map(([ic, t]) => (
              <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                {React.createElement(I[ic], { size: 22 })}<span style={{ fontSize: 12, fontWeight: 600 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <Btn full size="lg" onClick={() => setPhase('running')} iconRight={<I.arrowR size={20} />}>Begin diagnostic</Btn>
      </div>
    );
  }

  if (phase === 'generating') {
    if (scenario === 'error') {
      return <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <ErrorState title="Couldn’t generate your plan" body="Our tutor engine hit a snag while analysing your answers. Your responses are saved." onRetry={() => setPhase('generating')} />
      </div>;
    }
    const stages = ['Reviewing your answers', 'Mapping concept gaps', 'Calibrating difficulty', 'Building your learning path', 'Almost ready'];
    const si = Math.min(stages.length - 1, Math.floor(genPct / 22));
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 28 }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2*Math.PI*52} strokeDashoffset={2*Math.PI*52*(1-genPct/100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I.sparkle size={36} style={{ color: 'var(--primary)', animation: 'spz-pulse 1.6s infinite' }} />
          </div>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Building your plan</h2>
        <div key={si} className="spz-fade-up" style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{stages[si]}…</div>
        <Mono style={{ fontSize: 12, color: 'var(--text-faint)' }}>{genPct}%</Mono>
      </div>
    );
  }

  if (phase === 'results') {
    const res = [
      { subject: 'math', tier: 'fair' }, { subject: 'science', tier: 'ontrack' },
      { subject: 'social', tier: 'weak' },
    ];
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }} className="spz-fade-up">
            <div style={{ width: 72, height: 72, borderRadius: 24, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><I.checkCircle size={36} /></div>
            <h1 style={{ margin: '0 0 8px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em' }}>Your plan is ready, Aarav</h1>
            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5, textWrap: 'pretty' }}>Here’s where you’re starting. We’ll grow these together — no number, just progress.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {res.map((r, i) => (
              <Card key={r.subject} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i*0.08}s` }}>
                <Ring tier={r.tier} size={48} stroke={5}><div style={{ width: 18, height: 18, borderRadius: 99, background: TIERS[r.tier].soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 8, height: 8, borderRadius: 99, background: TIERS[r.tier].color }} /></div></Ring>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{SUBJECTS[r.subject].name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Starting tier</div>
                </div>
                <TierPill tier={r.tier} />
              </Card>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: 16, borderRadius: 16, background: 'var(--primary-soft)', display: 'flex', gap: 12 }}>
            <I.bulb size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}><b>First focus:</b> Quadratic Equations. It’s the fastest way to lift your Math tier.</div>
          </div>
        </div>
        <div style={{ padding: '12px 24px 28px' }}><Btn full size="lg" onClick={onDone} iconRight={<I.arrowR size={20} />}>Go to dashboard</Btn></div>
      </div>
    );
  }

  // running
  const subj = SUBJECTS[cur.subject];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ padding: '10px 20px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <SubjectChip subject={cur.subject} size="sm" />
        <div style={{ flex: 1 }}><Bar value={qi + 1} max={Q.length} h={6} color={subj.color} /></div>
        <Mono style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{qi + 1}/{Q.length}</Mono>
      </div>
      <div key={qi} className="spz-fade-up" style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Question {qi + 1}</div>
        <h2 style={{ margin: '0 0 28px', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35, textWrap: 'pretty' }}>{cur.q}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cur.options.map((o, i) => {
            const on = picked === i;
            return (
              <button key={i} onClick={() => setPicked(i)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                background: on ? 'var(--primary-soft)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, transition: 'all .15s',
              }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'var(--on-brand)' : 'var(--text-muted)' }}>{String.fromCharCode(65 + i)}</div>
                <span style={{ fontSize: 15.5, fontWeight: 500, color: 'var(--text)' }}>{o}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: '12px 24px 28px' }}>
        <Btn full size="lg" disabled={picked === null} onClick={submit} iconRight={<I.arrowR size={20} />}>{qi < Q.length - 1 ? 'Next question' : 'Submit'}</Btn>
      </div>
    </div>
  );
}
Object.assign(window, { DiagnosticScreen });
