/* global React, I */
// TutorAI · Dashboard — multi-subject version.
//   • Today's missions: hero + queued list across subjects
//   • Pick what's next: lightweight discovery row
//   • Week · Level · Leaderboard: three-up
//   • Exam readiness: subject grid + chapter breakdown tabs

// ───────────────────────── data ─────────────────────────

const SUBJECTS = [
  { id: 'math',    name: 'Mathematics',    short: 'Math',     color: 'oklch(0.45 0.16 285)', soft: 'oklch(0.95 0.03 285)', readiness: 4,  tag: 'critical' },
  { id: 'science', name: 'Science',        short: 'Science',  color: 'oklch(0.42 0.12 165)', soft: 'oklch(0.94 0.04 165)', readiness: 62, tag: 'on track' },
  { id: 'english', name: 'English',        short: 'English',  color: 'oklch(0.48 0.13 65)',  soft: 'oklch(0.95 0.05 70)',  readiness: 78, tag: 'strong' },
  { id: 'social',  name: 'Social Studies', short: 'Social',   color: 'oklch(0.46 0.14 25)',  soft: 'oklch(0.95 0.04 25)',  readiness: 45, tag: 'fair' },
  { id: 'hindi',   name: 'Hindi',          short: 'Hindi',    color: 'oklch(0.46 0.14 320)', soft: 'oklch(0.94 0.04 320)', readiness: 70, tag: 'strong' },
];
const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));

const TODAY_MISSIONS = [
  { id: 'm1', subjectId: 'math',    kind: 'Homework', title: 'Volume of Solids',       chapter: 'Ch. 11', q: 5, mins: 15, xp: 120, priority: true,  status: 'Due tomorrow · 10:00' },
  { id: 'm2', subjectId: 'science', kind: 'Lesson',   title: 'States of Matter',       chapter: 'Ch. 4',  q: null, mins: 12, xp: 60,  status: 'New' },
  { id: 'm3', subjectId: 'english', kind: 'Practice', title: 'Reading comprehension', chapter: 'Unit 3', q: 5, mins: 10, xp: 40,  status: 'Recommended' },
  { id: 'm4', subjectId: 'social',  kind: 'Lesson',   title: 'Industrial Revolution',  chapter: 'Ch. 7',  q: null, mins: 15, xp: 50,  status: 'Optional' },
];

const CHAPTERS_BY_SUBJECT = {
  math:    [{ n: 'Data handling', pct: 0,  tag: 'critical' }, { n: 'Mensuration',   pct: 0,  tag: 'critical' }, { n: 'Geometry',     pct: 0,  tag: 'critical' }],
  science: [{ n: 'Light',          pct: 80, tag: 'strong'   }, { n: 'States of Matter', pct: 65, tag: 'on track' }, { n: 'Ecosystems',  pct: 42, tag: 'fair' }],
  english: [{ n: 'Grammar',        pct: 88, tag: 'strong'   }, { n: 'Comprehension',   pct: 76, tag: 'strong'   }, { n: 'Composition', pct: 70, tag: 'on track' }],
  social:  [{ n: 'Civics',         pct: 55, tag: 'fair'     }, { n: 'History',         pct: 38, tag: 'fair'     }, { n: 'Geography',   pct: 42, tag: 'fair' }],
  hindi:   [{ n: 'व्याकरण',         pct: 78, tag: 'strong'   }, { n: 'गद्य',             pct: 64, tag: 'on track' }, { n: 'पद्य',         pct: 68, tag: 'on track' }],
};

const tagStyles = {
  'critical': { bg: 'var(--critical-soft)', fg: 'var(--critical)' },
  'fair':     { bg: 'oklch(0.95 0.05 70)',  fg: 'oklch(0.45 0.13 60)' },
  'on track': { bg: 'var(--primary-soft)',  fg: 'var(--primary)' },
  'strong':   { bg: 'var(--mint-soft)',     fg: 'oklch(0.40 0.10 165)' },
};
function ReadinessPill({ tag }) {
  const s = tagStyles[tag] || tagStyles['on track'];
  return <span style={{ padding:'4px 10px', borderRadius: 999, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 500, lineHeight: 1 }}>{tag}</span>;
}

// ───────────────────────── shared atoms ─────────────────────────

