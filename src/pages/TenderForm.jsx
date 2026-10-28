import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, todayDate, useApi } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import TenderFields from '../components/TenderFields.jsx';

const emptyTender = () => ({
  tender_name: '',
  project_names: [''],
  apply_gst: false,
  tender_reference: '',
  department: '',
  work_location: '',
  work_scope: '',
  tender_date: todayDate(),
  submission_deadline: '',
  completion_date: '',
  bidding_amount: '',
  emd_amount: '0',
  emd_refunded_amount: '0',
  emd_submission_date: '',
  emd_refund_received_date: '',
  tender_fee: '0',
  work_order_number: '',
  status: 'Preparing bid',
  work_code: '',
  quoted_rate: '0',
  rebate_percent: '2',
  stipulated_months: '0',
  allotment_date: '',
  extension_date_1: '',
  extension_date_2: '',
  extension_date_3: '',
  bank_guarantees: [emptyBankGuarantee()],
});

function emptyBankGuarantee() {
  return {
    bank_guarantee_number: '',
    bank_guarantee_amount: '0',
    bank_guarantee_issue_date: '',
    bank_guarantee_expiry_date: '',
    bank_guarantee_extension_date_1: '',
    bank_guarantee_extension_date_2: '',
    bank_guarantee_extension_date_3: '',
    bank_guarantee_released_date: '',
    security_instrument_number: '',
    security_instrument_amount: '0',
    security_instrument_institution: '',
    security_instrument_issue_date: '',
    security_instrument_maturity_date: '',
    security_instrument_release_date: '',
  };
}

const uppercaseTenderReferences = (values) => ({
  ...values,
  tender_reference: values.tender_reference?.toUpperCase() || '',
  work_code: values.work_code?.toUpperCase() || '',
  work_order_number: values.work_order_number?.toUpperCase() || '',
  bank_guarantees: values.bank_guarantees.map((guarantee) => ({
    ...guarantee,
    bank_guarantee_number: guarantee.bank_guarantee_number?.toUpperCase() || '',
    security_instrument_number: guarantee.security_instrument_number?.toUpperCase() || '',
  })),
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
      .then((tender) => active && setValues(uppercaseTenderReferences({
        tender_name: tender.tender_name,
        project_names: tender.project_names?.length ? tender.project_names : [tender.tender_name],
        apply_gst: Boolean(tender.apply_gst),
        tender_reference: tender.tender_reference || '',
        department: tender.department || '',
        work_location: tender.work_location || '',
        work_scope: tender.work_scope || '',
        tender_date: tender.tender_date,
        submission_deadline: tender.submission_deadline || '',
        completion_date: tender.completion_date,
        bidding_amount: String(tender.bidding_amount),
        emd_amount: String(tender.emd_amount || 0),
        emd_refunded_amount: String(tender.emd_refunded_amount || 0),
        emd_submission_date: tender.emd_submission_date || '',
        emd_refund_received_date: tender.emd_refund_received_date || '',
        tender_fee: String(tender.tender_fee || 0),
        work_order_number: tender.work_order_number || '',
        status: tender.status || 'Not set',
        work_code: tender.work_code || '',
        quoted_rate: String(tender.quoted_rate || 0),
        rebate_percent: String(tender.rebate_percent || 0),
        stipulated_months: String(tender.stipulated_months || 0),
        allotment_date: tender.allotment_date || '',
        extension_date_1: tender.extension_date_1 || '',
        extension_date_2: tender.extension_date_2 || '',
        extension_date_3: tender.extension_date_3 || '',
        bank_guarantees: tender.bank_guarantees?.length ? tender.bank_guarantees.map((guarantee) => ({
          ...emptyBankGuarantee(),
          ...guarantee,
          bank_guarantee_amount: String(guarantee.bank_guarantee_amount || 0),
          bank_guarantee_issue_date: guarantee.bank_guarantee_issue_date || '',
          bank_guarantee_expiry_date: guarantee.bank_guarantee_expiry_date || '',
          bank_guarantee_extension_date_1: guarantee.bank_guarantee_extension_date_1 || '',
          bank_guarantee_extension_date_2: guarantee.bank_guarantee_extension_date_2 || '',
          bank_guarantee_extension_date_3: guarantee.bank_guarantee_extension_date_3 || '',
          bank_guarantee_released_date: guarantee.bank_guarantee_released_date || '',
          security_instrument_number: guarantee.security_instrument_number || '',
          security_instrument_amount: String(guarantee.security_instrument_amount ?? 0),
          security_instrument_institution: guarantee.security_instrument_institution || '',
          security_instrument_issue_date: guarantee.security_instrument_issue_date || '',
          security_instrument_maturity_date: guarantee.security_instrument_maturity_date || '',
          security_instrument_release_date: guarantee.security_instrument_release_date || '',
        })) : [emptyBankGuarantee()],
      })))
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
        await api.tenders.update(id, uppercaseTenderReferences(values));
        navigate(`/tenders/${id}`);
      } else {
        const tender = await api.tenders.create(uppercaseTenderReferences(values));
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
