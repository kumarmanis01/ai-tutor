/* global React, ReactDOM, I */
// Profile · revamp
// Reuses every element on the existing /profile page; restyled to match the
// dashboard system (warm cream + purple + amber, Instrument Serif + Geist).
// Key fixes vs current page:
//   • Identity hero pulls name/avatar/streak/level into one calm card
//   • Badges: ONE Share dropdown per badge (was 4 huge colorful buttons)
//   • Account/Academic preferences use a definition-list layout (no bold
//     "Label:" + value runs)
//   • Privacy & Data is a tasteful "danger zone" footer, not a red panel
//   • Sidebar widgets get the warm-card treatment, leaderboard matches dashboard

// ─────────────────── extra icons (avoid drawing brand marks) ───────────────────
const X = {
  link: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>),
  share: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v13"/><path d="m8 7 4-4 4 4"/></svg>),
  copy: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/></svg>),
  edit: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14 6 4 4"/></svg>),
  logout: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H10"/></svg>),
  shield: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>),
  trash: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>),
  font: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 20 11 4l6 16"/><path d="M7 14h8"/><path d="M16 14h4"/><path d="M16 17h3"/></svg>),
};

// ─────────────────── mock profile data ───────────────────
const PROFILE = {
  name: 'Manish Teach 22',
  email: 'manish.teach22@gmail.com',
  initials: 'M',
  level: 3,
  tier: 'Explorer',
  xpThisWeek: 350,
  currentStreak: 1,
  longestStreak: 3,
  memberSince: 'Jan 2026',
  showcaseCount: 3,
  account: {
    plan: null,
    billingCycle: null,
    role: 'user',
  },
  academic: {
    language: 'English',
    board: 'CBSE',
    grade: 6,
    subjects: ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi'],
    country: 'India',
    parentEmail: null,
  },
  badges: [
    { id: 'lightning', name: 'Lightning Striker', description: 'Answered 10 questions in under 5 minutes', icon: '⚡', accent: 'amber',   showcase: true },
    { id: 'star',      name: 'Rising Star',       description: 'Reached Level 3 in your first week',      icon: '★', accent: 'primary', showcase: true },
    { id: 'zap',       name: 'Comeback Kid',      description: 'Recovered a broken streak twice',         icon: '✦', accent: 'mint',    showcase: true },
    { id: 'fire',      name: 'On Fire',           description: 'Hit a 3-day streak — your longest yet',   icon: '🔥', accent: 'amber',   showcase: false },
    { id: 'brain',     name: 'Math Whiz',         description: '5 mastery wins in Mathematics',           icon: '◆', accent: 'primary', showcase: false },
  ],
  leaderboard: [
    { rank: 1, name: 'Aanya S.',  xp: 1240, you: false, accent: 'oklch(0.78 0.13 65)'  },
    { rank: 2, name: 'Rohan K.',  xp:  980, you: false, accent: 'oklch(0.78 0.02 270)' },
    { rank: 3, name: 'Priya M.',  xp:  720, you: false, accent: 'oklch(0.62 0.12 50)'  },
    { rank: 4, name: 'Kabir N.',  xp:  510, you: false },
    { rank: 5, name: 'You',       xp:  350, you: true  },
    { rank: 6, name: 'Sara R.',   xp:  290, you: false },
  ],
};

// ─────────────────── top bar (re-used pattern) ───────────────────
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
          <span className="navlink">Today</span>
          <span className="navlink">Syllabus</span>
          <span className="navlink">Practice</span>
          <span className="navlink">Progress</span>
          <span className="navlink">Doubts</span>
        </nav>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 10 }}>
          <div className="pill pill-amber" style={{ padding:'6px 6px 6px 12px', gap: 10, fontSize: 12.5 }}>
            <span style={{ color: 'var(--amber)' }}><I.flame/></span>
            <span><b style={{ fontWeight: 600 }}>{PROFILE.currentStreak}</b>-day streak</span>
            <span style={{ background:'var(--primary)', color:'#fff', padding:'3px 9px', borderRadius: 999, fontFamily:'var(--mono)', fontSize: 11 }}>Lv {PROFILE.level}</span>
          </div>
          <div className="avatar" style={{
            width: 36, height: 36, fontSize: 13,
            outline: '2px solid var(--primary)', outlineOffset: 2,
          }}>{PROFILE.initials}</div>
        </div>
      </div>
    </header>
  );
}

