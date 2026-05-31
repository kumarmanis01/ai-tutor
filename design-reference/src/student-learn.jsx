/* ============================================================
   SPINZY — S5 Learning Path · S6 Progress · S7 Revisions
   ============================================================ */

/* ============ S5 — LEARNING PATH (timeline) ============ */
function PathScreen({ scenario = 'default', onNav }) {
  const [filter, setFilter] = useState('all');
  if (scenario === 'loading') return <ListLoading title="Learning path" />;
  if (scenario === 'empty') return (
    <ScreenWrap title="Learning path">
      <EmptyState icon="path" title="Your path is being built" body="Finish your diagnostic and Vidya will map a personalised concept timeline for you." action="Start diagnostic" onAction={() => onNav('diagnostic')} />
    </ScreenWrap>
  );

  const subjFilters = [{ id: 'all', label: 'All' }, ...Object.values(SUBJECTS).filter(s => CONCEPTS.some(c => c.subject === s.id)).map(s => ({ id: s.id, label: s.short }))];
  const items = filter === 'all' ? CONCEPTS : CONCEPTS.filter(c => c.subject === filter);
  const nextIncomplete = items.find(c => c.status !== 'COMPLETED');

  return (
    <ScreenWrap title="Learning path" right={<button onClick={() => nextIncomplete && onNav('lesson')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}><I.target size={15} /> Jump to next</button>}>
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 7, overflowX: 'auto' }}>
        {subjFilters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ ...chipBtn(filter === f.id), height: 34, fontSize: 13, flexShrink: 0 }}>{f.label}</button>
        ))}
      </div>
      <div style={{ padding: '0 16px 24px', position: 'relative' }}>
        {/* timeline rail */}
        <div style={{ position: 'absolute', left: 35, top: 8, bottom: 30, width: 2, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((c, i) => <TimelineItem key={c.id} c={c} isNext={c.id === (nextIncomplete?.id)} onClick={() => onNav('lesson')} />)}
        </div>
      </div>
    </ScreenWrap>
  );
}
function TimelineItem({ c, isNext, onClick }) {
  const s = SUBJECTS[c.subject];
  const dot = { COMPLETED: 'var(--tier-strong)', IN_PROGRESS: 'var(--primary)', UPCOMING: 'var(--border-strong)' }[c.status];
  const statusPill = {
    COMPLETED: { l: 'Completed', c: 'var(--tier-strong)', b: 'var(--tier-strong-soft)' },
    IN_PROGRESS: { l: 'In progress', c: 'var(--primary)', b: 'var(--primary-soft)' },
    UPCOMING: { l: 'Upcoming', c: 'var(--text-faint)', b: 'var(--surface-2)' },
  }[c.status];
  return (
    <div style={{ display: 'flex', gap: 14, position: 'relative', zIndex: 1 }}>
      <div style={{ flexShrink: 0, width: 38, display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
        <div style={{ width: c.status === 'COMPLETED' ? 24 : 18, height: c.status === 'COMPLETED' ? 24 : 18, borderRadius: 99, background: c.status === 'UPCOMING' ? 'var(--surface)' : dot, border: `3px solid ${c.status === 'UPCOMING' ? 'var(--border-strong)' : dot}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{c.status === 'COMPLETED' && <I.check size={13} stroke={3.5} />}</div>
      </div>
      <div onClick={onClick} style={{ flex: 1, cursor: 'pointer', padding: 14, borderRadius: 16, background: 'var(--surface)', border: `1.5px solid ${isNext ? 'var(--primary)' : 'var(--border)'}`, boxShadow: isNext ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center' }}>
          <SubjectChip subject={c.subject} size="sm" />
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: statusPill.b, color: statusPill.c, whiteSpace: 'nowrap' }}>{statusPill.l}</span>
          {isNext && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next →</span>}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)', textWrap: 'pretty' }}>{c.name}</div>
        {c.status === 'IN_PROGRESS' && <div style={{ marginTop: 10 }}><Bar value={c.mastery} h={6} /></div>}
      </div>
    </div>
  );
}

/* ============ S6 — PROGRESS REPORT ============ */
function ProgressScreen({ scenario = 'default', onNav }) {
  const [range, setRange] = useState('7');
  if (scenario === 'loading') return <ListLoading title="Progress" />;
  if (scenario === 'empty') return (
    <ScreenWrap title="Progress">
      <EmptyState icon="progress" title="No sessions yet" body="Once you complete your first session with Vidya, your progress and trends will appear here." action="Start learning" onAction={() => onNav('tutor')} />
    </ScreenWrap>
  );

  const trend7 = [40, 44, 42, 50, 55, 58, 62];
  const trend30 = [28, 32, 30, 38, 42, 40, 48, 52, 50, 58, 62];
  const data = range === '7' ? trend7 : trend30;

  return (
    <ScreenWrap title="Progress" right={<button onClick={() => onNav('export')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}><I.download size={15} /> Export</button>}>
      <div style={{ padding: '0 16px 24px' }}>
        {/* trend chart */}
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>Overall trend</div><div style={{ fontSize: 12, color: 'var(--tier-strong)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><I.trend size={14} /> Improving steadily</div></div>
            <Segmented options={[{ id: '7', label: '7d' }, { id: '30', label: '30d' }]} value={range} onChange={setRange} />
          </div>
          <TrendChart data={data} />
        </Card>

        {/* per-subject breakdown */}
        <SectionTitle>By subject</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {READINESS.map(r => <SubjectProgressRow key={r.subject} r={r} />)}
        </div>
      </div>
    </ScreenWrap>
  );
}
function TrendChart({ data }) {
  const w = 320, h = 110, pad = 6;
  const max = 100, min = 0;
  const pts = data.map((v, i) => [pad + i * (w - pad * 2) / (data.length - 1), h - pad - (v - min) / (max - min) * (h - pad * 2)]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length-1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs><linearGradient id="trendgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
      {[0.25,0.5,0.75].map(g => <line key={g} x1="0" y1={h*g} x2={w} y2={h*g} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />)}
      <path d={area} fill="url(#trendgrad)" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i === pts.length - 1 && <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2.5" />)}
    </svg>
  );
}
function SubjectProgressRow({ r }) {
  const s = SUBJECTS[r.subject];
  const subjConcepts = CONCEPTS.filter(c => c.subject === r.subject);
  const [open, setOpen] = useState(false);
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, cursor: 'pointer' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: `color-mix(in oklch, ${s.color} 16%, transparent)`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{s.abbr}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subjConcepts.length} concepts</div></div>
        <TierPill tier={r.tier} size="sm" />
        <I.chevDown size={18} style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>
      {open && (
        <div className="spz-fade-up" style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)' }}>
          {subjConcepts.map(c => (
            <div key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, paddingRight: 10 }}>{c.name}</span>
                <Mono style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{c.mastery}%</Mono>
              </div>
              <Bar value={c.mastery} h={6} color={s.color} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============ S7 — SPACED REPETITION / REVISIONS ============ */
function ReviseScreen({ scenario = 'default', onNav }) {
  const [tab, setTab] = useState('due');
  const [snoozed, setSnoozed] = useState([]);
  const due = REVISIONS_DUE.filter(r => !snoozed.includes(r.id));
  const empty = scenario === 'empty';

  return (
    <ScreenWrap title="Revisions" sub="Spaced repetition keeps it stuck">
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented full options={[{ id: 'due', label: `Due Today${empty ? '' : ` · ${due.length}`}` }, { id: 'upcoming', label: 'Upcoming' }]} value={tab} onChange={setTab} />
      </div>
      <div style={{ padding: '0 16px 24px' }}>
        {tab === 'due' ? (
          (empty || due.length === 0) ? (
            <EmptyState icon="checkCircle" title="You’re all caught up" body="No revisions due today. Come back tomorrow to keep your memory sharp." action="Browse learning path" onAction={() => onNav('path')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {due.map(r => <RevisionCard key={r.id} r={r} onSnooze={() => setSnoozed(s => [...s, r.id])} onStart={() => onNav('lesson')} />)}
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REVISIONS_UPCOMING.map(r => <RevisionCard key={r.id} r={r} upcoming />)}
          </div>
        )}
      </div>
    </ScreenWrap>
  );
}
function RevisionCard({ r, onSnooze, onStart, upcoming }) {
  const s = SUBJECTS[r.subject];
  const strengthColor = r.strength < 0.4 ? 'var(--tier-critical)' : r.strength < 0.7 ? 'var(--tier-weak)' : 'var(--tier-strong)';
  return (
    <Card pad={14}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 7 }}><SubjectChip subject={r.subject} size="sm" /></div>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 10, textWrap: 'pretty' }}>{r.concept}</div>
          {/* memory strength */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Memory</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0,1,2,3,4].map(i => <div key={i} style={{ width: 14, height: 6, borderRadius: 3, background: i < Math.round(r.strength * 5) ? strengthColor : 'var(--surface-3)' }} />)}
            </div>
            {upcoming && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{r.due}</span>}
          </div>
        </div>
      </div>
      {!upcoming && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn size="sm" full onClick={onStart} icon={<I.refresh size={16} />}>Revise now</Btn>
          <Btn size="sm" variant="secondary" onClick={onSnooze} icon={<I.snooze size={16} />}>Snooze</Btn>
        </div>
      )}
    </Card>
  );
}

/* ---- shared screen scaffolding ---- */
function ScreenWrap({ title, sub, right, children }) {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)', paddingBottom: 100 }}>
      <div style={{ padding: '8px 16px 12px' }}>
        <AppHeader title={title} sub={sub} right={right} large />
      </div>
      {children}
    </div>
  );
}
function ListLoading({ title }) {
  return (
    <div style={{ height: '100%', background: 'var(--bg)', paddingBottom: 100 }}>
      <div style={{ padding: '14px 20px 18px' }}><Skel w={140} h={24} /></div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>{[0,1,2,3].map(i => <SkeletonCard key={i} />)}</div>
    </div>
  );
}
Object.assign(window, { PathScreen, ProgressScreen, ReviseScreen, ScreenWrap, ListLoading, TrendChart });
