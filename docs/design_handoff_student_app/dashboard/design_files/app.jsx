/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, Dashboard */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "gamification": "moderate",
  "showMascot": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.dataset.density = t.density;
  }, [t.density]);

  return (
    <React.Fragment>
      <Dashboard tweaks={t}/>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'cozy',     label: 'Cozy' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </TweakSection>

        <TweakSection label="Gamification">
          <TweakRadio
            label="Intensity"
            value={t.gamification}
            onChange={(v) => setTweak('gamification', v)}
            options={[
              { value: 'minimal',  label: 'Minimal' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'high',     label: 'Playful' },
            ]}
          />
        </TweakSection>

        <TweakSection label="Welcome banner">
          <TweakToggle
            label="Mascot illustration"
            value={t.showMascot}
            onChange={(v) => setTweak('showMascot', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