function SubjectGlyph({ subject, size = 36 }) {
  // mini "S/M/E" tile with subject color theming, no emoji
  const letter = subject.short[0];
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size/3.6),
      background: subject.soft, color: subject.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--serif)', fontSize: Math.round(size * 0.5),
      lineHeight: 1, flex: '0 0 auto',
      border: '1px solid color-mix(in oklab, ' + subject.color + ' 12%, transparent)',
    }}>{letter}</div>
  );
}

function SubjectChip({ subject }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: 6,
      padding:'3px 9px 3px 5px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: subject.soft, color: subject.color, lineHeight: 1,
    }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: subject.color, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize: 9, fontFamily:'var(--serif)' }}>
        {subject.short[0]}
      </span>
      {subject.short}
    </span>
  );
}

// ───────────────────────── top bar ─────────────────────────

function TopBar() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 5,
      backdropFilter: 'saturate(140%) blur(10px)',
      background: 'color-mix(in oklab, var(--bg) 80%, transparent)',
      borderBottom: '1px solid var(--line-2)',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:'0 2px 0 oklch(0.32 0.16 285)' }}>
            <I.book />
          </div>
          <span className="serif" style={{ fontSize: 20 }}>TutorAI</span>
        </div>

        <nav style={{ display:'flex', alignItems:'center', gap: 2, marginLeft: 12 }}>
          <span className="navlink active">Today</span>
          <span className="navlink">Syllabus</span>
          <span className="navlink">Practice</span>
          <span className="navlink">Progress</span>
          <span className="navlink">Doubts</span>
        </nav>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 10 }}>
          <button className="btn btn-ghost" style={{ padding:'8px 12px', fontSize: 12, gap: 6 }}>
            <span style={{ color:'var(--amber)' }}><I.spark/></span> Upgrade
          </button>
          <div className="pill pill-amber" style={{ padding:'6px 6px 6px 12px', gap: 10, fontSize: 12.5 }}>
            <span style={{ color: 'var(--amber)' }}><I.flame/></span>
            <span><b style={{ fontWeight: 600 }}>1</b>-day streak</span>
            <span style={{ background:'var(--primary)', color:'#fff', padding:'3px 9px', borderRadius: 999, fontFamily:'var(--mono)', fontSize: 11 }}>Lv 3</span>
          </div>
          <div className="avatar">M</div>
        </div>
      </div>
    </header>
  );
}

// ───────────────────────── welcome banner ─────────────────────────

