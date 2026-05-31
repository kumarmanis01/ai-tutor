/* ============================================================
   SPINZY — S3 HOME DASHBOARD
   states: default(free) | premium | crunch | freemium-locked | loading | error
   ============================================================ */
function DashboardScreen({ scenario = 'default', onNav, onStartTopic }) {
  const premium = scenario === 'premium';
  const crunch = scenario === 'crunch';
  const freemiumLocked = scenario === 'freemium';
  const examDays = crunch ? 9 : STUDENT.examDateDays;
  const sessionsRemaining = freemiumLocked ? 0 : STUDENT.sessionsRemaining;

  if (scenario === 'loading') return <DashboardLoading />;
  if (scenario === 'error') return (
    <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 80 }}>
      <ErrorState onRetry={() => onNav && onNav('home')} />
    </div>
  );

  const xpPct = (STUDENT.xp - STUDENT.xpLevelFloor) / (STUDENT.xpToNext - STUDENT.xpLevelFloor) * 100;

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)', paddingBottom: 100 }}>
      {/* greeting header */}
      <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Good evening,</div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{STUDENT.name} 👋</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => onNav && onNav('revise')} style={iconBtn()}><I.bell size={20} /><span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 99, background: 'var(--tier-critical)', border: '2px solid var(--surface)' }} /></button>
          <Avatar letter="A" hue={184} size={40} />
        </div>
      </div>

      {/* ===== CRUNCH MODE — countdown becomes hero ===== */}
      {crunch ? (
        <div style={{ padding: '16px 20px 0' }}>
          <div className="spz-fade-up" style={{ borderRadius: 24, padding: 22, position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg, var(--tier-critical) 0%, oklch(0.52 0.18 15) 100%)', color: '#fff', boxShadow: '0 10px 30px oklch(0.6 0.2 25 / 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.92 }}><I.flame size={17} /> Exam crunch mode</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
              <Mono style={{ fontSize: 64, fontWeight: 700, lineHeight: 0.9 }}>{examDays}</Mono>
              <div><div style={{ fontSize: 18, fontWeight: 700 }}>days left</div><div style={{ fontSize: 13, opacity: 0.85 }}>{STUDENT.examName}</div></div>
            </div>
            <div style={{ marginTop: 18, background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12.5, opacity: 0.9, marginBottom: 4 }}>Today’s priority</div>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 12 }}>{NEXT_TOPIC.concept}</div>
              <Btn full variant="secondary" onClick={() => onStartTopic && onStartTopic()} style={{ background: '#fff', color: 'var(--tier-critical)', border: 'none' }} iconRight={<I.arrowR size={19} />}>Start now</Btn>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <MiniStat icon="flame" value={STUDENT.streak} label="day streak" color="var(--tier-weak)" />
            <MiniStat icon="revise" value={REVISIONS_DUE.length} label="revisions due" color="var(--tier-ontrack)" onClick={() => onNav('revise')} />
          </div>
          <div style={{ marginTop: 20 }}>
            <SectionTitle action="See all" onAction={() => onNav('progress')}>Where to focus</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {READINESS.filter(r => ['critical','weak','fair'].includes(r.tier)).map(r => <ReadinessRow key={r.subject} r={r} onClick={() => onNav('progress')} />)}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '16px 20px 0' }}>
          {/* countdown strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.calendar size={20} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{STUDENT.examName}</div><div style={{ fontSize: 14.5, fontWeight: 700 }}><Mono>{examDays}</Mono> days to go</div></div>
            {premium && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', borderRadius: 99, background: 'oklch(0.80 0.13 88 / 0.18)', color: 'var(--tier-fair)', fontSize: 11, fontWeight: 700 }}><I.crown size={13} /> PRO</span>}
          </div>

          {/* freemium banner — gates session start */}
          {freemiumLocked && (
            <div className="spz-fade-up" style={{ marginBottom: 16, borderRadius: 18, padding: 16, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))', color: '#fff', boxShadow: 'var(--shadow-brand)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><I.lock size={18} /><span style={{ fontWeight: 700, fontSize: 15 }}>You’ve used today’s sessions</span></div>
              <div style={{ fontSize: 13.5, opacity: 0.92, lineHeight: 1.45, marginBottom: 14 }}>Free plan includes {STUDENT.sessionLimit} Vidya sessions a day. Go Premium for unlimited learning.</div>
              <Btn full onClick={() => onNav('upgrade')} style={{ background: '#fff', color: 'var(--brand-700)' }} icon={<I.crown size={18} />}>Upgrade to Premium</Btn>
            </div>
          )}

          {/* primary CTA: next recommended topic */}
          <div className="spz-fade-up" onClick={() => freemiumLocked ? onNav('upgrade') : onStartTopic()} style={{ cursor: 'pointer', borderRadius: 22, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 99, background: 'var(--primary-soft)', opacity: 0.6 }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}><I.sparkle size={15} /> Recommended next</div>
              <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}><SubjectChip subject={NEXT_TOPIC.subject} size="sm" /><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}><I.clock size={13} /> {NEXT_TOPIC.minutes} min</span></div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 4, textWrap: 'pretty' }}>{NEXT_TOPIC.concept}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{NEXT_TOPIC.reason}</div>
              <Btn full size="md" icon={freemiumLocked ? <I.lock size={17} /> : <I.play size={17} />}>{freemiumLocked ? 'Unlock with Premium' : 'Start learning session'}</Btn>
            </div>
          </div>

          {/* streak + xp row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Card pad={16} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tier-weak)', marginBottom: 8 }}><I.flame size={22} /><Mono style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{STUDENT.streak}</Mono></div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Day streak</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Best: {STUDENT.longestStreak} days</div>
            </Card>
            <Card pad={16} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}><I.bolt size={20} /><span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Lvl {STUDENT.level}</span></div>
                <Mono style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{STUDENT.xp}</Mono>
              </div>
              <Bar value={xpPct} />
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>{STUDENT.xpToNext - STUDENT.xp} XP to Lvl {STUDENT.level + 1}</div>
            </Card>
          </div>

          {/* revision due alert */}
          {REVISIONS_DUE.length > 0 && !freemiumLocked && (
            <div onClick={() => onNav('revise')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: 'var(--tier-ontrack-soft)', marginBottom: 16 }}>
              <div style={{ color: 'var(--tier-ontrack)' }}><I.revise size={22} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{REVISIONS_DUE.length} revisions due today</div><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Lock in what you’ve learned</div></div>
              <I.chevR size={19} style={{ color: 'var(--tier-ontrack)' }} />
            </div>
          )}

          {/* subject readiness */}
          <SectionTitle action="Details" onAction={() => onNav('progress')}>Subject readiness</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {READINESS.slice(0, 5).map(r => <ReadinessRow key={r.subject} r={r} onClick={() => onNav('progress')} />)}
          </div>

          {/* weekly challenge */}
          <SectionTitle>Weekly challenge</SectionTitle>
          <Card pad={16} style={{ background: 'linear-gradient(135deg, var(--surface), var(--primary-soft))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--primary)', color: 'var(--on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.target size={24} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{WEEKLY_CHALLENGE.title}</div><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{WEEKLY_CHALLENGE.daysLeft} days left · +{WEEKLY_CHALLENGE.xp} XP</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bar value={WEEKLY_CHALLENGE.progress} max={WEEKLY_CHALLENGE.total} />
              <Mono style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{WEEKLY_CHALLENGE.progress}/{WEEKLY_CHALLENGE.total}</Mono>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReadinessRow({ r, onClick }) {
  const s = SUBJECTS[r.subject];
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <Ring tier={r.tier} size={44} stroke={5}><div style={{ width: 28, height: 28, borderRadius: 10, background: `color-mix(in oklch, ${s.color} 16%, transparent)`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>{s.abbr}</div></Ring>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: r.trend >= 0 ? 'var(--tier-strong)' : 'var(--tier-critical)', fontWeight: 600 }}>
          <I.trend size={13} style={{ transform: r.trend < 0 ? 'scaleY(-1)' : 'none' }} />{r.trend >= 0 ? '+' : ''}{r.trend} this week
        </div>
      </div>
      <TierPill tier={r.tier} size="sm" />
    </div>
  );
}
function MiniStat({ icon, value, label, color, onClick }) {
  return (
    <Card pad={14} onClick={onClick} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ color }}>{React.createElement(I[icon], { size: 22 })}</div>
      <div><Mono style={{ fontSize: 22, fontWeight: 700 }}>{value}</Mono><div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div></div>
    </Card>
  );
}
function DashboardLoading() {
  return (
    <div style={{ height: '100%', background: 'var(--bg)', padding: '10px 20px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 4 }}>
        <div><Skel w={90} h={12} style={{ marginBottom: 8 }} /><Skel w={130} h={22} /></div>
        <Skel w={40} h={40} r={99} />
      </div>
      <Skel h={64} r={16} style={{ marginBottom: 16 }} />
      <Skel h={180} r={22} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><Skel h={92} r={20} /><Skel h={92} r={20} /></div>
      <Skel w={140} h={16} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0,1,2].map(i => <Skel key={i} h={68} r={16} />)}</div>
    </div>
  );
}
const iconBtn = () => ({ position: 'relative', width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' });

Object.assign(window, { DashboardScreen, ReadinessRow, MiniStat, iconBtn });
