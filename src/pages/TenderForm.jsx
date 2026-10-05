import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, todayDate, useApi } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import TenderFields from '../components/TenderFields.jsx';

const emptyTender = () => ({
  tender_name: '',
  tender_reference: '',
  department: '',
  work_location: '',
  work_scope: '',
  tender_date: todayDate(),
  submission_deadline: '',
  completion_date: '',
  bidding_amount: '',
  emd_amount: '0',
  tender_fee: '0',
  work_order_number: '',
  status: 'Preparing bid',
});

export default function TenderForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const api = useApi();
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyTender());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    let active = true;
    api.tenders.getById(id)
      .then((tender) => active && setValues({
        tender_name: tender.tender_name,
        tender_reference: tender.tender_reference || '',
        department: tender.department || '',
        work_location: tender.work_location || '',
        work_scope: tender.work_scope || '',
        tender_date: tender.tender_date,
        submission_deadline: tender.submission_deadline || '',
        completion_date: tender.completion_date,
        bidding_amount: String(tender.bidding_amount),
        emd_amount: String(tender.emd_amount || 0),
        tender_fee: String(tender.tender_fee || 0),
        work_order_number: tender.work_order_number || '',
        status: tender.status || 'Not set',
      }))
      .catch((loadError) => active && setError(errorMessage(loadError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [api, editing, id]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editing) {
        await api.tenders.update(id, values);
        navigate(`/tenders/${id}`);
      } else {
        const tender = await api.tenders.create(values);
        navigate(`/tenders/${tender.id}`, { state: { uploadTenderId: tender.id } });
      }
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-state">Loading tender…</div>;

  return (
    <div className="page-wrap page-narrow">
      <div className="page-heading">
        <div><Link className="back-link" to={editing ? `/tenders/${id}` : '/'}>← {editing ? 'Tender details' : 'Tender list'}</Link><p className="eyebrow">{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</p><h1>{editing ? 'Edit tender' : 'Add a tender'}</h1><p className="page-description">{editing ? 'Update tender information and keep the record current.' : 'Create a tender record and add its supporting documents.'}</p></div>
      </div>
      <section className="panel form-panel">
        <div className="panel-title"><div><span className="section-icon">01</span><div><h2>Tender and work information</h2><p>Use details from the tender notice or work order. Fields marked <b>*</b> are required.</p></div></div></div>
        <ErrorNotice>{error}</ErrorNotice>
        <form onSubmit={submit}>
          <TenderFields values={values} onChange={setValues} />
          {!editing && <div className="upload-explainer"><span className="upload-icon">↥</span><div><strong>Supporting documents</strong><p>After saving, choose one or more files from your computer.</p></div></div>}
          <div className="form-actions">
            <Link className="button button-light" to={editing ? `/tenders/${id}` : '/'}>Cancel</Link>
            <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save tender & add files'}<span>→</span></button>
          </div>
        </form>
      </section>
      {!editing && <p className="secure-note"><span className="status-dot" /> Tender documents are copied to this device and never uploaded online.</p>}
    </div>
  );
}
