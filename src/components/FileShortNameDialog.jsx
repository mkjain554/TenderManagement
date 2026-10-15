import { useEffect, useRef, useState } from 'react';
import { errorMessage, useApi } from '../App.jsx';
import ErrorNotice from './ErrorNotice.jsx';

export default function FileShortNameDialog({ ownerId, kind, onClose, onComplete }) {
  const api = useApi();
  const [files, setFiles] = useState([]);
  const [shortNames, setShortNames] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pendingTokens = useRef(new Set());

  useEffect(() => {
    let active = true;
    const select = kind === 'tender'
      ? api.files.selectTenderFiles
      : kind === 'bill'
        ? api.files.selectBillFiles
        : api.files.selectCompletionFiles;
    select(ownerId)
      .then((selectedFiles) => {
        if (!active) {
          return Promise.all(selectedFiles.map((file) => api.files.discardSelectedFile(file.token)));
        }
        pendingTokens.current = new Set(selectedFiles.map((file) => file.token));
        setFiles(selectedFiles);
        return undefined;
      })
      .catch((selectionError) => {
        if (active) setError(errorMessage(selectionError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [api, kind, ownerId]);

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape' && !saving) cancel();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  });

  async function cancel() {
    setSaving(true);
    try {
      await Promise.all([...pendingTokens.current].map((token) => api.files.discardSelectedFile(token)));
      pendingTokens.current.clear();
      onClose();
    } catch (cancelError) {
      setError(errorMessage(cancelError));
      setSaving(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    for (const file of files) {
      const shortName = shortNames[file.token]?.trim() || '';
      if (!shortName || shortName.length > 10) {
        setError(`Enter a short name of 1–10 characters for "${file.file_name}".`);
        return;
      }
    }
    setSaving(true);
    let savedCount = 0;
    try {
      for (const file of files) {
        const shortName = shortNames[file.token]?.trim() || '';
        await api.files.saveSelectedFile(ownerId, file.token, shortName);
        pendingTokens.current.delete(file.token);
        setFiles((currentFiles) => currentFiles.filter((current) => current.token !== file.token));
        savedCount += 1;
      }
      onComplete(savedCount);
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  }

  const title = kind === 'tender'
    ? 'Tender document names'
    : kind === 'bill'
      ? 'Bill document names'
      : 'Project completion document names';
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && cancel()}>
      <section className="modal-card file-short-name-dialog" role="dialog" aria-modal="true" aria-labelledby="short-name-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">DOCUMENT UPLOAD</p>
            <h2 id="short-name-title">{title}</h2>
            <p className="page-description">Give each selected file a short name (up to 10 characters), such as NIT, EMD or BILL1.</p>
          </div>
          <button className="icon-button" onClick={cancel} disabled={saving} aria-label="Cancel file upload">×</button>
        </div>
        <ErrorNotice onClose={() => setError('')}>{error}</ErrorNotice>
        {loading ? <div className="loading-state">Opening file picker…</div>
          : files.length === 0 ? <div className="empty-state compact"><span className="empty-icon">↥</span><strong>No files selected</strong><p>Choose one or more files to add a short name.</p></div>
            : <form onSubmit={save}>
              <div className="short-name-file-list">
                {files.map((file) => <label className="short-name-file-row" key={file.token}>
                  <span className="short-name-file-icon">DOC</span>
                  <span className="short-name-file-info"><strong>{file.file_name}</strong><small>Saved under this short name</small></span>
                  <input
                    autoFocus={files[0].token === file.token}
                    aria-label={`Short name for ${file.file_name}`}
                    value={shortNames[file.token] || ''}
                    onChange={(event) => setShortNames({ ...shortNames, [file.token]: event.target.value.slice(0, 10) })}
                    placeholder="e.g. NIT"
                    maxLength={10}
                    required
                    disabled={saving}
                  />
                </label>)}
              </div>
              <div className="modal-actions">
                <button type="button" className="button button-light" onClick={cancel} disabled={saving}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving files…' : `Save ${files.length} ${files.length === 1 ? 'file' : 'files'}`}</button>
              </div>
            </form>}
        {files.length === 0 && <div className="modal-actions"><button type="button" className="button button-light" onClick={cancel} disabled={saving}>Close</button></div>}
      </section>
    </div>
  );
}
