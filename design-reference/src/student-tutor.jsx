/* ============================================================
   SPINZY — S4 AI TUTOR (VIDYA) — streaming chat
   states: default | loading | complete
   ============================================================ */
function TutorScreen({ scenario = 'default', onNav }) {
  const [msgs, setMsgs] = useState([]);
  const [phase, setPhase] = useState(scenario === 'loading' ? 'loading' : (scenario === 'complete' ? 'complete' : 'idle'));
  const [streamText, setStreamText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [showMiscon, setShowMiscon] = useState(false);
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState(scenario === 'complete' ? 100 : 35);
  const [rating, setRating] = useState(0);
  const scrollRef = useRef(null);

  // seed
  useEffect(() => {
    if (scenario === 'complete') {
      setMsgs([
        { role: 'user', text: 'Can you explain the nature of roots?' },
        { role: 'vidya', text: VIDYA_STREAM },
        { role: 'user', text: 'For x² − 6x + 9, D = 36 − 36 = 0 → equal roots!' },
        { role: 'vidya', text: 'Exactly right, Aarav! 🎉 D = 0 means two equal real roots. You’ve got this concept locked. Let’s wrap up here.' },
      ]);
      return;
    }
    if (scenario === 'loading') {
      setMsgs([{ role: 'user', text: 'Can you explain the nature of roots?' }]);
      const t = setTimeout(() => { setPhase('idle'); startStream(VIDYA_STREAM, true); }, 1800);
      return () => clearTimeout(t);
    }
    // default: greet then stream first response
    setMsgs([{ role: 'user', text: 'Can you explain the nature of roots?' }]);
    const t = setTimeout(() => startStream(VIDYA_STREAM, true), 700);
    return () => clearTimeout(t);
  }, []);

  const startStream = (full, showMis) => {
    setStreaming(true); setStreamText('');
    let i = 0;
    const step = Math.max(2, Math.round(full.length / 90));
    const iv = setInterval(() => {
      i += step;
      setStreamText(full.slice(0, i));
      scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
      if (i >= full.length) {
        clearInterval(iv);
        setStreaming(false);
        setMsgs(m => [...m, { role: 'vidya', text: full }]);
        setStreamText('');
        if (showMis) setTimeout(() => setShowMiscon(true), 500);
      }
    }, 45);
  };

  const send = () => {
    if (!input.trim() || streaming) return;
    const txt = input.trim();
    setMsgs(m => [...m, { role: 'user', text: txt }]);
    setInput(''); setShowMiscon(false);
    setProgress(p => Math.min(95, p + 20));
    setTimeout(() => startStream('Good thinking! For x² − 6x + 9, the discriminant D = (−6)² − 4·1·9 = 36 − 36 = 0. A zero discriminant means the equation has two equal real roots — here both are x = 3. You nailed the pattern. 👏', false), 600);
  };

  const endSession = () => { setPhase('complete'); setProgress(100); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* persistent header */}
      <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => onNav('home')} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}><I.chevL size={19} /></button>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><I.sparkle size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>Vidya</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>{VIDYA_CONCEPT.name}</div>
          </div>
          <SubjectChip subject={VIDYA_CONCEPT.subject} size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Bar value={progress} h={5} />
          <Mono style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>session {progress}%</Mono>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
        {phase === 'loading' && <Bubble role="vidya" loading />}
        {streaming && <Bubble role="vidya" text={streamText} streaming />}

        {/* misconception card — appears contextually */}
        {showMiscon && !streaming && (
          <div className="spz-fade-up" style={{ borderRadius: 16, padding: 14, background: 'var(--tier-weak-soft)', border: '1px solid color-mix(in oklch, var(--tier-weak) 30%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: 'var(--tier-weak)' }}><I.alert size={17} /><span style={{ fontSize: 12.5, fontWeight: 700 }}>Common mix-up</span></div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, textWrap: 'pretty' }}>Many students confuse <b>D = 0</b> (equal roots) with <b>D &lt; 0</b> (no real roots). Watch the sign carefully!</div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="spz-fade-up" style={{ borderRadius: 18, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><I.checkCircle size={28} /></div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>Session complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 8 }}>+45 XP · Concept mastery improved</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>How was this session?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s <= rating ? 'var(--tier-fair)' : 'var(--border-strong)', padding: 0 }}><I.star size={28} fill={s <= rating ? 'var(--tier-fair)' : 'none'} /></button>
              ))}
            </div>
            <Btn full onClick={() => onNav('home')} iconRight={<I.arrowR size={18} />}>Back to dashboard</Btn>
          </div>
        )}
      </div>

      {/* hint bar + composer */}
      {phase !== 'complete' && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 24 }}>
          {/* hint bar (collapsed by default) */}
          <button onClick={() => setHintOpen(!hintOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'var(--font-sans)' }}>
            <I.bulb size={17} /><span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Need a hint?</span>
            <I.chevDown size={17} style={{ transform: hintOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {hintOpen && (
            <div className="spz-fade-up" style={{ padding: '0 16px 12px' }}>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--primary-soft)', fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>The discriminant is the part <b>under the square root</b> in the quadratic formula: <Mono style={{ background: 'var(--surface)', padding: '1px 6px', borderRadius: 6 }}>b² − 4ac</Mono></div>
            </div>
          )}
          {/* composer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 8px' }}>
            <button onClick={() => onNav('whiteboard')} title="Whiteboard" style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><I.whiteboard size={21} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 22, padding: '0 6px 0 16px' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Vidya anything…" style={{ flex: 1, height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text)' }} />
              <button onClick={send} disabled={!input.trim() || streaming} style={{ width: 34, height: 34, borderRadius: 11, background: input.trim() && !streaming ? 'var(--primary)' : 'var(--surface-3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: input.trim() && !streaming ? 'var(--on-brand)' : 'var(--text-faint)', flexShrink: 0 }}><I.send size={17} /></button>
            </div>
          </div>
          {!streaming && phase !== 'loading' && (
            <div style={{ textAlign: 'center', paddingBottom: 4 }}>
              <button onClick={endSession} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>End session</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({ role, text, loading, streaming }) {
  const isUser = role === 'user';
  return (
    <div className="spz-fade-up" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', padding: '11px 14px', borderRadius: 18,
        borderBottomRightRadius: isUser ? 5 : 18, borderBottomLeftRadius: isUser ? 18 : 5,
        background: isUser ? 'var(--primary)' : 'var(--surface)',
        color: isUser ? 'var(--on-brand)' : 'var(--text)',
        border: isUser ? 'none' : '1px solid var(--border)', boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
        fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', textWrap: 'pretty',
      }}>
        {loading ? <TypingDots /> : text}{streaming && <span style={{ display: 'inline-block', width: 7, height: 15, background: 'var(--primary)', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1, animation: 'spz-pulse 0.9s infinite' }} />}
      </div>
    </div>
  );
}
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '3px 2px' }}>
      {[0,1,2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--text-faint)', animation: `spz-dot 1.2s ${i*0.15}s infinite` }} />)}
    </div>
  );
}

/* simple whiteboard overlay screen */
function WhiteboardScreen({ onNav }) {
  return (
    <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Whiteboard" sub="Sketch your working" back onBack={() => onNav('tutor')} />
      <div style={{ flex: 1, margin: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text-faint)' }}>
          <I.pencil size={32} /><Mono style={{ fontSize: 12 }}>draw your steps here</Mono>
        </div>
      </div>
      <div style={{ padding: '0 16px 28px', display: 'flex', gap: 10 }}>
        <Btn variant="secondary" full icon={<I.x size={18} />} onClick={() => onNav('tutor')}>Clear</Btn>
        <Btn full icon={<I.check size={18} />} onClick={() => onNav('tutor')}>Done</Btn>
      </div>
    </div>
  );
}
Object.assign(window, { TutorScreen, Bubble, WhiteboardScreen });