function WelcomeBanner({ gamification = 'moderate', showMascot = true }) {
  const goalDone = 1, goalTotal = TODAY_MISSIONS.length;
  const goalPct = Math.round((goalDone / goalTotal) * 100);
  return (
    <section style={{
      background: 'linear-gradient(135deg, oklch(0.96 0.04 70) 0%, oklch(0.97 0.025 285) 60%, var(--bg-warm) 100%)',
      border: '1px solid var(--line)', borderRadius: 22,
      padding: '28px 32px',
      display: 'grid',
      gridTemplateColumns: showMascot ? '1fr 220px' : '1fr',
      gap: 24, alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', right: -40, top: -40,
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, oklch(0.85 0.10 70 / .35), transparent 70%)',
      }}/>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, color:'var(--ink-3)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom: 6 }}>Wednesday · 17 May</div>
        <h1 className="serif" style={{ margin: 0, fontSize: 38, lineHeight: 1.08, letterSpacing: '-0.015em', color: 'var(--ink)' }}>
          Welcome back, Manish.
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--ink-2)', maxWidth: 460, lineHeight: 1.55 }}>
          {goalTotal} missions across {new Set(TODAY_MISSIONS.map(m=>m.subjectId)).size} subjects today. Knock them out and you&apos;ll cross Level 4 by Sunday.
        </p>

        {gamification !== 'minimal' && (
          <div style={{ display:'flex', alignItems:'center', gap: 18, marginTop: 22 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
                <span style={{ fontSize: 11.5, color:'var(--ink-3)', letterSpacing:'.06em', textTransform:'uppercase' }}>Daily goal</span>
                <span className="mono num" style={{ fontSize: 12, color:'var(--ink-2)' }}>{goalDone} / {goalTotal} done</span>
              </div>
              <div className="bar bar-amber" style={{ marginTop: 8 }}>
                <i style={{ width: `${goalPct}%` }}/>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color:'var(--ink-3)'}}>{goalTotal - goalDone} more to keep your streak going 🔥</div>
            </div>

            {gamification === 'high' && (
              <div className="pill pill-mint" style={{ padding: '6px 12px' }}>
                <I.trophy/> First win unlocked
              </div>
            )}
          </div>
        )}
      </div>

      {showMascot && (
        <div style={{ position:'relative', display:'flex', justifyContent:'center' }}>
          <div className="ph-img" style={{
            width: 180, height: 180, borderRadius: 28,
            background: 'oklch(0.93 0.05 70)', color: 'var(--amber-ink)',
            backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 9px, oklch(0.88 0.06 70 / .6) 9px 10px)',
          }}>
            mascot · owl illustration
          </div>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── today's missions ─────────────────────────

function MissionHero({ mission }) {
  const subj = SUBJECT_BY_ID[mission.subjectId];
  return (
    <section className="card" style={{ padding: 'var(--pad-card)' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 16, flexWrap:'wrap' }}>
        <span className="pill pill-amber"><span style={{ width:6, height:6, borderRadius:'50%', background:'var(--amber)' }}/> {mission.kind} pending</span>
        <span className="pill pill-ghost"><I.clock/> {mission.status}</span>
        <SubjectChip subject={subj}/>
        <span style={{ marginLeft:'auto', fontSize: 11.5, color:'var(--ink-3)' }}>{subj.name} · {mission.chapter}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap: 24, alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Today&apos;s top mission</div>
          <h2 className="serif" style={{ margin:'4px 0 0', fontSize: 42, lineHeight: 1.04, letterSpacing:'-0.015em' }}>{mission.title}</h2>
          <p style={{ margin:'10px 0 0', fontSize: 14, color:'var(--ink-2)', maxWidth: 460, lineHeight: 1.55 }}>
            Five short problems on cubes, cuboids and cylinders. We&apos;ve pre-checked them against where you got stuck last week.
          </p>

          <div style={{ display:'flex', gap: 22, marginTop: 18 }}>
            <div><div style={{ fontSize: 10.5, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--ink-3)'}}>Questions</div><div className="serif" style={{ fontSize: 22 }}>{mission.q}</div></div>
            <div className="vdivider"/>
            <div><div style={{ fontSize: 10.5, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--ink-3)'}}>Time</div><div className="serif" style={{ fontSize: 22 }}>~{mission.mins}m</div></div>
            <div className="vdivider"/>
            <div><div style={{ fontSize: 10.5, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--ink-3)'}}>Reward</div><div className="serif" style={{ fontSize: 22, color:'var(--amber-ink)'}}>+{mission.xp} XP</div></div>
          </div>
        </div>

        <div className="ph-img" style={{ width: 140, height: 120, flex:'0 0 auto' }}>solid figs</div>
      </div>

      <div style={{ display:'flex', gap: 10, marginTop: 22, alignItems:'center' }}>
        <button className="btn btn-amber" style={{ padding:'14px 22px', fontSize: 14.5, fontWeight: 600 }}>
          Start {mission.kind.toLowerCase()} <I.arrow/>
        </button>
        <button className="btn btn-ghost" style={{ padding: '14px 18px' }}>Preview</button>
      </div>
    </section>
  );
}

function MissionRow({ mission }) {
  const subj = SUBJECT_BY_ID[mission.subjectId];
  return (
    <a className="card" style={{
      display:'flex', alignItems:'center', gap: 14,
      padding: 16, textDecoration:'none', color:'inherit', cursor:'pointer',
    }}>
      <SubjectGlyph subject={subj}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, fontSize: 11, color:'var(--ink-3)', letterSpacing:'.04em' }}>
          <span style={{ textTransform:'uppercase', fontWeight: 500 }}>{mission.kind}</span>
          <span style={{ width:3, height:3, background:'var(--ink-4)', borderRadius:'50%'}}/>
          <span>{subj.name} · {mission.chapter}</span>
        </div>
        <div className="serif" style={{ fontSize: 18, marginTop: 2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mission.title}</div>
        <div style={{ display:'flex', gap: 12, marginTop: 4, fontSize: 11.5, color:'var(--ink-3)'}}>
          {mission.q ? <span>{mission.q} q</span> : null}
          <span>~{mission.mins} min</span>
          <span style={{ color:'var(--amber-ink)' }}>+{mission.xp} XP</span>
        </div>
      </div>
      <button className="btn btn-ghost" style={{ padding: 10, width: 38, height: 38, borderRadius: 999, flex:'0 0 auto' }} aria-label="Start"><I.arrow/></button>
    </a>
  );
}

function TodaysMissions() {
  const hero = TODAY_MISSIONS.find(m => m.priority) || TODAY_MISSIONS[0];
  const rest = TODAY_MISSIONS.filter(m => m.id !== hero.id);
  return (
    <section style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
        <h3 className="serif" style={{ margin: 0, fontSize: 22 }}>Today&apos;s missions</h3>
        <span style={{ fontSize: 12, color:'var(--ink-3)' }}>
          {TODAY_MISSIONS.length} missions · {new Set(TODAY_MISSIONS.map(m=>m.subjectId)).size} subjects · total ~{TODAY_MISSIONS.reduce((s,m)=>s+m.mins,0)} min
        </span>
      </div>

      <MissionHero mission={hero}/>

      <div>
        <div style={{ display:'flex', alignItems:'center', gap: 8, margin: '10px 4px' }}>
          <span style={{ fontSize: 11, color:'var(--ink-3)', letterSpacing:'.08em', textTransform:'uppercase' }}>Up next today</span>
          <div style={{ flex: 1, height: 1, background:'var(--line-2)' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {rest.map(m => <MissionRow key={m.id} mission={m}/>)}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── pick what's next ─────────────────────────

function PickNext() {
  return (
    <section style={{ display:'flex', flexDirection:'column', gap: 12 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <h3 className="serif" style={{ margin: 0, fontSize: 18, color:'var(--ink-2)' }}>Want something extra?</h3>
        <div className="tabs">
          <button className="tab active">Warm-ups</button>
          <button className="tab">Browse syllabus</button>
          <button className="tab"><I.dice style={{ marginRight: 4 }}/> Surprise me</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12 }}>
        {[
          { subj: 'science', t: 'Light & lenses warm-up', meta: '5 q · 6 min · +30 XP' },
          { subj: 'english', t: 'Vocabulary builder',    meta: '10 q · 5 min · +25 XP' },
          { subj: 'math',    t: 'Mental math drill',     meta: '15 q · 4 min · +20 XP' },
        ].map((x, i) => {
          const s = SUBJECT_BY_ID[x.subj];
          return (
            <a key={i} className="card-warm" style={{ padding: 14, display:'flex', flexDirection:'column', gap: 8, cursor:'pointer', textDecoration:'none', color:'inherit' }}>
              <SubjectChip subject={s}/>
              <div className="serif" style={{ fontSize: 17, marginTop: 2 }}>{x.t}</div>
              <div style={{ fontSize: 11.5, color:'var(--ink-3)' }}>{x.meta}</div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────── week / level / leaderboard ─────────────────────────

function WeekCard() {
  return (
    <div className="card-warm" style={{ padding: 'var(--pad-section)' }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
        <h4 className="serif" style={{ margin: 0, fontSize: 18 }}>This week</h4>
        <span style={{ fontSize: 11, color:'var(--ink-3)' }}>7 / 5 done</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop: 18, gap: 4 }}>
        {[
          { d: 'M', state: 'done' }, { d: 'T', state: 'done' },
          { d: 'W', state: 'today' }, { d: 'T', state: '' },
          { d: 'F', state: '' }, { d: 'S', state: '' }, { d: 'S', state: 'done' },
        ].map((x, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 6, flex: 1 }}>
            <div className={`day-dot ${x.state}`} style={{ width: 28, height: 28 }}>
              {x.state === 'done' ? <I.check style={{ width: 12, height: 12 }}/> : ''}
            </div>
            <span style={{ fontSize: 10, color: x.state === 'today' ? 'var(--primary)' : 'var(--ink-3)', fontWeight: x.state === 'today' ? 500 : 400 }}>{x.d}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 11.5, color:'var(--ink-2)', display:'flex', alignItems:'center', gap: 6 }}>
        <span style={{ color:'var(--mint)' }}>✓</span> Ahead by 2 sessions
      </div>
    </div>
  );
}

function LevelCard({ gamification = 'moderate' }) {
  return (
    <div className="card-warm" style={{ padding: 'var(--pad-section)' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
        <div className="ring" style={{ '--p': 17, '--size': '60px', '--t': '6px' }}><span>17%</span></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color:'var(--ink-3)', letterSpacing:'.06em', textTransform:'uppercase' }}>Level 3 · Explorer</div>
          <div style={{ display:'flex', alignItems:'baseline', gap: 6, marginTop: 2 }}>
            <span className="serif" style={{ fontSize: 22 }}>50</span>
            <span style={{ color:'var(--ink-3)', fontSize: 13 }}>/ 300 XP</span>
          </div>
          <div style={{ fontSize: 11.5, color:'var(--ink-3)', marginTop: 4 }}>250 XP to Level 4</div>
        </div>
      </div>
      {gamification === 'high' && (
        <div style={{ marginTop: 14, padding:'10px 12px', background:'var(--surface)', borderRadius: 10, border:'1px solid var(--line)', display:'flex', alignItems:'center', gap: 10 }}>
          <span style={{ color:'var(--amber)' }}><I.bolt/></span>
          <span style={{ fontSize: 12, color:'var(--ink-2)' }}>+350 XP this week</span>
        </div>
      )}
    </div>
  );
}

function LeaderboardCard() {
  // Realistic shape: top 3 friends + you + one peer below you.
  const rows = [
    { rank: 1, name: 'Aanya S.',  xp: 1240, you: false, accent: 'oklch(0.78 0.13 65)' /* gold */ },
    { rank: 2, name: 'Rohan K.',  xp:  980, you: false, accent: 'oklch(0.78 0.02 270)' /* silver */ },
    { rank: 3, name: 'Priya M.',  xp:  720, you: false, accent: 'oklch(0.62 0.12 50)'  /* bronze */ },
    { rank: 4, name: 'Kabir N.',  xp:  510, you: false },
    { rank: 5, name: 'You',       xp:  350, you: true  },
    { rank: 6, name: 'Sara R.',   xp:  290, you: false },
  ];
  return (
    <div className="card-warm" style={{ padding: 'var(--pad-section)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
        <h4 className="serif" style={{ margin: 0, fontSize: 18 }}>Friends leaderboard</h4>
        <span style={{ fontSize: 11, color:'var(--ink-3)' }}>This week · Grade 6</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 6, marginTop: 14, flex: 1 }}>
        {rows.map(r => (
          <div key={r.rank} style={{
            display:'flex', alignItems:'center', gap: 10,
            padding:'6px 10px', borderRadius: 10,
            background: r.you ? 'var(--primary-soft)' : 'transparent',
            border: r.you ? '1px solid color-mix(in oklab, var(--primary) 22%, transparent)' : '1px solid transparent',
          }}>
            <span className="mono num" style={{
              width: 22, height: 22, borderRadius: 6,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize: 11, fontWeight: 600,
              background: r.accent || 'transparent',
              color: r.accent ? '#3a2a10' : 'var(--ink-3)',
            }}>{r.rank}</span>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: r.you ? 'var(--primary)' : 'oklch(0.86 0.02 280)',
              color: r.you ? '#fff' : 'var(--ink-2)',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize: 10, fontWeight: 600,
            }}>{r.name === 'You' ? 'M' : r.name[0]}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: r.you ? 'var(--ink)' : 'var(--ink-2)', fontWeight: r.you ? 500 : 400 }}>{r.name}</span>
            <span className="mono num" style={{ fontSize: 12, color:'var(--ink)' }}>{r.xp.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 11.5, color:'var(--ink-3)', display:'flex', justifyContent:'space-between' }}>
        <span>160 XP to overtake Kabir</span>
        <button className="btn" style={{ padding: 0, background:'transparent', color:'var(--primary)', fontSize: 12 }}>See all <I.arrow/></button>
      </div>
    </div>
  );
}

function StatsRow({ gamification }) {
  return (
    <section style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1.2fr', gap: 14 }}>
      <WeekCard/>
      <LevelCard gamification={gamification}/>
      <LeaderboardCard/>
    </section>
  );
}

// ───────────────────────── exam readiness (multi-subject) ─────────────────────────

function SubjectReadinessCard({ subject, selected, onClick }) {
  const ringColor =
    subject.tag === 'critical' ? 'var(--critical)' :
    subject.tag === 'fair'     ? 'var(--amber)'    :
    subject.tag === 'strong'   ? 'var(--mint)'     :
                                  'var(--primary)';
  return (
    <button onClick={onClick} className="card" style={{
      display:'flex', flexDirection:'column', gap: 10,
      padding: 16, cursor:'pointer', textAlign:'left',
      background: selected ? subject.soft : 'var(--surface)',
      borderColor: selected ? `color-mix(in oklab, ${subject.color} 32%, var(--line))` : 'var(--line)',
      boxShadow: selected ? `0 2px 0 color-mix(in oklab, ${subject.color} 20%, transparent)` : 'none',
      transition: 'background .15s, border-color .15s, box-shadow .15s',
      fontFamily: 'inherit', color:'inherit',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10, flex: 1, minWidth: 0 }}>
          <SubjectGlyph subject={subject} size={34}/>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="serif" style={{ fontSize: 17, lineHeight: 1.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subject.name}</div>
            <div style={{ marginTop: 4 }}><ReadinessPill tag={subject.tag}/></div>
          </div>
        </div>
        <div className="ring" style={{
          '--p': subject.readiness, '--size': '52px', '--t': '5px',
          background: `conic-gradient(${ringColor} calc(var(--p)*1%), var(--line-2) 0)`,
        }}><span>{subject.readiness}%</span></div>
      </div>
      <div className="bar" style={{ height: 5 }}><i style={{ width: `${Math.max(2, subject.readiness)}%`, background: ringColor }}/></div>
    </button>
  );
}

function ExamReadiness() {
  const sortedSubjects = [...SUBJECTS].sort((a,b) => a.readiness - b.readiness);
  const [selectedId, setSelectedId] = React.useState(sortedSubjects[0].id);
  const selected = SUBJECT_BY_ID[selectedId];
  const chapters = CHAPTERS_BY_SUBJECT[selectedId] || [];
  const overall = Math.round(SUBJECTS.reduce((s,x) => s + x.readiness, 0) / SUBJECTS.length);

  return (
    <section className="card" style={{ padding: 'var(--pad-card)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
          <div className="ring" style={{ '--p': overall, '--size': '64px', '--t': '6px' }}><span>{overall}%</span></div>
          <div>
            <h3 className="serif" style={{ margin: 0, fontSize: 22 }}>Exam readiness</h3>
            <div style={{ fontSize: 12.5, color:'var(--ink-3)', marginTop: 4 }}>
              Across {SUBJECTS.length} subjects · diagnostic complete · next retake opens 6 Jun
            </div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ padding:'8px 14px', fontSize: 12 }}>Full report <I.arrow/></button>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 10, marginTop: 18,
      }}>
        {sortedSubjects.map(s => (
          <SubjectReadinessCard key={s.id} subject={s} selected={s.id === selectedId} onClick={() => setSelectedId(s.id)}/>
        ))}
      </div>

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line-2)' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', flexWrap:'wrap', gap: 10 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <span style={{ fontSize: 11, color:'var(--ink-3)', letterSpacing:'.08em', textTransform:'uppercase' }}>Chapter mastery</span>
            <SubjectChip subject={selected}/>
          </div>
          <button className="btn btn-primary" style={{ padding:'10px 16px', fontSize: 12.5 }}>
            Study {selected.short} <I.arrow/>
          </button>
        </div>

        <div style={{ marginTop: 14, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {chapters.map(c => {
            const barColor =
              c.tag === 'critical' ? 'var(--critical)' :
              c.tag === 'fair'     ? 'var(--amber)'    :
              c.tag === 'strong'   ? 'var(--mint)'     :
                                      'var(--primary)';
            return (
              <div key={c.n} style={{ border:'1px solid var(--line)', borderRadius: 12, padding:'14px 16px', background:'var(--surface)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <span style={{ fontSize: 13 }}>{c.n}</span>
                  <ReadinessPill tag={c.tag}/>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap: 6, marginTop: 8 }}>
                  <span className="serif" style={{ fontSize: 22 }}>{c.pct}%</span>
                  <span style={{ fontSize: 11, color:'var(--ink-3)' }}>mastery</span>
                </div>
                <div className="bar" style={{ marginTop: 8, height: 6 }}><i style={{ width: `${Math.max(2, c.pct)}%`, background: barColor }}/></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── page ─────────────────────────

function Dashboard({ tweaks }) {
  const gamification = tweaks?.gamification ?? 'moderate';
  return (
    <div className="dash-root">
      <TopBar/>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 32px 80px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap: 'var(--gap-stack)' }}>
          <WelcomeBanner gamification={gamification} showMascot={tweaks?.showMascot !== false}/>
          <TodaysMissions/>
          <PickNext/>
          <StatsRow gamification={gamification}/>
          <ExamReadiness/>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
