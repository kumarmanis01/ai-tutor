/* global React */
// Shared icon glyphs (stroke style, 1em wide). Lightweight, no library.
// Used across dashboard variations.

const I = {
  arrow: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m4 12 5 5L20 6"/></svg>),
  spark: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m5.6 18.4 2.1-2.1"/><path d="m16.3 7.7 2.1-2.1"/></svg>),
  sun: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></svg>),
  flame: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>),
  bolt: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>),
  book: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v14"/></svg>),
  target: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>),
  chat: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.5A8 8 0 0 1 21 12z"/><path d="M8 11h8"/><path d="M8 14h5"/></svg>),
  play: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...p}><path d="M8 5v14l11-7z"/></svg>),
  more: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...p}><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>),
  trend: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  search: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
  dice: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>),
  send: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11 21 3l-8 18-2-8z"/><path d="m11 13 10-10"/></svg>),
  cal: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/></svg>),
  trophy: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 4h8v4a4 4 0 1 1-8 0z"/><path d="M5 4h3v3a3 3 0 0 1-3-3z"/><path d="M19 4h-3v3a3 3 0 0 0 3-3z"/><path d="M12 12v4"/><path d="M9 20h6"/><path d="M9 16h6l-1 4H10z"/></svg>),
  user: (p) => (<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>),
};

// Header chrome — top app bar present in all 3 variations
function TopBar({ name = "Manish", grade = "CBSE, Grade 6", school = "Springfield Public School", streak = 1, level = 3, compact = false }) {
  return (
    <header style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding: compact ? '14px 32px' : '20px 40px',
      background: 'transparent',
      borderBottom: '1px solid var(--line-2)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background:'var(--amber-soft)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--amber-ink)', border:'1px solid oklch(0.88 0.06 70)'}}>
          <I.book />
        </div>
        <div>
          <div style={{ display:'flex', alignItems:'baseline', gap: 8 }}>
            <span className="serif" style={{ fontSize: 22, lineHeight: 1, color:'var(--ink)'}}>Hi {name}</span>
            <span style={{ color:'var(--amber)', fontSize: 14 }}><I.sun/></span>
          </div>
          <div style={{ fontSize: 12, color:'var(--ink-3)', marginTop: 2 }}>{grade} · {school}</div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
        <button className="btn btn-ghost" style={{ padding:'8px 14px', fontSize: 12 }}>
          <span style={{ color:'var(--amber)' }}><I.spark/></span>
          Upgrade
        </button>
        <div className="pill pill-amber" style={{ padding:'6px 6px 6px 10px', gap: 8, fontSize: 12 }}>
          <span style={{ color:'var(--amber)' }}><I.flame/></span>
          {streak}-day streak
          <span style={{ background:'var(--primary)', color:'#fff', padding:'2px 8px', borderRadius: 999, fontFamily:'var(--mono)', fontSize: 11 }}>Lv {level}</span>
        </div>
        <div className="avatar">{name[0]}</div>
      </div>
    </header>
  );
}

// Generic chapter mastery row used in exam readiness
function MasteryRow({ name, pct = 0, tag = "critical" }) {
  const tagColor = tag === 'critical' ? 'var(--critical)' : (tag === 'strong' ? 'var(--mint)' : 'var(--ink-3)');
  const tagBg    = tag === 'critical' ? 'var(--critical-soft)' : (tag === 'strong' ? 'var(--mint-soft)' : 'var(--surface-sunk)');
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '10px 0', borderBottom:'1px solid var(--line-2)'}}>
      <span style={{ fontSize: 13, color:'var(--ink)'}}>{name}</span>
      <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
        <span style={{ fontSize: 10, padding:'3px 8px', borderRadius: 999, background: tagBg, color: tagColor, fontWeight: 500 }}>{tag}</span>
        <span className="mono num" style={{ fontSize: 12, color:'var(--ink)', minWidth: 36, textAlign:'right'}}>{pct}%</span>
      </div>
    </div>
  );
}

Object.assign(window, { I, TopBar, MasteryRow });
