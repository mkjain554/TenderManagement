import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_FONT_SCALE, errorMessage, MAX_FONT_SCALE, MIN_FONT_SCALE, useApi, useSession } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';

export default function Settings() {
  const api = useApi();
  const navigate = useNavigate();
  const { fontScale, setFontScale } = useSession();
  const [operation, setOperation] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => api?.data?.onProgress?.(setProgress), [api]);

  async function runDataAction(action) {
    setOperation(action);
    setError('');
    setSuccess('');
    setProgress({ percent: 0, message: action === 'backup' ? 'Preparing backup…' : 'Preparing restore…' });
    try {
      const result = await api.data[action]();
      if (result.canceled) {
        setProgress(null);
        return;
      }
      if (action === 'backup') {
        setSuccess(`Backup saved to Downloads as ${result.fileName}.`);
      } else {
        navigate('/', {
          replace: true,
          state: { notice: `Restore complete. ${result.tenderCount} tenders, ${result.billCount} bills and ${result.fileCount} documents are ready. Safety backup: ${result.safetyBackup}.` },
        });
      }
      setProgress(null);
    } catch (actionError) {
      setProgress(null);
      setError(errorMessage(actionError));
    } finally {
      setOperation('');
    }
  }

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

      <section className="panel settings-panel data-management-panel" aria-labelledby="data-management-heading">
        <div className="settings-heading">
          <div className="settings-icon data-settings-icon" aria-hidden="true">⇄</div>
          <div>
            <h2 id="data-management-heading">Backup and restore data</h2>
            <p>Create an offline ZIP of your tender records and documents, or restore a previously exported Tender Desk backup.</p>
          </div>
        </div>
        <ErrorNotice onClose={() => setError('')}>{error}</ErrorNotice>
        <ErrorNotice variant="success" onClose={() => setSuccess('')}>{success}</ErrorNotice>
        <div className="data-management-actions">
          <div className="data-action-card">
            <div><h3>Backup Data</h3><p>Saves a timestamped ZIP to Downloads with the database and tender, bill and completion documents.</p></div>
            <button className="button button-primary" type="button" disabled={Boolean(operation) || typeof api?.data?.backup !== 'function'} onClick={() => runDataAction('backup')}>
              {operation === 'backup' ? 'Creating backup…' : 'Backup Data'}
            </button>
          </div>
          <div className="data-action-card">
            <div><h3>Seed / Import Data</h3><p>Restore an existing Tender Desk ZIP. The app validates its database and files, then makes a safety backup before replacing current records.</p></div>
            <button className="button button-light" type="button" disabled={Boolean(operation) || typeof api?.data?.restore !== 'function'} onClick={() => runDataAction('restore')}>
              {operation === 'restore' ? 'Restoring data…' : 'Seed / Import Data'}
            </button>
          </div>
        </div>
        <p className="settings-help">Backup files contain tender and bill data only. Local sign-in credentials are excluded and remain on this computer.</p>
        {progress && <div className="data-progress" role="status" aria-live="polite">
          <div className="data-progress-heading"><span>{progress.message}</span><strong>{Math.round(progress.percent || 0)}%</strong></div>
          <progress max="100" value={progress.percent || 0} aria-label="Backup or restore progress" />
        </div>}
      </section>
    </div>
  );
}
