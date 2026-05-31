/* ============================================================
   SPINZY — APP SHELL (router, theme, role, scenario controls)
   ============================================================ */
const { useState: uS, useEffect: uE } = React;

// Registry of screens — populated by screen files via window.SPZ_SCREENS
window.SPZ_SCREENS = window.SPZ_SCREENS || {};

function App() {
  const [theme, setTheme] = uS('light');
  const [role, setRole] = uS('student');           // student | parent
  const [route, setRoute] = uS('home');             // current screen id
  const [scenario, setScenario] = uS('default');    // state variant
  const [tab, setTab] = uS('home');                 // bottom nav tab
  const [railOpen, setRailOpen] = uS(true);

  uE(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // when role changes, reset to that role's first screen
  const go = (r) => { setRoute(r); if (['home','path','tutor','tests','progress'].includes(r)) setTab(r); };
  const switchRole = (r) => { setRole(r); setScenario('default'); if (r === 'student') { setRoute('home'); setTab('home'); } else { setRoute('p-dash'); } };

  const studentNav = ['home','path','tutor','tests','progress'];
  // tutor/whiteboard are focused modes with their own composer — no bottom tab bar
  const showBottomNav = role === 'student' && studentNav.includes(route) && !['tutor','whiteboard'].includes(route);

  // Build screen props
  const screenProps = {
    scenario, theme, role,
    onNav: go, setScenario,
    onStartTopic: () => go('lesson'),
    onDone: () => { go('home'); },
  };

  const ScreenComp = window.SPZ_SCREENS[route];

  // Scenario options differ per screen
  const SCENARIOS = {
    home: ['default','premium','crunch','freemium','loading','error'],
    lesson: ['default','question','no-content','loading'],
    diagnostic: ['default','error'],
    tutor: ['default','loading','complete'],
    path: ['default','empty','loading'],
    progress: ['default','empty','loading'],
    revise: ['default','empty'],
    tests: ['default','running','results','loading'],
    upgrade: ['default','locked','success'],
    onboarding: ['default','consent'],
    'p-dash': ['default','empty','loading'],
    'p-progress': ['default','empty'],
    'p-billing': ['default','emi-failed'],
    'p-settings': ['default'],
    'p-onboarding': ['default'],
  };
  const curScenarios = SCENARIOS[route] || ['default'];

  const STUDENT_SCREENS = [
    ['onboarding','S1 Onboarding'], ['diagnostic','S2 Diagnostic'], ['home','S3 Dashboard'],
    ['lesson','S4 Learning Session'], ['tutor','S4 · Vidya Chat'], ['path','S5 Learning Path'], ['progress','S6 Progress'],
    ['revise','S7 Revisions'], ['tests','S8 Tests & Mocks'], ['upgrade','S9 Upgrade'],
  ];
  const PARENT_SCREENS = [
    ['p-onboarding','P1 Onboarding'], ['p-dash','P2 Dashboard'], ['p-progress','P3 Child Detail'],
    ['p-billing','P4 Billing'], ['p-settings','P5 Settings'],
  ];
  const screens = role === 'student' ? STUDENT_SCREENS : PARENT_SCREENS;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch', background: theme === 'dark' ? '#0d0f11' : '#e9ecef', fontFamily: 'var(--font-sans)' }}>
      {/* ===== CONTROL RAIL ===== */}
      <div style={{
        width: railOpen ? 250 : 0, flexShrink: 0, transition: 'width .25s', overflow: 'hidden',
        background: theme === 'dark' ? '#16191c' : '#fbfcfd', borderRight: `1px solid ${theme === 'dark' ? '#23272b' : '#e2e6ea'}`,
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ width: 250, padding: 18, height: '100%', overflow: 'auto', color: theme === 'dark' ? '#e8eaed' : '#222', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><I.grad size={18} /></div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>Spinzy</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 18, fontFamily: 'var(--font-mono)' }}>prototype · v1</div>

          <RailGroup label="Role">
            <Seg2 opts={[['student','Student'],['parent','Parent']]} val={role} onChange={switchRole} theme={theme} />
          </RailGroup>
          <RailGroup label="Theme">
            <Seg2 opts={[['light','☀ Light'],['dark','☾ Dark']]} val={theme} onChange={setTheme} theme={theme} />
          </RailGroup>

          <RailGroup label="Screens">
            {screens.map(([id, name]) => (
              <button key={id} onClick={() => go(id)} style={railItem(route === id, theme)}>
                <span>{name}</span>{route === id && <I.chevR size={15} />}
              </button>
            ))}
          </RailGroup>

          <RailGroup label="State variant">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {curScenarios.map(s => (
                <button key={s} onClick={() => setScenario(s)} style={{
                  fontSize: 11.5, fontWeight: 600, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  border: `1px solid ${scenario === s ? 'var(--brand-500)' : (theme==='dark'?'#2a2f33':'#dde1e5')}`,
                  background: scenario === s ? 'var(--brand-500)' : 'transparent', color: scenario === s ? '#fff' : (theme==='dark'?'#aab':'#667'),
                }}>{s}</button>
              ))}
            </div>
          </RailGroup>

          <div style={{ fontSize: 11, opacity: 0.45, lineHeight: 1.5, marginTop: 20, fontFamily: 'var(--font-mono)' }}>Tap freely — every screen is live. Use State variant to see empty / loading / error / crunch / freemium.</div>
        </div>
      </div>

      {/* toggle rail */}
      <button onClick={() => setRailOpen(!railOpen)} style={{
        position: 'fixed', left: railOpen ? 250 : 0, top: 16, zIndex: 100, transition: 'left .25s',
        width: 26, height: 46, borderRadius: '0 12px 12px 0', border: 'none', cursor: 'pointer',
        background: 'var(--brand-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{railOpen ? <I.chevL size={16} /> : <I.chevR size={16} />}</button>

      {/* ===== DEVICE STAGE ===== */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px', minHeight: '100vh' }}>
        <div className="spz-root" data-theme={theme} style={{ position: 'relative' }}>
          <IOSDevice dark={theme === 'dark'} width={390} height={844}>
            <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)' }}>
              {/* content area below status bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 54, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  {ScreenComp
                    ? <ScreenComp key={route + scenario} {...screenProps} />
                    : <ComingSoon name={route} />}
                </div>
                {showBottomNav && <BottomNav active={tab} onChange={go} />}
              </div>
            </div>
          </IOSDevice>
        </div>
      </div>
    </div>
  );
}

function RailGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.45, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}
function Seg2({ opts, val, onChange, theme }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: theme === 'dark' ? '#1e2225' : '#eef1f3' }}>
      {opts.map(([id, lbl]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          flex: 1, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-sans)',
          background: val === id ? 'var(--brand-500)' : 'transparent', color: val === id ? '#fff' : (theme === 'dark' ? '#99a' : '#667'),
        }}>{lbl}</button>
      ))}
    </div>
  );
}
const railItem = (on, theme) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  padding: '9px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'left',
  fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: 'var(--font-sans)',
  background: on ? (theme === 'dark' ? '#1f2a2a' : 'var(--brand-50)') : 'transparent',
  color: on ? 'var(--brand-500)' : (theme === 'dark' ? '#c5c8cc' : '#445'),
});

function ComingSoon({ name }) {
  return (
    <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState icon="sparkle" title="Coming up next" body={`The "${name}" screen is on the build list. Foundation first!`} />
    </div>
  );
}

// Register core screens
window.SPZ_SCREENS.onboarding = (p) => <OnboardingScreen {...p} />;
window.SPZ_SCREENS.diagnostic = (p) => <DiagnosticScreen {...p} />;
window.SPZ_SCREENS.home = (p) => <DashboardScreen {...p} />;
window.SPZ_SCREENS.lesson = (p) => <LessonScreen {...p} />;
window.SPZ_SCREENS.tutor = (p) => <TutorScreen {...p} />;
window.SPZ_SCREENS.whiteboard = (p) => <WhiteboardScreen {...p} />;
window.SPZ_SCREENS.path = (p) => <PathScreen {...p} />;
window.SPZ_SCREENS.progress = (p) => <ProgressScreen {...p} />;
window.SPZ_SCREENS.revise = (p) => <ReviseScreen {...p} />;
window.SPZ_SCREENS.tests = (p) => <TestsScreen {...p} />;
window.SPZ_SCREENS.upgrade = (p) => <UpgradeScreen {...p} />;
window.SPZ_SCREENS.export = (p) => <ProgressScreen {...p} />;
// parent
window.SPZ_SCREENS['p-onboarding'] = (p) => <ParentOnboardingScreen {...p} />;
window.SPZ_SCREENS['p-dash'] = (p) => <ParentDashboardScreen {...p} />;
window.SPZ_SCREENS['p-progress'] = (p) => <ChildProgressScreen {...p} />;
window.SPZ_SCREENS['p-billing'] = (p) => <BillingScreen {...p} />;
window.SPZ_SCREENS['p-settings'] = (p) => <ParentSettingsScreen {...p} />;

function mountSpinzy() {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
window.mountSpinzy = mountSpinzy;
