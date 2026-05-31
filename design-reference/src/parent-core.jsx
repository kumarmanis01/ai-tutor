/* ============================================================
   SPINZY — PARENT P1 Onboarding · P2 Dashboard · P3 Child Detail
   Parent uses TOP nav (not bottom tabs).
   ============================================================ */

/* ---- Parent top nav ---- */
function ParentTopNav({ active, onNav }) {
  const tabs = [
    { id: 'p-dash', icon: 'home', label: 'Home' },
    { id: 'p-progress', icon: 'progress', label: 'Progress' },
    { id: 'p-billing', icon: 'card', label: 'Billing' },
    { id: 'p-settings', icon: 'gear', label: 'Settings' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 12px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onNav(t.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
            <div style={{ color: on ? 'var(--primary)' : 'var(--text-faint)' }}>{React.createElement(I[t.icon], { size: 21, stroke: on ? 2.2 : 1.9 })}</div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? 'var(--primary)' : 'var(--text-faint)' }}>{t.label}</span>
            {on && <div style={{ position: 'absolute', bottom: -10, left: '25%', right: '25%', height: 3, borderRadius: 99, background: 'var(--primary)' }} />}
          </button>
        );
      })}
    </div>
  );
}
function ParentShell({ active, onNav, title, sub, right, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)' }}>
        <div style={{ padding: '8px 20px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><I.grad size={17} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</div>{sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}</div>
          {right}
        </div>
        <ParentTopNav active={active} onNav={onNav} />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  );
}

/* ============ P1 — PARENT ONBOARDING (auth → link child) ============ */
function ParentOnboardingScreen({ onNav }) {
  const [authed, setAuthed] = useState(false);
  const [linkMode, setLinkMode] = useState(null);

  if (!authed) return <AuthScreen role="parent" onAuthed={() => setAuthed(true)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 24 }}><I.grad size={24} /></div>
      </div>
      <div className="spz-fade-up" style={{ flex: 1, padding: '0 24px', overflow: 'auto' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>Connect your child</h1>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.45, textWrap: 'pretty' }}>Link an existing account, or create one for your child.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[{ id: 'link', icon: 'link', t: 'Link existing account', s: 'By child’s email or invite code' }, { id: 'create', icon: 'plus', t: 'Create a child account', s: 'Set up a fresh profile' }].map(o => {
            const on = linkMode === o.id;
            return (
              <button key={o.id} onClick={() => setLinkMode(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, cursor: 'pointer', textAlign: 'left', background: on ? 'var(--primary-soft)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}` }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: on ? 'var(--primary)' : 'var(--surface-2)', color: on ? 'var(--on-brand)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.createElement(I[o.icon], { size: 21 })}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{o.t}</div><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{o.s}</div></div>
                {on && <I.check size={20} stroke={3} style={{ color: 'var(--primary)' }} />}
              </button>
            );
          })}
        </div>
        {linkMode === 'link' && <div className="spz-fade-up" style={{ marginTop: 16 }}><FieldLabel>Child’s email</FieldLabel><FauxInput value="" placeholder="aarav@email.com" onType={() => {}} /><div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><I.shield size={13} /> Your child confirms the link from their app — DPDP-compliant.</div></div>}
        {linkMode === 'create' && <div className="spz-fade-up" style={{ marginTop: 16 }}><Note icon="info" text="You’ll set up your child’s name, board and grade next. They can claim the account later with their own email." /></div>}
      </div>
      <div style={{ padding: '12px 24px 28px' }}>
        <Btn full size="lg" disabled={!linkMode} onClick={() => onNav('p-dash')} iconRight={<I.arrowR size={20} />}>Continue to dashboard</Btn>
      </div>
    </div>
  );
}

