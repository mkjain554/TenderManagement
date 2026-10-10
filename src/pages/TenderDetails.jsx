import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, formatDate, money, todayDate, useApi } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import Pagination from '../components/Pagination.jsx';
import BillDialog from '../components/BillDialog.jsx';
import FileShortNameDialog from '../components/FileShortNameDialog.jsx';
import BillFilesDialog from '../components/BillFilesDialog.jsx';
import { calculateBill } from '../utils/billing.js';

const PAGE_SIZE = 10;

export default function TenderDetails() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [tender, setTender] = useState(null);
  const [billData, setBillData] = useState({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [editingBillId, setEditingBillId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [loading, setLoading] = useState(true);
  const [printBills, setPrintBills] = useState(null);
  const [printPending, setPrintPending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [fileUpload, setFileUpload] = useState(null);
  const [billFilesDialog, setBillFilesDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [details, bills] = await Promise.all([
        api.tenders.getById(id),
        api.bills.list(id, { page, pageSize: PAGE_SIZE }),
      ]);
      setTender(details);
      setBillData(bills);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [api, id, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!tender || location.state?.uploadTenderId !== id) return;
    setFileUpload({ ownerId: id, kind: 'tender' });
    navigate(location.pathname, { replace: true, state: {} });
  }, [id, location.pathname, location.state, navigate, tender]);

  useEffect(() => {
    if (!printPending || printBills === null) return undefined;
    const finishPrint = () => {
      setPrintBills(null);
      setPrintPending(false);
    };
    window.addEventListener('afterprint', finishPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finishPrint);
    };
  }, [printBills, printPending]);

  async function addTenderFiles() {
    setFileUpload({ ownerId: id, kind: 'tender' });
  }

  async function openFile(file) {
    try {
      await api.files.open(file.id);
    } catch (openError) {
      setError(errorMessage(openError));
    }
  }

  async function removeFile(file) {
    if (!window.confirm(`Remove "${file.file_name}" from this tender?`)) return;
    try {
      await api.files.remove(file.id);
      await load();
    } catch (removeError) {
      setError(errorMessage(removeError));
    }
  }

  async function removeBill(bill) {
    if (!window.confirm(`Delete "${bill.bill_name}" and its documents? This cannot be undone.`)) return;
    try {
      await api.bills.delete(bill.id);
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function editBill(bill) {
    setEditingBillId(bill.id);
    setError('');
    try {
      if (typeof api?.bills?.getById !== 'function') {
        throw new Error('This desktop app version cannot load the saved bill calculations. Restart the latest development app or install a newly built version, then try again.');
      }
      const completeBill = await api.bills.getById(bill.id);
      setDialog({ type: 'edit', bill: completeBill });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setEditingBillId('');
    }
  }

  async function printStatement() {
    setPrinting(true);
    setError('');
    try {
      setPrintBills(await api.bills.getStatement(id));
      setPrintPending(true);
    } catch (printError) {
      setError(errorMessage(printError));
    } finally {
      setPrinting(false);
    }
  }

  if (loading && !tender) return <div className="loading-state">Loading tender…</div>;
  if (!tender) return <div className="page-wrap"><ErrorNotice>{error || 'Tender not found.'}</ErrorNotice><Link className="button button-light" to="/">Back to tenders</Link></div>;

  return (
    <div className="page-wrap">
      <div className="detail-back"><Link className="back-link" to="/">← All tenders</Link></div>
      <div className="page-heading heading-row detail-heading">
        <div><p className="eyebrow">APP RECORD / {tender.id}</p><h1>{tender.tender_name}</h1><p className="page-description">{tender.tender_reference ? `Tender ID / NIT: ${tender.tender_reference} · ` : ''}{tender.department || 'Department not entered'} <span className="heading-dot">•</span> {tender.status}</p></div>
        <div className="heading-actions"><button className="button button-light" onClick={printStatement} disabled={printing}>{printing ? 'Preparing…' : 'Print billing statement'}</button><button className="button button-light" onClick={() => navigate(`/tenders/${id}/edit`)}>Edit tender</button><button className="button button-primary" onClick={() => setDialog({ type: 'new' })}><span>＋</span> Add bill</button></div>
      </div>
      <ErrorNotice onClose={() => setError('')}>{error}</ErrorNotice>
      <ErrorNotice variant="success" onClose={() => setNotice('')}>{notice}</ErrorNotice>

      <div className="detail-grid">
        <section className="panel info-panel">
          <div className="panel-heading-line"><div><p className="eyebrow">OVERVIEW</p><h2>Tender information</h2></div><span className="tender-id-chip">{tender.id}</span></div>
          <div className="detail-information">
            <div className="detail-information-section">
              <h3>Notice and work details</h3>
              <div className="info-grid">
                <div className="info-item"><span>Official Tender ID / NIT number</span><strong>{tender.tender_reference || 'Not entered'}</strong></div>
                <div className="info-item"><span>Department / client</span><strong>{tender.department || 'Not entered'}</strong></div>
                <div className="info-item"><span>Work location</span><strong>{tender.work_location || 'Not entered'}</strong></div>
                <div className="info-item"><span>Record status</span><strong><span className={`status-badge status-${tender.status.toLowerCase().replaceAll(' ', '-')}`}>{tender.status}</span></strong></div>
                <div className="info-item"><span>Notice / tender date</span><strong>{formatDate(tender.tender_date)}</strong></div>
                <div className="info-item"><span>Bid submission deadline</span><strong>{formatDate(tender.submission_deadline)}</strong></div>
                <div className="info-item"><span>Planned completion date</span><strong>{formatDate(tender.completion_date)}</strong></div>
                <div className="info-item"><span>Stipulated completion time</span><strong>{tender.stipulated_months ? `${tender.stipulated_months} months` : 'Not entered'}</strong></div>
                <div className="info-item"><span>Date of allotment</span><strong>{formatDate(tender.allotment_date)}</strong></div>
                <div className="info-item"><span>Work order number</span><strong>{tender.work_order_number || 'Not entered'}</strong></div>
                <div className="info-item"><span>Work code</span><strong>{tender.work_code || 'Not entered'}</strong></div>
                <div className="info-item"><span>Quoted rate</span><strong>{money(tender.quoted_rate)}</strong></div>
                <div className="info-item"><span>Project rebate rate</span><strong>{tender.rebate_percent}%</strong></div>
                {[1, 2, 3].map((number) => tender[`extension_date_${number}`] && (
                  <div className="info-item" key={`extension-${number}`}><span>Project extension date {number}</span><strong>{formatDate(tender[`extension_date_${number}`])}</strong></div>
                ))}
              </div>
              {tender.work_scope && <div className="work-scope"><span>Work description</span><p>{tender.work_scope}</p></div>}
            </div>
            <details className="detail-information-section detail-collapsible">
              <summary><h3>Bank guarantee details</h3></summary>
              <div className="info-grid">
                <div className="info-item"><span>Bank guarantee number</span><strong>{tender.bank_guarantee_number || 'Not entered'}</strong></div>
                <div className="info-item"><span>Bank guarantee amount</span><strong>{money(tender.bank_guarantee_amount)}</strong></div>
                <div className="info-item"><span>Date of issue</span><strong>{formatDate(tender.bank_guarantee_issue_date)}</strong></div>
                <div className="info-item"><span>Date of expiry</span><strong>{formatDate(tender.bank_guarantee_expiry_date)}</strong></div>
                {[1, 2, 3].map((number) => tender[`bank_guarantee_extension_date_${number}`] && (
                  <div className="info-item" key={`bg-extension-${number}`}><span>Guarantee extension date {number}</span><strong>{formatDate(tender[`bank_guarantee_extension_date_${number}`])}</strong></div>
                ))}
              </div>
            </details>
            <details className="detail-information-section detail-collapsible">
              <summary><h3>FDR details</h3></summary>
              <div className="info-grid">
                <div className="info-item"><span>FDR number</span><strong>{tender.fdr_number || 'Not entered'}</strong></div>
                <div className="info-item"><span>FDR amount</span><strong>{money(tender.fdr_amount)}</strong></div>
                <div className="info-item"><span>Bank / branch</span><strong>{tender.fdr_bank || 'Not entered'}</strong></div>
                <div className="info-item"><span>FDR issue date</span><strong>{formatDate(tender.fdr_issue_date)}</strong></div>
                <div className="info-item"><span>FDR maturity date</span><strong>{formatDate(tender.fdr_maturity_date)}</strong></div>
                <div className="info-item"><span>Insurance policy number</span><strong>{tender.insurance_number || 'Not entered'}</strong></div>
                <div className="info-item"><span>Insurance provider</span><strong>{tender.insurance_provider || 'Not entered'}</strong></div>
                <div className="info-item"><span>Insurance issue date</span><strong>{formatDate(tender.insurance_issue_date)}</strong></div>
                <div className="info-item"><span>Insurance amount</span><strong>{money(tender.insurance_amount)}</strong></div>
                <div className="info-item"><span>Insurance payment release date</span><strong>{formatDate(tender.insurance_payment_release_date)}</strong></div>
              </div>
            </details>
            <div className="detail-information-section detail-amounts">
              <h3>Tender amounts</h3>
              <div className="info-grid">
                <div className="info-item"><span>Tender / contract amount</span><strong className="info-money">{money(tender.bidding_amount)}</strong></div>
                <div className="info-item"><span>EMD / bid security</span><strong>{money(tender.emd_amount)}</strong></div>
                <div className="info-item"><span>Tender document fee</span><strong>{money(tender.tender_fee)}</strong></div>
              </div>
            </div>
          </div>
          <div className="documents-area">
            <div className="subsection-heading"><div><h3>Tender documents</h3><span>{tender.files.length} {tender.files.length === 1 ? 'file' : 'files'}</span></div><button className="button button-small button-light" onClick={addTenderFiles}>＋ Add files</button></div>
            {tender.files.length > 0 ? <ul className="file-list">{tender.files.map((file) => <li key={file.id}><span className="file-type">{file.short_name || 'DOC'}</span><button className="file-name" title={file.file_name} onClick={() => openFile(file)}>{file.short_name ? `${file.short_name} · ${file.file_name}` : file.file_name}</button><button className="file-open-button" onClick={() => openFile(file)}>Open</button><button className="file-remove-button" onClick={() => removeFile(file)} title="Remove file">×</button></li>)}</ul> : <p className="muted-copy">No documents added yet. Add files to keep tender paperwork together.</p>}
          </div>
        </section>

        <section className="summary-card">
          <div className="summary-card-title"><span className="summary-icon summary-icon-green">₹</span><div><p className="eyebrow">FINANCIAL SUMMARY</p><h2>Bill progress</h2></div></div>
          <div className="financial-row"><span>Tender amount</span><strong>{money(tender.bidding_amount)}</strong></div>
          <div className="financial-row"><span>Total hold amount</span><strong>{money(tender.total_hold)}</strong></div>
          <div className="financial-row"><span>Total amount received</span><strong className="received-value">{money(tender.total_received)}</strong></div>
          <div className="financial-total"><span>Outstanding amount</span><strong>{money(tender.outstanding)}</strong><small>Tender amount less total received</small></div>
        </section>
      </div>

      <section className="panel bills-panel">
        <div className="list-toolbar">
          <div><h2>Bills <span className="count-pill">{billData.total}</span></h2><p>Track bill documents, holds and payments for this tender.</p></div>
          <button className="button button-primary" onClick={() => setDialog({ type: 'new' })}><span>＋</span> Add bill</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>BILL / TYPE</th><th>DATE</th><th>DESCRIPTION</th><th>NET PAYABLE</th><th>HOLD AMOUNT</th><th>AMOUNT RECEIVED</th><th>FILES</th><th /></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="table-message">Loading bills…</td></tr>
                : billData.rows.length === 0 ? <tr><td colSpan="8"><div className="empty-state compact"><span className="empty-icon">▧</span><strong>No bills recorded yet</strong><p>Add a bill to start tracking payments and supporting documents.</p><button className="button button-light button-small" onClick={() => setDialog({ type: 'new' })}>＋ Add first bill</button></div></td></tr>
                : billData.rows.map((bill) => <tr key={bill.id}>
                  <td><strong className="bill-title">{bill.bill_name}</strong><span className="table-subtext">{bill.bill_type} · {bill.id}</span></td>
                  <td>{formatDate(bill.bill_date)}</td><td className="description-cell" title={bill.description}>{bill.description || '—'}</td>
                  <td className="amount-cell">{money(calculateBill(bill).netPayable)}</td>
                  <td className="amount-cell">{money(bill.hold_amount)}</td>
                  <td className="amount-cell">{money(bill.amount_received)}
                    {(bill.received_date || bill.cheque_number) && <span className="table-subtext">{bill.received_date ? formatDate(bill.received_date) : ''}{bill.received_date && bill.cheque_number ? ' · ' : ''}{bill.cheque_number ? `Chq: ${bill.cheque_number}` : ''}</span>}
                  </td>
                  <td><div className="bill-row-doc-actions"><button className="view-bill-files" onClick={() => setBillFilesDialog(bill)}>View files <span>{bill.files.length}</span></button><button className="add-file-inline" onClick={() => setFileUpload({ ownerId: bill.id, kind: 'bill' })}>+ Add</button></div></td>
                  <td><div className="row-actions"><button onClick={() => editBill(bill)} disabled={editingBillId === bill.id}>{editingBillId === bill.id ? 'Loading…' : 'Edit'}</button><button className="delete-action" onClick={() => removeBill(bill)}>Delete</button></div></td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <Pagination page={billData.page} pageSize={billData.pageSize} total={billData.total} onChange={setPage} />
      </section>
      {printBills !== null && <article className="print-statement">
        <header className="print-letterhead">
          <div className="print-company-mark">G</div>
          <div><h1>Garg Construction</h1><p>CONTRACTOR PROJECT RECORD</p></div>
          <span className="print-document-label">BILLING STATUS</span>
        </header>
        <div className="print-title-block">
          <h2>Project Billing Statement</h2>
          <p>Project-wise summary of bills, payments and amounts on hold</p>
        </div>
        <section className="print-project-grid">
          <div><span>Work / project</span><strong>{tender.tender_name}</strong></div>
          <div><span>Official Tender ID / NIT</span><strong>{tender.tender_reference || '—'}</strong></div>
          <div><span>Department / client</span><strong>{tender.department || '—'}</strong></div>
          <div><span>Work location</span><strong>{tender.work_location || '—'}</strong></div>
          <div><span>Work order number</span><strong>{tender.work_order_number || '—'}</strong></div>
          <div><span>Project status</span><strong>{tender.status}</strong></div>
          <div><span>Statement date</span><strong>{formatDate(todayDate())}</strong></div>
          <div><span>Application record</span><strong>{tender.id}</strong></div>
        </section>
        <section className="print-financial-grid">
          <div><span>Contract amount</span><strong>{money(tender.bidding_amount)}</strong></div>
          <div><span>Total amount received</span><strong>{money(tender.total_received)}</strong></div>
          <div><span>Total amount on hold</span><strong>{money(tender.total_hold)}</strong></div>
          <div><span>Balance pending</span><strong>{money(tender.outstanding)}</strong></div>
        </section>
        <h3 className="print-table-heading">Bill-wise status</h3>
        <table className="print-bill-table">
          <thead><tr><th>Bill name / type</th><th>Bill date</th><th>Description</th><th>Net payable</th><th>Amount on hold</th><th>Amount received</th><th>Payment date / cheque no.</th></tr></thead>
          <tbody>
            {printBills.length === 0 ? <tr><td colSpan="7" className="print-no-bills">No bills recorded for this project.</td></tr>
              : printBills.map((bill) => <tr key={bill.id}>
                <td>{bill.bill_name}<br />{bill.bill_type}</td><td>{formatDate(bill.bill_date)}</td>
                <td>{bill.description || '—'}</td><td>{money(calculateBill(bill).netPayable)}</td>
                <td>{money(bill.hold_amount)}</td><td>{money(bill.amount_received)}</td>
                <td>{bill.received_date ? formatDate(bill.received_date) : '—'}{bill.cheque_number ? ` / ${bill.cheque_number}` : ''}</td>
              </tr>)}
          </tbody>
          {printBills.length > 0 && <tfoot><tr><th colSpan="3">Bill totals</th><th>{money(printBills.reduce((sum, bill) => sum + calculateBill(bill).netPayable, 0))}</th><th>{money(printBills.reduce((sum, bill) => sum + bill.hold_amount, 0))}</th><th>{money(printBills.reduce((sum, bill) => sum + bill.amount_received, 0))}</th><th /></tr></tfoot>}
        </table>
        <p className="print-note">This statement is a project record prepared from the locally maintained tender and bill register.</p>
        <footer className="print-signatures">
          <div><span>Prepared by</span><i /><strong>Garg Construction</strong></div>
          <div><span>Authorized contractor signature</span><i /><strong>Name, signature and date</strong></div>
          <div><span>Department / client verification</span><i /><strong>Name, signature and date</strong></div>
        </footer>
      </article>}
      {dialog && <BillDialog tenderId={id} bill={dialog.bill} projectRebate={tender.rebate_percent} onClose={() => setDialog(null)} onSaved={(result) => {
        setDialog(null);
        setPage(1);
        load();
        if (result?.uploadBillId) setFileUpload({ ownerId: result.uploadBillId, kind: 'bill' });
      }} />}
      {billFilesDialog && <BillFilesDialog bill={billFilesDialog} onClose={() => setBillFilesDialog(null)} />}
      {fileUpload && <FileShortNameDialog
        ownerId={fileUpload.ownerId}
        kind={fileUpload.kind}
        onClose={() => setFileUpload(null)}
        onComplete={(savedCount) => {
          setFileUpload(null);
          if (savedCount) setNotice(`${savedCount} ${savedCount === 1 ? 'file was' : 'files were'} saved with short names.`);
          load();
        }}
      />}
    </div>
  );
}
