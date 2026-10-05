import { DEFAULT_FONT_SCALE, MAX_FONT_SCALE, MIN_FONT_SCALE, useSession } from '../App.jsx';

export default function Settings() {
  const { fontScale, setFontScale } = useSession();

  return (
    <div className="page-wrap page-narrow">
      <div className="page-heading">
        <p className="eyebrow">PREFERENCES</p>
        <h1>Settings</h1>
        <p className="page-description">Adjust the text and interface size to make Tender Desk comfortable to read.</p>
      </div>

      <section className="panel settings-panel" aria-labelledby="font-size-heading">
        <div className="settings-heading">
          <div className="settings-icon" aria-hidden="true">Aa</div>
          <div>
            <h2 id="font-size-heading">Text size</h2>
            <p>Choose a size that is easy for you to read. This setting is saved on this computer.</p>
          </div>
        </div>

        <div className="font-size-control">
          <button
            className="font-size-button"
            type="button"
            onClick={() => setFontScale((size) => Math.max(MIN_FONT_SCALE, size - 10))}
            disabled={fontScale <= MIN_FONT_SCALE}
            aria-label="Decrease text size"
            title="Decrease text size"
          >
            A−
          </button>
          <div className="font-size-value" aria-live="polite">
            <strong>{fontScale}%</strong>
            <span>Current size</span>
          </div>
          <button
            className="font-size-button font-size-button-larger"
            type="button"
            onClick={() => setFontScale((size) => Math.min(MAX_FONT_SCALE, size + 10))}
            disabled={fontScale >= MAX_FONT_SCALE}
            aria-label="Increase text size"
            title="Increase text size"
          >
            A+
          </button>
        </div>

        <p className="settings-help">Use − to make text smaller and + to make it larger. The change applies throughout the app.</p>
        <div className="settings-actions">
          <button
            className="button button-light"
            type="button"
            onClick={() => setFontScale(DEFAULT_FONT_SCALE)}
            disabled={fontScale === DEFAULT_FONT_SCALE}
          >
            Restore recommended size ({DEFAULT_FONT_SCALE}%)
          </button>
        </div>
      </section>
    </div>
  );
}