/* ============ P2 — PARENT DASHBOARD (multi-child) ============ */
function ParentDashboardScreen({ scenario = 'default', onNav }) {
  if (scenario === 'loading') return <ParentShell active="p-dash" onNav={onNav} title="Spinzy" sub="Parent"><div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{[0,1].map(i => <SkeletonCard key={i} />)}</div></ParentShell>;
  if (scenario === 'empty') return (
    <ParentShell active="p-dash" onNav={onNav} title="Spinzy" sub="Parent">
      <EmptyState icon="users" title="No children linked yet" body="Connect your child’s account to follow their exam-prep journey." action="Link a child" onAction={() => onNav('p-onboarding')} />
    </ParentShell>
  );

  const allAlerts = CHILDREN.flatMap(c => c.alerts.map(a => ({ ...a, child: c.name })));
  return (
    <ParentShell active="p-dash" onNav={onNav} title="Spinzy" sub="Parent" right={<Avatar letter="M" hue={320} size={38} />}>
      <div style={{ padding: '14px 16px 24px' }}>
        {/* attention bar */}
        {allAlerts.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, color: 'var(--tier-weak)' }}><I.bell size={17} /><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Needs your attention</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allAlerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 13, background: a.type === 'warn' ? 'var(--tier-weak-soft)' : 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div style={{ color: a.type === 'warn' ? 'var(--tier-weak)' : 'var(--text-faint)' }}>{React.createElement(a.type === 'warn' ? I.alert : I.info, { size: 17 })}</div>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}><b>{a.child}:</b> {a.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* child summary cards */}
        <SectionTitle>Your children</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CHILDREN.map(c => <ChildCard key={c.id} c={c} onView={() => onNav('p-progress')} />)}
        </div>
        <button onClick={() => onNav('p-onboarding')} style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 14, background: 'transparent', border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}><I.plus size={18} /> Add another child</button>
      </div>
    </ParentShell>
  );
}
function ChildCard({ c, onView }) {
  return (
    <Card pad={16} onClick={onView}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Avatar letter={c.avatar} hue={c.hue} size={48} ring />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Class {c.grade} · {c.board} · Active {c.lastActive}</div>
        </div>
        <TierPill tier={c.overallTier} size="sm" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <ChildStat icon="flame" value={c.streak} label="streak" color="var(--tier-weak)" />
        <ChildStat icon="calendar" value={c.examDays} label="days to exam" color="var(--tier-ontrack)" />
        <ChildStat icon="grad" value={c.subjects.length} label="subjects" color="var(--primary)" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>View full progress</span>
        <I.chevR size={17} style={{ color: 'var(--primary)' }} />
      </div>
    </Card>
  );
}
function ChildStat({ icon, value, label, color }) {
  return (
    <div style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--surface-2)', textAlign: 'center' }}>
      <div style={{ color, display: 'flex', justifyContent: 'center', marginBottom: 3 }}>{React.createElement(I[icon], { size: 17 })}</div>
      <Mono style={{ fontSize: 17, fontWeight: 700 }}>{value}</Mono>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ============ P3 — CHILD PROGRESS DETAIL (radar + heatmap) ============ */
function ChildProgressScreen({ scenario = 'default', onNav }) {
  const c = CHILDREN[0];
  if (scenario === 'empty') return (
    <ParentShell active="p-progress" onNav={onNav} title={c.name} sub={`Class ${c.grade} · ${c.board}`}>
      <EmptyState icon="target" title="No diagnostic yet" body={`${c.name} hasn’t completed the diagnostic assessment. Progress insights appear once they do.`} />
    </ParentShell>
  );
  return (
    <ParentShell active="p-progress" onNav={onNav} title={c.name} sub={`Class ${c.grade} · ${c.board}`} right={<Avatar letter={c.avatar} hue={c.hue} size={38} />}>
      <div style={{ padding: '14px 16px 24px' }}>
        {/* radar */}
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Subject readiness</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Tier label only — no raw scores</div>
          <RadarChart data={c.subjects} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            {c.subjects.map(s => <div key={s.subject} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: SUBJECTS[s.subject].color }} /><span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{SUBJECTS[s.subject].short}</span></div>)}
          </div>
        </Card>

        {/* weekly activity heatmap */}
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Activity · last 7 weeks</div>
          <Heatmap />
        </Card>

        {/* improvement trend */}
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 700 }}>Improvement trend</div><span style={{ fontSize: 12, color: 'var(--tier-strong)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><I.trend size={14} /> +14% / month</span></div>
          <TrendChart data={[30, 36, 34, 42, 46, 44, 52]} />
        </Card>

        {/* weak topics */}
        <SectionTitle>Weak topics to support</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WEAK_TOPICS.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <SubjectChip subject={w.subject} size="sm" />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, textWrap: 'pretty' }}>{w.concept}</span>
              <TierPill tier={w.tier} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </ParentShell>
  );
}
function RadarChart({ data }) {
  const size = 220, cx = size / 2, cy = size / 2, r = 78;
  const n = data.length;
  const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
  const point = (i, val) => [cx + Math.cos(angle(i)) * r * val, cy + Math.sin(angle(i)) * r * val];
  const poly = data.map((d, i) => point(i, TIERS[d.tier].pct / 100)).map(p => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map(g => (
        <polygon key={g} points={data.map((_, i) => point(i, g).join(',')).join(' ')} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {data.map((_, i) => { const p = point(i, 1); return <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="var(--border)" strokeWidth="1" />; })}
      <polygon points={poly} fill="color-mix(in oklch, var(--primary) 22%, transparent)" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => { const p = point(i, TIERS[d.tier].pct / 100); return <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={SUBJECTS[d.subject].color} stroke="var(--surface)" strokeWidth="2" />; })}
    </svg>
  );
}
function Heatmap() {
  const colors = ['var(--surface-3)', 'color-mix(in oklch, var(--primary) 30%, var(--surface-3))', 'color-mix(in oklch, var(--primary) 55%, transparent)', 'color-mix(in oklch, var(--primary) 78%, transparent)', 'var(--primary)'];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
        {days.map((d, i) => <div key={i} style={{ height: 18, fontSize: 9.5, color: 'var(--text-faint)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>{d}</div>)}
      </div>
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        {ACTIVITY_HEATMAP.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {week.map((lvl, di) => <div key={di} style={{ height: 18, borderRadius: 5, background: colors[lvl] }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
Object.assign(window, { ParentTopNav, ParentShell, ParentOnboardingScreen, ParentDashboardScreen, ChildProgressScreen, RadarChart, Heatmap, ChildCard });
