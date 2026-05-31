/* ============================================================
   SPINZY — S8 Chapter Tests + Mock Exams
   states: default | running | results | loading
   ============================================================ */
function TestsScreen({ scenario = 'default', onNav }) {
  const [tab, setTab] = useState('recommended');
  const [mode, setMode] = useState(scenario === 'running' ? 'running' : scenario === 'results' ? 'results' : 'list');
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [time, setTime] = useState(1200);

  // timer
  useEffect(() => {
    if (mode !== 'running') return;
    const t = setInterval(() => setTime(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode]);

  if (scenario === 'loading') return <ListLoading title="Tests" />;

  // ---- TEST RUNNER ----
  if (mode === 'running') {
    const Q = TEST_RUNNER_Q;
    const cur = Q[qi];
    const mm = String(Math.floor(time / 60)).padStart(2, '0'), ss = String(time % 60).padStart(2, '0');
    const submit = () => {
      const a = [...answers, picked]; setAnswers(a); setPicked(null);
      if (qi < Q.length - 1) setQi(qi + 1); else setMode('results');
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        <div style={{ padding: '8px 16px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <button onClick={() => setMode('list')} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}><I.x size={18} /></button>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Quadratic Equations</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 99, background: time < 120 ? 'var(--tier-critical-soft)' : 'var(--surface-2)', color: time < 120 ? 'var(--tier-critical)' : 'var(--text)', border: '1px solid var(--border)' }}><I.clock size={15} /><Mono style={{ fontSize: 13, fontWeight: 600 }}>{mm}:{ss}</Mono></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bar value={qi + 1} max={Q.length} h={5} /><Mono style={{ fontSize: 11, color: 'var(--text-faint)' }}>{qi + 1}/{Q.length}</Mono></div>
        </div>
        <div key={qi} className="spz-fade-up" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Question {qi + 1}</div>
          <h2 style={{ margin: '0 0 26px', fontSize: 20, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em', textWrap: 'pretty' }}>{cur.q}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cur.options.map((o, i) => {
              const on = picked === i;
              return <button key={i} onClick={() => setPicked(i)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', background: on ? 'var(--primary-soft)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}` }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'var(--on-brand)' : 'var(--text-muted)' }}>{String.fromCharCode(65 + i)}</div>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{o}</span>
              </button>;
            })}
          </div>
        </div>
        <div style={{ padding: '12px 24px 28px' }}><Btn full size="lg" disabled={picked === null} onClick={submit} iconRight={<I.arrowR size={20} />}>{qi < Q.length - 1 ? 'Next' : 'Submit test'}</Btn></div>
      </div>
    );
  }

  // ---- RESULTS ----
  if (mode === 'results') {
    return (
      <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
        <div style={{ padding: 24 }}>
          <div className="spz-fade-up" style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px' }}>
              <Ring tier="ontrack" size={130} stroke={10}><div style={{ textAlign: 'center' }}><Mono style={{ fontSize: 34, fontWeight: 700, color: 'var(--text)' }}>11<span style={{ fontSize: 18, color: 'var(--text-faint)' }}>/15</span></Mono></div></Ring>
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em' }}>Solid work, Aarav!</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>You’re on track with Quadratic Equations</p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <Card pad={14} style={{ flex: 1, textAlign: 'center' }}><div style={{ color: 'var(--primary)', marginBottom: 4 }}><I.bolt size={22} style={{ display: 'inline' }} /></div><Mono style={{ fontSize: 22, fontWeight: 700 }}>+150</Mono><div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>XP earned</div></Card>
            <Card pad={14} style={{ flex: 1, textAlign: 'center' }}><div style={{ color: 'var(--tier-strong)', marginBottom: 4 }}><I.target size={22} style={{ display: 'inline' }} /></div><Mono style={{ fontSize: 22, fontWeight: 700 }}>73%</Mono><div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>accuracy</div></Card>
          </div>
          <SectionTitle>Weak areas flagged</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[['Discriminant sign errors', 'weak'], ['Word problems → equations', 'fair']].map(([t, tier]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--tier-weak)' }}><I.alert size={18} /></div>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t}</span>
                <TierPill tier={tier} size="sm" />
              </div>
            ))}
          </div>
          <Btn full size="lg" onClick={() => onNav('tutor')} icon={<I.sparkle size={18} />}>Practice weak areas with Vidya</Btn>
          <div style={{ textAlign: 'center', marginTop: 12 }}><button onClick={() => setMode('list')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Back to tests</button></div>
        </div>
      </div>
    );
  }

  // ---- LIST ----
  const tabs = [{ id: 'recommended', label: 'Recommended' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'history', label: 'History' }];
  return (
    <ScreenWrap title="Tests & Mocks">
      {/* mock exam hero */}
      <div style={{ padding: '0 16px 14px' }}>
        <div onClick={() => setMode('running')} style={{ cursor: 'pointer', borderRadius: 20, padding: 18, background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-brand)' }}>
          <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15 }}><I.board size={120} /></div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 99, marginBottom: 10, whiteSpace: 'nowrap' }}><I.board size={13} /> Full mock</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>CBSE Class 10 — Maths Mock</div>
            <div style={{ fontSize: 13, opacity: 0.88, marginBottom: 14 }}>Section-based · 80 marks · 3 hours</div>
            <Btn onClick={() => setMode('running')} style={{ background: '#fff', color: 'var(--brand-700)' }} icon={<I.play size={17} />}>Start mock exam</Btn>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px 12px' }}><Segmented full options={tabs} value={tab} onChange={setTab} /></div>
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'recommended' && TESTS_RECOMMENDED.map(t => <TestCard key={t.id} t={t} onStart={() => setMode('running')} />)}
        {tab === 'upcoming' && TESTS_UPCOMING.map(t => <TestCard key={t.id} t={t} locked />)}
        {tab === 'history' && TESTS_HISTORY.map(t => <TestHistoryCard key={t.id} t={t} onView={() => setMode('results')} />)}
        {tab === 'upcoming' && TESTS_UPCOMING.length === 0 && <EmptyState icon="tests" title="Nothing scheduled" body="Upcoming tests unlock as you progress through your learning path." />}
      </div>
    </ScreenWrap>
  );
}
function TestCard({ t, onStart, locked }) {
  return (
    <Card pad={14} onClick={locked ? undefined : onStart}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><SubjectChip subject={t.subject} size="sm" /><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}><I.doc size={13} /> {t.q} Q</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}><I.clock size={13} /> {t.mins} min</span></div>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, textWrap: 'pretty' }}>{t.name}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: locked ? 0 : 14 }}>{t.reason || t.date}</div>
      {!locked ? <Btn size="sm" full onClick={onStart} iconRight={<I.arrowR size={16} />}>Start test</Btn>
        : <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, color: 'var(--text-faint)', fontSize: 12.5, fontWeight: 600 }}><I.lock size={15} /> {t.date}</div>}
    </Card>
  );
}
function TestHistoryCard({ t, onView }) {
  return (
    <Card pad={14} onClick={onView} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Ring tier={t.tier} size={50} stroke={5}><Mono style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(t.score/t.total*100)}<span style={{ fontSize: 9 }}>%</span></Mono></Ring>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 5 }}><SubjectChip subject={t.subject} size="sm" /></div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' }}>{t.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}><Mono>{t.score}/{t.total}</Mono> · +{t.xp} XP · {t.date}</div>
      </div>
      <I.chevR size={18} style={{ color: 'var(--text-faint)' }} />
    </Card>
  );
}
Object.assign(window, { TestsScreen, TestCard, TestHistoryCard });
