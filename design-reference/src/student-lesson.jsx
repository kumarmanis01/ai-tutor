/* ============================================================
   SPINZY — S4 LEARNING SESSION (pre-generated lesson)
   Structured notes + questions for Board/Grade/Subject.
   "Ask Vidya" chat is a provision INSIDE the lesson.
   Missing pre-gen content → falls back to pure chat (tutor).
   states: default | question | no-content | complete | loading
   ============================================================ */
function LessonScreen({ scenario = 'default', onNav }) {
  const L = LESSON;
  const startAt = scenario === 'question' ? L.steps.findIndex(s => s.type === 'question') : 0;
  const [idx, setIdx] = useState(scenario === 'complete' ? L.steps.length - 1 : Math.max(0, startAt));
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  // ---- MISSING CONTENT → bridge to Vidya chat ----
  if (scenario === 'no-content') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <AppHeader title="" back onBack={() => onNav('home')} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <div style={{ width: 80, height: 80, borderRadius: 26, background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 22 }}><I.sparkle size={38} /></div>
          <div style={{ marginBottom: 8 }}><SubjectChip subject={L.subject} size="sm" /></div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', textWrap: 'balance' }}>{L.concept}</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 290, textWrap: 'pretty' }}>A guided lesson isn’t ready for this topic yet — but Vidya can teach it to you live, right now.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, padding: '10px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', alignItems: 'center' }}>
            <I.info size={16} style={{ color: 'var(--text-faint)' }} /><Mono style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>notes + practice · generating</Mono>
          </div>
          <div style={{ width: '100%', maxWidth: 300, marginTop: 26 }}>
            <Btn full size="lg" onClick={() => onNav('tutor')} icon={<I.tutor size={19} />}>Learn with Vidya chat</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (scenario === 'loading') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', padding: 20 }}>
        <Skel w={120} h={14} style={{ marginBottom: 16, marginTop: 8 }} />
        <Skel h={6} r={99} style={{ marginBottom: 24 }} />
        <Skel w="70%" h={22} style={{ marginBottom: 18 }} />
        <Skel h={120} r={16} style={{ marginBottom: 14 }} />
        <Skel h={90} r={16} style={{ marginBottom: 14 }} />
        <Skel w="90%" h={14} style={{ marginBottom: 8 }} /><Skel w="60%" h={14} />
      </div>
    );
  }

  const step = L.steps[idx];
  const total = L.steps.length;
  const isQuestion = step.type === 'question';
  const isLast = idx === total - 1;
  const canAdvance = !isQuestion || revealed;

  const next = () => {
    if (isLast) { onNav('home'); return; }
    setIdx(i => i + 1); setPicked(null); setRevealed(false);
  };
  const back = () => { if (idx === 0) { onNav('home'); return; } setIdx(i => i - 1); setPicked(null); setRevealed(false); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative' }}>
      {/* persistent lesson header */}
      <div style={{ padding: '6px 14px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={back} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', flexShrink: 0 }}><I.chevL size={19} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{L.concept}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><SubjectChip subject={L.subject} size="sm" /><Mono style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{L.board} · Gr {L.grade}</Mono></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {L.steps.map((s, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < idx ? 'var(--primary)' : i === idx ? 'var(--primary)' : 'var(--surface-3)', opacity: i === idx ? 1 : i < idx ? 1 : 0.6, transition: 'all .3s' }} />
          ))}
        </div>
      </div>

      {/* step body */}
      <div ref={null} style={{ flex: 1, overflow: 'auto', padding: '20px 18px 96px' }}>
        <div key={idx} className="spz-fade-up">
          <StepBody step={step} picked={picked} revealed={revealed} setPicked={setPicked} setRevealed={setRevealed} onAsk={() => setAskOpen(true)} />
        </div>
      </div>

      {/* footer nav */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 18px 26px', background: 'color-mix(in oklch, var(--surface) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Ask Vidya — the in-lesson chat provision */}
          <button onClick={() => setAskOpen(true)} title="Ask Vidya about this topic" style={{ width: 50, height: 50, borderRadius: 15, background: 'var(--primary-soft)', border: '1px solid color-mix(in oklch, var(--primary) 30%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', flexShrink: 0, gap: 1 }}>
            <I.tutor size={20} /><span style={{ fontSize: 8, fontWeight: 700 }}>Ask</span>
          </button>
          <Btn full size="lg" disabled={!canAdvance} onClick={next} iconRight={isLast ? <I.check size={19} /> : <I.arrowR size={19} />}>
            {isLast ? 'Finish lesson' : isQuestion ? (revealed ? 'Continue' : 'Check answer first') : 'Continue'}
          </Btn>
        </div>
      </div>

      {/* Ask Vidya bottom sheet */}
      {askOpen && <AskVidyaSheet concept={L.concept} subject={L.subject} onClose={() => setAskOpen(false)} onFullChat={() => onNav('tutor')} />}
    </div>
  );
}

