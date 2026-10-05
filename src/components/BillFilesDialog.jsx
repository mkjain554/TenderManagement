import { useEffect, useState } from 'react';
import { errorMessage, formatDateTime, useApi } from '../App.jsx';
import ErrorNotice from './ErrorNotice.jsx';

export default function BillFilesDialog({ bill, onClose }) {
  const api = useApi();
  const [error, setError] = useState('');
  const [working, setWorking] = useState(null);

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape' && !working) onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose, working]);

  async function performAction(file, action) {
    setWorking(`${action}:${file.id}`);
    setError('');
    try {
      if (action === 'view') await api.files.open(file.id);
      else await api.files.download(file.id);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !working && onClose()}>
      <section className="modal-card bill-files-dialog" role="dialog" aria-modal="true" aria-labelledby="bill-files-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">BILL DOCUMENTS</p>
            <h2 id="bill-files-title">{bill.bill_name}</h2>
            <p className="page-description">{bill.id} · {bill.files.length} {bill.files.length === 1 ? 'file' : 'files'}</p>
          </div>
          <button className="icon-button" onClick={onClose} disabled={working !== null} aria-label="Close bill documents">×</button>
        </div>
        <ErrorNotice onClose={() => setError('')}>{error}</ErrorNotice>
        {bill.files.length ? <div className="bill-file-detail-list">
          {bill.files.map((file) => <div className="bill-file-detail" key={file.id}>
            <span className="dialog-file-type">DOC</span>
            <div className="bill-file-detail-info">
              <strong>{file.short_name || 'No short name'}</strong>
              <span title={file.file_name}>{file.file_name}</span>
              <small>Uploaded {formatDateTime(file.created_at)}</small>
            </div>
            <div className="bill-file-detail-actions">
              <button className="button button-light button-small" disabled={working !== null} onClick={() => performAction(file, 'view')}>
                {working === `view:${file.id}` ? 'Opening…' : 'View'}
              </button>
              <button className="button button-light button-small" disabled={working !== null} onClick={() => performAction(file, 'download')}>
                {working === `download:${file.id}` ? 'Saving…' : 'Download'}
              </button>
            </div>
          </div>)}
        </div> : <div className="empty-state compact"><span className="empty-icon">▧</span><strong>No bill documents</strong><p>Use “Add” in the bill row to attach files.</p></div>}
        <div className="modal-actions"><button type="button" className="button button-light" onClick={onClose} disabled={working !== null}>Close</button></div>
      </section>
    </div>
  );
}