// ─────────────────── identity hero ───────────────────
function IdentityHero() {
  return (
    <section style={{
      background: 'linear-gradient(135deg, oklch(0.96 0.04 70) 0%, oklch(0.97 0.025 285) 60%, var(--bg-warm) 100%)',
      border: '1px solid var(--line)', borderRadius: 22,
      padding: '28px 32px',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      gap: 24, alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', right: -30, top: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, oklch(0.85 0.10 70 / .30), transparent 70%)',
      }}/>

      {/* Avatar with tier ring */}
      <div style={{ position: 'relative', padding: 6 }}>
        <div className="avatar" style={{
          width: 88, height: 88, fontSize: 36, fontFamily: 'var(--serif)', fontWeight: 400,
          background: '#fff', color: 'var(--ink)',
          border: '1px solid var(--line)',
        }}>{PROFILE.initials}</div>
        {/* tier ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid var(--primary)',
          pointerEvents: 'none',
        }}/>
      </div>

      <div style={{ position: 'relative', minWidth: 0 }}>
        <div className="eyebrow">Your profile</div>
        <h1 className="serif" style={{ margin: '2px 0 0', fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.015em' }}>{PROFILE.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 13, color: 'var(--ink-3)' }}>
          <span>{PROFILE.email}</span>
          <span style={{ width: 3, height: 3, background: 'var(--ink-4)', borderRadius: '50%' }}/>
          <span>Member since {PROFILE.memberSince}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="pill pill-amber" style={{ gap: 8 }}>
            <span style={{ color: 'var(--amber)' }}><I.flame/></span>
            <span><b style={{ fontWeight: 600 }}>{PROFILE.currentStreak}-day</b> streak</span>
            <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· best {PROFILE.longestStreak}d</span>
          </span>
          <span className="pill pill-primary" style={{ gap: 6 }}>
            <I.bolt/>
            Level {PROFILE.level} · {PROFILE.tier}
          </span>
          <span className="pill pill-mint" style={{ gap: 6 }}>
            <I.trophy/>
            {PROFILE.showcaseCount} showcased
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
        <button className="btn btn-primary" style={{ padding: '12px 18px' }}>
          <X.edit/> Update profile
        </button>
        <button className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: 12.5 }}>
          <X.logout/> Sign out
        </button>
      </div>
    </section>
  );
}

// ─────────────────── learning goals link ───────────────────
function LearningGoalsLink() {
  return (
    <a className="card" style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: 18, textDecoration: 'none', color: 'inherit', cursor: 'pointer',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--primary-soft)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}><I.target/></div>
      <div style={{ flex: 1 }}>
        <div className="serif" style={{ fontSize: 19 }}>My learning goals</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Set daily & weekly study targets</div>
      </div>
      <button className="btn btn-ghost" style={{ padding: 10, width: 38, height: 38, borderRadius: 999 }} aria-label="Open"><I.arrow/></button>
    </a>
  );
}

// ─────────────────── section card wrapper ───────────────────
function SectionCard({ title, eyebrow, action, children }) {
  return (
    <section className="card" style={{ padding: 26 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 16, marginBottom: 8 }}>
        <div>
          {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
          <h3 className="serif" style={{ margin: 0, fontSize: 20 }}>{title}</h3>
        </div>
        {action}
      </div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </section>
  );
}

function KV({ label, value, empty }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">
        {value != null && value !== '' ? value : <span className="kv-empty">{empty || 'Not set'}</span>}
      </span>
    </div>
  );
}

// ─────────────────── cards ───────────────────
function AccountCard() {
  return (
    <SectionCard title="Account & plan" eyebrow="Subscription" action={
      <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}>Manage <I.arrow/></button>
    }>
      <KV label="Plan" value={PROFILE.account.plan}/>
      <KV label="Billing cycle" value={PROFILE.account.billingCycle}/>
      <KV label="Role" value={PROFILE.account.role}/>
      <KV label="Member since" value={PROFILE.memberSince}/>
    </SectionCard>
  );
}

function AcademicCard() {
  const a = PROFILE.academic;
  return (
    <SectionCard title="Academic preferences" eyebrow="What you're studying" action={
      <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}><X.edit/> Edit</button>
    }>
      <KV label="Language" value={a.language}/>
      <KV label="Board" value={a.board}/>
      <KV label="Grade" value={a.grade ? `Class ${a.grade}` : null}/>
      <div className="kv">
        <span className="kv-label">Subjects</span>
        <span className="kv-value">
          {a.subjects && a.subjects.length > 0 ? (
            <span style={{ display:'inline-flex', flexWrap:'wrap', gap: 6 }}>
              {a.subjects.map(s => <span key={s} className="tag-subject">{s}</span>)}
            </span>
          ) : <span className="kv-empty">Not set</span>}
        </span>
      </div>
      <KV label="Country" value={a.country}/>
      <KV label="Parent email" value={a.parentEmail}/>
    </SectionCard>
  );
}

function DisplayCard() {
  const [size, setSize] = React.useState('m');
  const sizes = [
    { v: 's', label: 'Small' },
    { v: 'm', label: 'Medium' },
    { v: 'l', label: 'Large' },
  ];
  return (
    <SectionCard title="Display & accessibility" eyebrow="How it looks">
      <div className="kv" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <span className="kv-label" style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
          <X.font/> Font size
        </span>
        <span className="kv-value">
          <div style={{ display:'inline-flex', gap: 4, background:'var(--surface-sunk)', padding: 4, borderRadius: 999, border:'1px solid var(--line)'}}>
            {sizes.map(s => (
              <button key={s.v} onClick={() => setSize(s.v)} className="btn" style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 999,
                background: size === s.v ? 'var(--surface)' : 'transparent',
                color: size === s.v ? 'var(--ink)' : 'var(--ink-3)',
                border: size === s.v ? '1px solid var(--line)' : '1px solid transparent',
                fontWeight: size === s.v ? 500 : 400,
              }}>{s.label}</button>
            ))}
          </div>
        </span>
      </div>
    </SectionCard>
  );
}

function ParentAccessCard() {
  return (
    <SectionCard title="Parent access" eyebrow="Family" action={
      <span className="pill pill-ghost">Inactive</span>
    }>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
        Let a parent see your weekly progress and exam readiness — no passwords shared.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>
          Invite a parent
        </button>
        <button className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: 13 }}>
          Learn more
        </button>
      </div>
    </SectionCard>
  );
}

function DangerZone() {
  return (
    <section style={{
      borderTop: '1px solid var(--line-2)', marginTop: 8,
      paddingTop: 22,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 16 }}>
        <div style={{ display:'flex', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--critical-soft)', color: 'var(--critical)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X.shield/>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>Privacy &amp; data</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2, maxWidth: 460, lineHeight: 1.5 }}>
              Permanently deletes your account and personal data within 30 days. Learning analytics are kept anonymously.
            </div>
          </div>
        </div>
        <button className="btn btn-danger" style={{ padding: '10px 14px', fontSize: 12.5 }}>
          <X.trash/> Request deletion
        </button>
      </div>
    </section>
  );
}

// ─────────────────── sidebar widgets ───────────────────
function InviteCard() {
  return (
    <section className="card-warm" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--amber-soft)', color: 'var(--amber-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <I.user/>
        </div>
        <h4 className="serif" style={{ margin: 0, fontSize: 18 }}>Invite a friend</h4>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        Earn <b style={{ color: 'var(--ink)' }}>200 XP</b> when a friend joins through your link.
      </p>
      <div style={{ display:'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}>
          Create invite
        </button>
        <button className="btn btn-ghost" style={{ padding: '10px 12px', fontSize: 13 }} aria-label="Share">
          <X.share/>
        </button>
      </div>
    </section>
  );
}

const BADGE_ACCENT = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  amber:   { bg: 'var(--amber-soft)',   fg: 'var(--amber-ink)' },
  mint:    { bg: 'var(--mint-soft)',    fg: 'oklch(0.40 0.10 165)' },
};

function ShareMenu({ label }) {
  return (
    <details style={{ position:'relative' }}>
      <summary className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11.5, gap: 4 }}>
        <X.share style={{ width: 12, height: 12 }}/> Share
      </summary>
      <div style={{
        position: 'absolute', right: 0, top: 'calc(100% + 6px)',
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 12, padding: 8, boxShadow: '0 10px 30px -12px rgba(40,30,60,.18)',
        display: 'flex', gap: 4, zIndex: 10, whiteSpace: 'nowrap',
      }}>
        {[
          { id: 'wa', label: 'WhatsApp', bg: 'oklch(0.94 0.06 155)', fg: 'oklch(0.42 0.13 155)' },
          { id: 'x',  label: 'X',        bg: 'var(--surface-sunk)',   fg: 'var(--ink)' },
          { id: 'fb', label: 'Facebook', bg: 'oklch(0.93 0.05 260)', fg: 'oklch(0.42 0.13 260)' },
          { id: 'cp', label: 'Copy link',bg: 'var(--surface-sunk)',   fg: 'var(--ink-2)' },
        ].map(o => (
          <button key={o.id} className="btn" style={{
            padding: '6px 10px', fontSize: 11.5, fontWeight: 500,
            background: o.bg, color: o.fg, borderRadius: 8,
            gap: 4,
          }}>
            {o.id === 'cp' ? <X.copy style={{ width: 12, height: 12 }}/> : null}
            {o.label}
          </button>
        ))}
      </div>
    </details>
  );
}

function BadgeRow({ badge }) {
  const a = BADGE_ACCENT[badge.accent] || BADGE_ACCENT.primary;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 12px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      position: 'relative',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: a.bg, color: a.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flex: '0 0 auto',
      }}
      className={badge.showcase ? 'showcase-ring' : ''}
      >{badge.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{badge.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{badge.description}</div>
      </div>
      <ShareMenu/>
    </div>
  );
}

function BadgesCard() {
  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 12 }}>
        <h4 className="serif" style={{ margin: 0, fontSize: 18 }}>Badges</h4>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11.5 }}>
          Manage showcase
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 12 }}>
        <span style={{ display:'inline-block', width: 8, height: 8, borderRadius: 999, background: 'var(--primary)', marginRight: 6, verticalAlign: 'middle' }}/>
        {PROFILE.badges.filter(b => b.showcase).length} of 5 showcase slots used
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
        {PROFILE.badges.map(b => <BadgeRow key={b.id} badge={b}/>)}
      </div>
    </section>
  );
}

function LeaderboardCard() {
  return (
    <section className="card-warm" style={{ padding: 20 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 12 }}>
        <h4 className="serif" style={{ margin: 0, fontSize: 18 }}>Leaderboard</h4>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>This week · Grade 6</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
        {PROFILE.leaderboard.map(r => (
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
            }}>{r.you ? 'M' : r.name[0]}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: r.you ? 'var(--ink)' : 'var(--ink-2)', fontWeight: r.you ? 500 : 400 }}>{r.name}</span>
            <span className="mono num" style={{ fontSize: 12, color:'var(--ink)' }}>{r.xp.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyChallengeCard() {
  return (
    <section className="card" style={{ padding: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--amber-soft)', color: 'var(--amber-ink)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <I.trophy/>
        </div>
        <h4 className="serif" style={{ margin: 0, fontSize: 18 }}>Weekly challenge</h4>
      </div>
      <div className="serif" style={{ fontSize: 20, lineHeight: 1.15 }}>Solve 25 mensuration problems</div>
      <div style={{ marginTop: 12, display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Ends Sunday · reward +500 XP</span>
        <span className="mono num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>8 / 25</span>
      </div>
      <div className="bar" style={{ marginTop: 6, height: 6, background:'var(--line-2)', borderRadius: 999, overflow:'hidden' }}>
        <div style={{ width: '32%', height:'100%', background:'var(--amber)', borderRadius: 999 }}/>
      </div>
      <button className="btn btn-amber" style={{ marginTop: 14, width:'100%', padding: '10px 14px', fontSize: 13 }}>
        Continue challenge <I.arrow/>
      </button>
    </section>
  );
}

// ─────────────────── page ───────────────────
function ProfilePage() {
  return (
    <div className="dash-root">
      <TopBar/>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 32px 80px' }}>
        <IdentityHero/>

        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 22, marginTop: 22, alignItems: 'flex-start',
        }}>
          {/* Main column */}
          <div style={{ display:'flex', flexDirection:'column', gap: 18 }}>
            <LearningGoalsLink/>
            <AccountCard/>
            <AcademicCard/>
            <DisplayCard/>
            <ParentAccessCard/>
            <DangerZone/>
          </div>

          {/* Sidebar */}
          <aside style={{ display:'flex', flexDirection:'column', gap: 18 }}>
            <InviteCard/>
            <BadgesCard/>
            <LeaderboardCard/>
            <WeeklyChallengeCard/>
          </aside>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ProfilePage/>);