/* ---- step renderers ---- */
function StepBody({ step, picked, revealed, setPicked, setRevealed, onAsk }) {
  if (step.type === 'objective') {
    return (
      <div>
        <StepKicker text="Lesson" icon="target" />
        <h1 style={{ margin: '0 0 18px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, textWrap: 'balance' }}>{step.title}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step.points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.35, textWrap: 'pretty' }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (step.type === 'note') {
    return (
      <div>
        <StepKicker text={step.kind === 'example' ? 'Worked example' : step.kind === 'cases' ? 'Key idea' : 'Notes'} icon={step.kind === 'example' ? 'edit' : 'bulb'} />
        <h2 style={{ margin: '0 0 16px', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{step.title}</h2>
        {step.body && <p style={{ margin: '0 0 16px', fontSize: 15.5, lineHeight: 1.55, color: 'var(--text)', textWrap: 'pretty' }}>{step.body}</p>}
        {step.formula && (
          <div style={{ padding: '18px', borderRadius: 16, background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', textAlign: 'center', marginBottom: 16 }}>
            <Mono style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0' }}>{step.formula}</Mono>
          </div>
        )}
        {step.callout && (
          <div style={{ display: 'flex', gap: 11, padding: 14, borderRadius: 14, background: 'var(--primary-soft)' }}>
            <I.bulb size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}>{step.callout}</span>
          </div>
        )}
        {step.cases && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {step.cases.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 15, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${TIERS[c.tier].color}` }}>
                <Mono style={{ fontSize: 17, fontWeight: 700, color: TIERS[c.tier].color, width: 56, flexShrink: 0 }}>{c.sym}</Mono>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.label}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.note}</div></div>
              </div>
            ))}
          </div>
        )}
        {step.example && (
          <div>
            <div style={{ padding: 15, borderRadius: 14, background: 'var(--surface-2)', marginBottom: 16, fontSize: 15.5, fontWeight: 600 }}><Mono>{step.example}</Mono></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {step.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'baseline' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--primary)', flexShrink: 0, transform: 'translateY(-2px)' }} />
                  <Mono style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--text)' }}>{s}</Mono>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, background: 'var(--tier-strong-soft)' }}>
              <I.checkCircle size={20} style={{ color: 'var(--tier-strong)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{step.answer}</span>
            </div>
          </div>
        )}
        <button onClick={onAsk} style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', borderRadius: 12, background: 'transparent', border: '1px dashed var(--border-strong)', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>
          <I.tutor size={17} /> Confused? Ask Vidya about this
        </button>
      </div>
    );
  }
  if (step.type === 'question') {
    return (
      <div>
        <StepKicker text="Quick check" icon="target" />
        <h2 style={{ margin: '0 0 22px', fontSize: 19, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.01em', textWrap: 'pretty' }}>{step.q}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {step.options.map((o, i) => {
            const isPick = picked === i;
            const isCorrect = i === step.correct;
            let bg = 'var(--surface)', bd = 'var(--border)', badge = null;
            if (revealed) {
              if (isCorrect) { bg = 'var(--tier-strong-soft)'; bd = 'var(--tier-strong)'; }
              else if (isPick) { bg = 'var(--tier-critical-soft)'; bd = 'var(--tier-critical)'; }
            } else if (isPick) { bg = 'var(--primary-soft)'; bd = 'var(--primary)'; }
            return (
              <button key={i} disabled={revealed} onClick={() => setPicked(i)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', borderRadius: 15, cursor: revealed ? 'default' : 'pointer', textAlign: 'left', background: bg, border: `1.5px solid ${bd}`, transition: 'all .15s' }}>
                <div style={{ width: 27, height: 27, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, background: isPick && !revealed ? 'var(--primary)' : revealed && isCorrect ? 'var(--tier-strong)' : revealed && isPick ? 'var(--tier-critical)' : 'var(--surface-2)', color: (isPick && !revealed) || (revealed && (isCorrect || isPick)) ? '#fff' : 'var(--text-muted)' }}>{String.fromCharCode(65 + i)}</div>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{o}</span>
                {revealed && isCorrect && <I.check size={19} stroke={3} style={{ color: 'var(--tier-strong)' }} />}
                {revealed && isPick && !isCorrect && <I.x size={18} stroke={3} style={{ color: 'var(--tier-critical)' }} />}
              </button>
            );
          })}
        </div>
        {!revealed ? (
          <div style={{ marginTop: 16 }}><Btn full variant="secondary" disabled={picked === null} onClick={() => setRevealed(true)}>Check answer</Btn></div>
        ) : (
          <div className="spz-fade-up" style={{ marginTop: 16, padding: 14, borderRadius: 14, background: picked === step.correct ? 'var(--tier-strong-soft)' : 'var(--primary-soft)', display: 'flex', gap: 11 }}>
            {React.createElement(picked === step.correct ? I.checkCircle : I.bulb, { size: 20, style: { color: picked === step.correct ? 'var(--tier-strong)' : 'var(--primary)', flexShrink: 0 } })}
            <div><div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{picked === step.correct ? 'Correct!' : 'Not quite'}</div><div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text)', textWrap: 'pretty' }}>{step.explain}</div></div>
          </div>
        )}
      </div>
    );
  }
  if (step.type === 'summary') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <div style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', animation: 'spz-pop 0.5s cubic-bezier(0.22,1.4,0.4,1) both' }}><I.checkCircle size={40} /></div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{step.title}</h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, marginBottom: 24 }}><I.bolt size={16} /> +{step.xp} XP earned</div>
        <div style={{ textAlign: 'left', padding: 16, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Key takeaways</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {step.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <I.check size={17} stroke={3} style={{ color: 'var(--tier-strong)', flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 14, lineHeight: 1.4, textWrap: 'pretty' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return null;
}
function StepKicker({ text, icon }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, whiteSpace: 'nowrap' }}>
      {React.createElement(I[icon] || I.bulb, { size: 15 })}{text}
    </div>
  );
}

/* ---- Ask Vidya bottom sheet (in-lesson chat provision) ---- */
function AskVidyaSheet({ concept, subject, onClose, onFullChat }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const scrollRef = useRef(null);

  const ask = (q) => {
    if (!q.trim() || streaming) return;
    setMsgs(m => [...m, { role: 'user', text: q }]); setInput('');
    const reply = 'Good question! For “' + concept + '”: the discriminant D = b² − 4ac is your shortcut. Its sign alone tells you whether the roots are real & distinct (D>0), real & equal (D=0), or not real (D<0) — no full solving needed. Want a worked example?';
    setStreaming(true); setStreamText('');
    let i = 0; const step = Math.max(2, Math.round(reply.length / 70));
    const iv = setInterval(() => {
      i += step; setStreamText(reply.slice(0, i));
      scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
      if (i >= reply.length) { clearInterval(iv); setStreaming(false); setMsgs(m => [...m, { role: 'vidya', text: reply }]); setStreamText(''); }
    }, 42);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay)', animation: 'spz-fade-up .2s' }} />
      <div className="spz-fade-up" style={{ position: 'relative', height: '78%', background: 'var(--surface)', borderRadius: '26px 26px 0 0', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--border-strong)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><I.sparkle size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>Ask Vidya</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>About: {concept}</div></div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}><I.x size={17} /></button>
          </div>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {msgs.length === 0 && (
            <div style={{ paddingTop: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>Ask anything about this topic, or try:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LESSON_SUGGESTED_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => ask(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                    <I.sparkle size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />{p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
          {streaming && <Bubble role="vidya" text={streamText} streaming />}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 22, padding: '0 6px 0 16px' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask(input)} placeholder="Ask about this topic…" style={{ flex: 1, height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text)' }} />
            <button onClick={() => ask(input)} disabled={!input.trim() || streaming} style={{ width: 34, height: 34, borderRadius: 11, background: input.trim() && !streaming ? 'var(--primary)' : 'var(--surface-3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: input.trim() && !streaming ? 'var(--on-brand)' : 'var(--text-faint)', flexShrink: 0 }}><I.send size={16} /></button>
          </div>
          <button onClick={onFullChat} style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', paddingTop: 8 }}>Open full Vidya session →</button>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { LessonScreen, StepBody, AskVidyaSheet });
