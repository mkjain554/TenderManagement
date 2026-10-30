import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, formatDate, money, todayDate, useApi } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import Pagination from '../components/Pagination.jsx';
import BillDialog from '../components/BillDialog.jsx';
import FileShortNameDialog from '../components/FileShortNameDialog.jsx';
import BillFilesDialog from '../components/BillFilesDialog.jsx';
import ProjectCompletionDialog from '../components/ProjectCompletionDialog.jsx';
import TruncatedText from '../components/TruncatedText.jsx';
import { calculateBill } from '../utils/billing.js';

const PAGE_SIZE = 10;

export default function TenderDetails() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [tender, setTender] = useState(null);
  const [billData, setBillData] = useState({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [allBills, setAllBills] = useState([]);
  const [billType, setBillType] = useState('Construction bill');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [editingBillId, setEditingBillId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [loading, setLoading] = useState(true);
  const [printBills, setPrintBills] = useState(null);
  const [printSingleBill, setPrintSingleBill] = useState(false);
  const [printPending, setPrintPending] = useState(false);
  const [printingSecurityDetails, setPrintingSecurityDetails] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [fileUpload, setFileUpload] = useState(null);
  const [billFilesDialog, setBillFilesDialog] = useState(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [details, bills, statement] = await Promise.all([
        api.tenders.getById(id),
        api.bills.list(id, { page, pageSize: PAGE_SIZE, billType }),
        api.bills.getStatement(id),
      ]);
      setTender(details);
      setBillData(bills);
      setAllBills(statement);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [api, billType, id, page]);

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
      setPrintSingleBill(false);
    };
    window.addEventListener('afterprint', finishPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finishPrint);
    };
  }, [printBills, printPending]);

  useEffect(() => {
    if (!printingSecurityDetails) return undefined;
    const finishPrint = () => setPrintingSecurityDetails(false);
    window.addEventListener('afterprint', finishPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finishPrint);
    };
  }, [printingSecurityDetails]);

  const billSummaries = ['Construction bill', 'Maintenance bill'].map((type) => {
    const bills = allBills.filter((bill) => bill.bill_type === type);
    return {
      type,
      count: bills.length,
      netPayable: bills.reduce((total, bill) => total + calculateBill(bill, Boolean(tender?.apply_gst)).netPayable, 0),
      hold: bills.reduce((total, bill) => total + Number(bill.hold_amount || 0), 0),
      released: bills.reduce((total, bill) => total + Number(bill.release_amount || 0), 0),
      received: bills.reduce((total, bill) => total + Number(bill.amount_received || 0), 0),
    };
  });
  const printBillSummaries = printBills && ['Construction bill', 'Maintenance bill'].map((type) => {
    const bills = printBills.filter((bill) => bill.bill_type === type);
    return {
      type,
      count: bills.length,
      netPayable: bills.reduce((total, bill) => total + calculateBill(bill, Boolean(tender?.apply_gst)).netPayable, 0),
      hold: bills.reduce((total, bill) => total + Number(bill.hold_amount || 0), 0),
      released: bills.reduce((total, bill) => total + Number(bill.release_amount || 0), 0),
      received: bills.reduce((total, bill) => total + Number(bill.amount_received || 0), 0),
    };
  });
  const printBillRows = printBills && ['Construction bill', 'Maintenance bill'].reduce((grouped, type) => {
    let previousWorkDone = 0;
    grouped[type] = printBills
      .filter((bill) => bill.bill_type === type)
      .map((bill) => {
        const calculation = calculateBill(bill, Boolean(tender?.apply_gst));
        const deductions = Object.fromEntries(calculation.deductions.map(({ label, amount }) => [label, amount]));
        const row = {
          bill,
          calculation,
          previousWorkDone,
          totalWorkDone: previousWorkDone + calculation.workDone,
          security: deductions.Security || 0,
          gst: (deductions.CGST || 0) + (deductions.SGST || 0),
          incomeTax: deductions['Income tax'] || 0,
          labourCess: deductions['Labour cess'] || 0,
          cultureCessDeduction: deductions['Culture Cess'] || 0,
          tpa: deductions.TPA || 0,
          withheld: deductions.Withheld || 0,
          otherDeduction: deductions[bill.other_deduction_description || bill.other_deduction_type || 'Other deduction'] || 0,
        };
        previousWorkDone = row.totalWorkDone;
        return row;
      });
    return grouped;
  }, {});

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

  function printBill(bill) {
    setPrintBills([bill]);
    setPrintSingleBill(true);
    setPrintPending(true);
  }

  function printSecurityDetails() {
    setPrintingSecurityDetails(true);
  }

  if (loading && !tender) return <div className="loading-state">Loading tender…</div>;
  const tenderCompletion = (tender.project_completions || []).find((record) => record.project_name === tender.tender_name);

  return (
    <div className="page-wrap">
      <div className="detail-back"><Link className="back-link" to="/">← All tenders</Link></div>
      <div className="page-heading heading-row detail-heading">
        <div><p className="eyebrow">APP RECORD / {tender.id}</p><h1><TruncatedText text={tender.tender_name} /></h1><p className="page-description"><TruncatedText text={`${tender.tender_reference ? `Tender ID / NIT: ${tender.tender_reference} · ` : ''}${tender.department || 'Department not entered'} · ${tender.status}`} /></p></div>
        <div className="heading-actions"><button className="button button-light" onClick={printStatement} disabled={printing}>{printing ? 'Preparing…' : 'Print billing statement'}</button><button className="button button-light" onClick={() => setShowCompletionDialog(true)}>Complete tender</button><button className="button button-light" onClick={() => navigate(`/tenders/${id}/edit`)}>Edit tender</button><button className="button button-primary" onClick={() => setDialog({ type: 'new', billType })}><span>＋</span> Add bill</button></div>
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
                <div className="info-item"><span>Official Tender ID / NIT number</span><strong><TruncatedText text={tender.tender_reference || 'Not entered'} /></strong></div>
                <div className="info-item"><span>Department / client</span><strong><TruncatedText text={tender.department || 'Not entered'} /></strong></div>
                <div className="info-item"><span>Work location</span><strong><TruncatedText text={tender.work_location || 'Not entered'} /></strong></div>
                <div className="info-item"><span>Record status</span><strong><span className={`status-badge status-${tender.status.toLowerCase().replaceAll(' ', '-')}`}>{tender.status}</span></strong></div>
                <div className="info-item"><span>Notice / tender date</span><strong>{formatDate(tender.tender_date)}</strong></div>
                <div className="info-item"><span>Bid submission deadline</span><strong>{formatDate(tender.submission_deadline)}</strong></div>
                <div className="info-item"><span>Planned completion date</span><strong>{formatDate(tender.completion_date)}</strong></div>
                <div className="info-item"><span>Stipulated completion time</span><strong>{tender.stipulated_months ? `${tender.stipulated_months} months` : 'Not entered'}</strong></div>
                <div className="info-item"><span>Date of allotment</span><strong>{formatDate(tender.allotment_date)}</strong></div>
                <div className="info-item"><span>Work order number</span><strong><TruncatedText text={tender.work_order_number || 'Not entered'} /></strong></div>
                <div className="info-item"><span>Work code</span><strong><TruncatedText text={tender.work_code || 'Not entered'} /></strong></div>
                <div className="info-item"><span>Quoted rate</span><strong>{money(tender.quoted_rate)}</strong></div>
                <div className="info-item"><span>Project rebate rate</span><strong>{tender.rebate_percent}%</strong></div>
                {[1, 2, 3].map((number) => tender[`extension_date_${number}`] && (
                  <div className="info-item" key={`extension-${number}`}><span>Project extension date {number}</span><strong>{formatDate(tender[`extension_date_${number}`])}</strong></div>
                ))}
              </div>
              {tender.work_scope && <div className="work-scope"><span>Work description</span><p><TruncatedText text={tender.work_scope} /></p></div>}
            </div>
            <details className="detail-information-section detail-collapsible">
              <summary><h3>Bank guarantee and FDR / Insurance details</h3></summary>
              <button className="button button-small button-light security-register-print-button" onClick={printSecurityDetails}>Print details</button>
              {(tender.bank_guarantees || []).length ? tender.bank_guarantees.map((guarantee, index) => (
                <div className="guarantee-detail-record" key={guarantee.id || index}>
                  <h4>Guarantee {index + 1}</h4>
                  <div className="info-grid">
                    <div className="info-item"><span>Bank guarantee number</span><strong><TruncatedText text={guarantee.bank_guarantee_number || 'Not entered'} /></strong></div>
                    <div className="info-item"><span>Bank guarantee amount</span><strong>{money(guarantee.bank_guarantee_amount)}</strong></div>
                    <div className="info-item"><span>Date of issue</span><strong>{formatDate(guarantee.bank_guarantee_issue_date)}</strong></div>
                    <div className="info-item"><span>Date of expiry</span><strong>{formatDate(guarantee.bank_guarantee_expiry_date)}</strong></div>
                    {[1, 2, 3].map((number) => guarantee[`bank_guarantee_extension_date_${number}`] && (
                      <div className="info-item" key={`bg-extension-${number}`}><span>Guarantee extension date {number}</span><strong>{formatDate(guarantee[`bank_guarantee_extension_date_${number}`])}</strong></div>
                    ))}
                    <div className="info-item"><span>Released date</span><strong>{formatDate(guarantee.bank_guarantee_released_date)}</strong></div>
                    <div className="info-item"><span>FDR / Insurance number</span><strong><TruncatedText text={guarantee.security_instrument_number || 'Not entered'} /></strong></div>
                    <div className="info-item"><span>FDR / Insurance amount</span><strong>{money(guarantee.security_instrument_amount)}</strong></div>
                    <div className="info-item"><span>Bank / provider</span><strong><TruncatedText text={guarantee.security_instrument_institution || 'Not entered'} /></strong></div>
                    <div className="info-item"><span>Issue date</span><strong>{formatDate(guarantee.security_instrument_issue_date)}</strong></div>
                    <div className="info-item"><span>Maturity / expiry date</span><strong>{formatDate(guarantee.security_instrument_maturity_date)}</strong></div>
                    <div className="info-item"><span>FDR / Insurance release date</span><strong>{formatDate(guarantee.security_instrument_release_date)}</strong></div>
                  </div>
                </div>
              )) : <p className="muted-copy">No bank guarantees or FDRs recorded.</p>}
            </details>
            <div className="detail-information-section detail-amounts">
              <h3>Tender amounts</h3>
              <div className="info-grid">
                <div className="info-item"><span>Tender / contract amount</span><strong className="info-money">{money(tender.bidding_amount)}</strong></div>
                <div className="info-item"><span>EMD / bid security</span><strong>{money(tender.emd_amount)}</strong></div>
                <div className="info-item"><span>EMD refund received</span><strong>{money(tender.emd_refunded_amount)}</strong></div>
                <div className="info-item"><span>EMD submission date</span><strong>{formatDate(tender.emd_submission_date)}</strong></div>
                <div className="info-item"><span>EMD refund received date</span><strong>{formatDate(tender.emd_refund_received_date)}</strong></div>
                <div className="info-item"><span>Tender document fee</span><strong>{money(tender.tender_fee)}</strong></div>
                <div className="info-item"><span>GST</span><strong>{tender.apply_gst ? 'Applied' : 'Not applied'}</strong></div>
              </div>
            </div>
          </div>
          <div className="documents-area">
            <div className="subsection-heading"><div><h3>Tender documents</h3><span>{tender.files.length} {tender.files.length === 1 ? 'file' : 'files'}</span></div><button className="button button-small button-light" onClick={addTenderFiles}>＋ Add files</button></div>
            {tender.files.length > 0 ? <ul className="file-list">{tender.files.map((file) => <li key={file.id}><span className="file-type">{file.short_name || 'DOC'}</span><button className="file-name" onClick={() => openFile(file)}><TruncatedText text={file.short_name ? `${file.short_name} · ${file.file_name}` : file.file_name} /></button><button className="file-open-button" onClick={() => openFile(file)}>Open</button><button className="file-remove-button" onClick={() => removeFile(file)} title="Remove file">×</button></li>)}</ul> : <p className="muted-copy">No documents added yet. Add files to keep tender paperwork together.</p>}
          </div>
        </section>

        <section className="summary-card">
          <div className="summary-card-title"><span className="summary-icon summary-icon-green">₹</span><div><p className="eyebrow">FINANCIAL SUMMARY</p><h2>Bill progress</h2></div></div>
          <div className="financial-row"><span>Construction contract amount</span><strong>{money(tender.bidding_amount)}</strong></div>
          {billSummaries.map((summary) => <div className="bill-category-summary" key={summary.type}>
            <h3>{summary.type}</h3>
            <div className="financial-row"><span>Net payable · {summary.count} bills</span><strong>{money(summary.netPayable)}</strong></div>
            <div className="financial-row"><span>Hold amount</span><strong>{money(summary.hold)}</strong></div>
            <div className="financial-row"><span>Amount received</span><strong className="received-value">{money(summary.received)}</strong></div>
            {summary.type === 'Construction bill' && <div className="financial-total"><span>Construction balance pending</span><strong>{money(tender.outstanding)}</strong><small>Construction contract amount less construction bill receipts</small></div>}
            {summary.type === 'Maintenance bill' && <div className="financial-row"><span>Maintenance balance pending</span><strong>{money(Math.max(0, summary.netPayable - summary.received))}</strong></div>}
          </div>)}
        </section>
      </div>

      <section className="panel bills-panel">
        <div className="list-toolbar">
          <div><h2>{billType}s <span className="count-pill">{billData.total}</span></h2><p>Track bill documents, holds and payments for this tender.</p></div>
          <button className="button button-primary" onClick={() => setDialog({ type: 'new', billType })}><span>＋</span> Add bill</button>
        </div>
        <div className="tender-tabs" role="tablist" aria-label="Bill type">
          {billSummaries.map((summary) => <button
            key={summary.type}
            className={`tender-tab ${billType === summary.type ? 'active' : ''}`}
            role="tab"
            aria-selected={billType === summary.type}
            onClick={() => { setBillType(summary.type); setPage(1); }}
          >{summary.type}<span className="count-pill">{summary.count}</span></button>)}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>BILL / TYPE</th><th>PROJECT</th><th>DATE</th><th>FINANCIAL YEAR</th><th>DESCRIPTION</th><th>NET PAYABLE</th><th>HOLD AMOUNT</th><th>FILES</th><th /></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="9" className="table-message">Loading bills…</td></tr>
                : billData.rows.length === 0 ? <tr><td colSpan="9"><div className="empty-state compact"><span className="empty-icon">▧</span><strong>No {billType.toLowerCase()}s recorded yet</strong><p>Add a bill to start tracking payments and supporting documents.</p><button className="button button-light button-small" onClick={() => setDialog({ type: 'new', billType })}>＋ Add first bill</button></div></td></tr>
                : billData.rows.map((bill) => <tr key={bill.id}>
                  <td><strong className="bill-title"><TruncatedText text={bill.bill_name} /></strong><span className="table-subtext">{bill.bill_type} · {bill.id}</span></td>
                  <td><TruncatedText text={bill.project_name || '—'} /></td>
                  <td>{formatDate(bill.bill_date)}</td><td>{bill.financial_year ? `FY ${bill.financial_year}` : '—'}</td><td className="description-cell"><TruncatedText text={bill.description || '—'} /></td>
                  <td className="amount-cell">{money(calculateBill(bill, Boolean(tender.apply_gst)).netPayable)}</td>
                  <td className="amount-cell">{money(bill.hold_amount)}</td>
                  <td><div className="bill-row-doc-actions"><button className="view-bill-files" onClick={() => setBillFilesDialog(bill)}>View files <span>{bill.files.length}</span></button><button className="add-file-inline" onClick={() => setFileUpload({ ownerId: bill.id, kind: 'bill' })}>+ Add</button></div></td>
                  <td><div className="row-actions"><button onClick={() => printBill(bill)}>Print</button><button onClick={() => editBill(bill)} disabled={editingBillId === bill.id}>{editingBillId === bill.id ? 'Loading…' : 'Edit'}</button><button className="delete-action" onClick={() => removeBill(bill)}>Delete</button></div></td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <Pagination page={billData.page} pageSize={billData.pageSize} total={billData.total} onChange={setPage} />
      </section>
      <section className="panel project-completion-panel">
        <div className="list-toolbar">
          <div><h2>Tender completion <span className="count-pill">{tenderCompletion ? 'Complete' : 'Pending'}</span></h2><p>Security refund, balance and closeout documents for this tender.</p></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>TENDER</th><th>STATUS</th><th>SECURITY AMOUNT</th><th>SECURITY REFUND 1</th><th>REFUND DATE 1</th><th>SECURITY REFUND 2</th><th>REFUND DATE 2</th><th>BALANCE SECURITY</th><th>REMARK</th><th>DOCUMENTS</th></tr></thead>
            <tbody>
              <tr>
                <td><TruncatedText text={tender.tender_name} /></td>
                <td><span className={`status-badge ${tenderCompletion ? 'status-completed' : ''}`}>{tenderCompletion ? 'Completed' : 'Pending'}</span></td>
                <td className="amount-cell">{tenderCompletion ? money(tenderCompletion.security_amount) : '—'}</td>
                <td className="amount-cell">{tenderCompletion ? money(tenderCompletion.security_refund) : '—'}</td>
                <td>{formatDate(tenderCompletion?.security_refund_date_1)}</td>
                <td className="amount-cell">{tenderCompletion ? money(tenderCompletion.security_refund_2) : '—'}</td>
                <td>{formatDate(tenderCompletion?.security_refund_date_2)}</td>
                <td className="amount-cell">{tenderCompletion ? money(tenderCompletion.balance_security) : '—'}</td>
                <td className="description-cell"><TruncatedText text={tenderCompletion?.remark || '—'} /></td>
                <td>{tenderCompletion?.files?.length ? tenderCompletion.files.map((file) => <button className="completion-document-link" key={file.id} onClick={() => openFile(file)}><TruncatedText text={file.short_name || file.file_name} /></button>) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      {printBills !== null && <article className="print-statement">
        <header className="print-letterhead">
          <div className="print-company-mark">G</div>
          <div><h1>Garg Construction</h1><p>CONTRACTOR PROJECT RECORD</p></div>
          <span className="print-document-label">BILLING STATUS</span>
        </header>
        <div className="print-title-block">
          <h2>{printSingleBill ? `${printBills[0]?.bill_name || 'Bill'} · Billing details` : 'Project Billing Statement'}</h2>
          <p>Construction and maintenance billing statement · Generated {formatDate(todayDate())}</p>
        </div>
        <section className="print-overview">
          <div className="print-primary-project-grid">
            <div><span>Department / Client</span><strong>{tender.department || '—'}</strong></div>
            <div><span>Project / Tender</span><strong>{tender.tender_name}</strong></div>
          </div>
          <div className="print-project-grid">
            <div><span>Work location</span><strong>{tender.work_location || '—'}</strong></div>
            <div><span>Official Tender ID / NIT</span><strong>{tender.tender_reference || '—'}</strong></div>
            <div><span>Work code</span><strong>{tender.work_code || '—'}</strong></div>
            <div><span>Work order number</span><strong>{tender.work_order_number || '—'}</strong></div>
            <div><span>Notice / tender date</span><strong>{formatDate(tender.tender_date)}</strong></div>
            <div><span>Bid submission deadline</span><strong>{formatDate(tender.submission_deadline)}</strong></div>
            <div><span>Allotment date</span><strong>{formatDate(tender.allotment_date)}</strong></div>
            <div><span>Completion date</span><strong>{formatDate(tender.completion_date)}</strong></div>
            <div><span>Record status</span><strong>{tender.status}</strong></div>
            <div><span>Stipulated time</span><strong>{tender.stipulated_months ? `${tender.stipulated_months} months` : '—'}</strong></div>
            <div><span>Contract / sanctioned amount</span><strong>{money(tender.bidding_amount)}</strong></div>
            <div><span>Quoted rate</span><strong>{money(tender.quoted_rate)}</strong></div>
            <div><span>Project rebate rate</span><strong>{Number(tender.rebate_percent || 0)}%</strong></div>
            <div><span>Tender document fee</span><strong>{money(tender.tender_fee)}</strong></div>
            <div><span>EMD / bid security</span><strong>{money(tender.emd_amount)}</strong></div>
            <div><span>EMD refund received</span><strong>{money(tender.emd_refunded_amount)}</strong></div>
            <div><span>EMD submission date</span><strong>{formatDate(tender.emd_submission_date)}</strong></div>
            <div><span>EMD refund received date</span><strong>{formatDate(tender.emd_refund_received_date)}</strong></div>
            <div><span>GST</span><strong>{tender.apply_gst ? 'Applied' : 'Not applied'}</strong></div>
            {tender.work_scope && <div className="print-project-scope"><span>Work description</span><strong>{tender.work_scope}</strong></div>}
          </div>
          <div className="print-guarantees">
            <h3>Bank guarantee and FDR / Insurance register</h3>
            <table className="print-guarantee-table">
              <thead><tr><th colSpan="8">Bank Guarantee</th><th colSpan="7">FDR / Insurance</th></tr>
                <tr><th>BG No.</th><th>Amount</th><th>Issue date</th><th>Expiry date</th><th>Extension 1</th><th>Extension 2</th><th>Extension 3</th><th>Release date</th>
                  <th>Type</th><th>Instrument No.</th><th>Amount</th><th>Bank / provider</th><th>Issue date</th><th>Maturity / expiry</th><th>Release date</th></tr></thead>
              <tbody>
                {(tender.bank_guarantees || []).length > 0 ? tender.bank_guarantees.map((guarantee, index) => <tr key={guarantee.id || index}>
                  <td>{guarantee.bank_guarantee_number || '—'}</td>
                  <td>{money(guarantee.bank_guarantee_amount)}</td>
                  <td>{formatDate(guarantee.bank_guarantee_issue_date)}</td>
                  <td>{formatDate(guarantee.bank_guarantee_expiry_date)}</td>
                  {[1, 2, 3].map((number) => <td key={`print-bg-extension-${number}`}>{formatDate(guarantee[`bank_guarantee_extension_date_${number}`])}</td>)}
                  <td>{formatDate(guarantee.bank_guarantee_released_date)}</td>
                  <td>{guarantee.security_instrument_type || '—'}</td>
                  <td>{guarantee.security_instrument_number || '—'}</td>
                  <td>{money(guarantee.security_instrument_amount)}</td>
                  <td>{guarantee.security_instrument_institution || '—'}</td>
                  <td>{formatDate(guarantee.security_instrument_issue_date)}</td>
                  <td>{formatDate(guarantee.security_instrument_maturity_date)}</td>
                  <td>{formatDate(guarantee.security_instrument_release_date)}</td>
                </tr>) : <tr><td colSpan="15" className="print-no-bills">No bank guarantee or FDR / Insurance details recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {tenderCompletion && <section className="print-single-bill-details print-security-details">
          <h3>Tender security closeout</h3>
          <div className="print-project-grid print-detail-grid">
            <div><span>Security amount</span><strong>{money(tenderCompletion.security_amount)}</strong></div>
            <div><span>Security refund 1</span><strong>{money(tenderCompletion.security_refund)}</strong></div>
            <div><span>Refund date 1</span><strong>{formatDate(tenderCompletion.security_refund_date_1)}</strong></div>
            <div><span>Security refund 2</span><strong>{money(tenderCompletion.security_refund_2)}</strong></div>
            <div><span>Refund date 2</span><strong>{formatDate(tenderCompletion.security_refund_date_2)}</strong></div>
            <div><span>Balance security</span><strong>{money(tenderCompletion.balance_security)}</strong></div>
            <div className="print-project-scope"><span>Closeout remark</span><strong>{tenderCompletion.remark || '—'}</strong></div>
          </div>
        </section>}
        {printSingleBill && <section className="print-single-bill-details">
          <h3>Bill payment details</h3>
          <div className="print-project-grid print-detail-grid">
            <div><span>Previous bill number</span><strong>{printBills[0].previous_bill_number || '—'}</strong></div>
            <div><span>Price adjustment</span><strong>{printBills[0].escalation_adjustment_type || 'None'} · {money(calculateBill(printBills[0], Boolean(tender.apply_gst)).additionalEscalationAdjustment)}</strong></div>
            <div><span>Previous bill amount deducted</span><strong>{money(printBills[0].previous_bill_amount)}</strong></div>
            <div><span>Amount on hold</span><strong>{money(printBills[0].hold_amount)}</strong></div>
            <div><span>Amount released</span><strong>{money(printBills[0].release_amount)}</strong></div>
            <div><span>Release against</span><strong>{printBills[0].release_against || '—'}</strong></div>
            <div><span>Release date</span><strong>{formatDate(printBills[0].release_date)}</strong></div>
            <div><span>Release remark</span><strong>{printBills[0].release_remark || '—'}</strong></div>
            <div><span>Amount received</span><strong>{money(printBills[0].amount_received)}</strong></div>
            <div><span>Payment date</span><strong>{formatDate(printBills[0].received_date)}</strong></div>
          </div>
        </section>}
        <section className="print-financial-grid">
          {printBillSummaries.map((summary) => <div key={`${summary.type}-count`}><span>{summary.type} count</span><strong>{summary.count}</strong></div>)}
          <div><span>Construction contract amount</span><strong>{money(tender.bidding_amount)}</strong></div>
          {printBillSummaries.map((summary) => <div key={`${summary.type}-net`}><span>{summary.type} net payable</span><strong>{money(summary.netPayable)}</strong></div>)}
          {printBillSummaries.map((summary) => <div key={`${summary.type}-hold`}><span>{summary.type} on hold</span><strong>{money(summary.hold)}</strong></div>)}
          {printBillSummaries.map((summary) => <div key={`${summary.type}-released`}><span>{summary.type} released</span><strong>{money(summary.released)}</strong></div>)}
          {printBillSummaries.map((summary) => <div key={`${summary.type}-received`}><span>{summary.type} received</span><strong>{money(summary.received)}</strong></div>)}
          <div><span>Construction balance pending</span><strong>{money(Math.max(0, tender.bidding_amount - printBillSummaries[0].received))}</strong></div>
          <div><span>Maintenance balance pending</span><strong>{money(Math.max(0, printBillSummaries[1].netPayable - printBillSummaries[1].received))}</strong></div>
        </section>
        {['Construction bill', 'Maintenance bill'].filter((type) => !printSingleBill || printBills.some((bill) => bill.bill_type === type)).map((type) => (
          <section className="print-bill-section" key={type}>
              <div className="print-section-heading"><h3>{printSingleBill ? 'Bill calculation details' : `${type} calculation details`}</h3><span>{printBillRows[type]?.length || 0} bills</span></div>
            <table className="print-bill-table">
              <thead><tr>
                  <th>Bill No.</th><th>Project</th><th>Bill date</th><th>Financial year</th><th>Sanctioned amount</th><th>Previous work done</th><th>Work done</th><th>Escalation adjustment (+/−)</th><th>Culture Cess (+)</th><th>Rebate (−)</th>
                  <th>Price adjustment (+/−)</th><th>Previous bill amount (−)</th><th>Gross work done</th><th>Security %</th><th>Security (−)</th>
                {tender.apply_gst && <th>GST (−)</th>}<th>Income tax (−)</th><th>Labour cess (−)</th><th>Culture Cess (−)</th><th>TPA (−)</th><th>Withheld (−)</th><th>Other deduction (−)</th>
                <th>Net payable</th><th>On hold</th><th>Amount received</th><th>Payment date</th><th>Release date</th><th>Release against</th><th>Release remark</th>
              </tr></thead>
              <tbody>
                {printBillRows[type]?.length ? printBillRows[type].map(({ bill, calculation, previousWorkDone, totalWorkDone, security, gst, incomeTax, labourCess, cultureCessDeduction, tpa, withheld, otherDeduction }) => (
                  <tr key={bill.id}>
                    <td>{bill.bill_name}</td><td>{bill.project_name || '—'}</td><td>{formatDate(bill.bill_date)}</td><td>{bill.financial_year || '—'}</td><td>{money(tender.bidding_amount)}</td>
                    <td>{money(previousWorkDone)}</td><td>{money(calculation.workDone)}</td>
                    <td>{calculation.escalationAdjustment > 0 ? `+ ${money(calculation.escalationAdjustment)}` : calculation.escalationAdjustment < 0 ? `− ${money(Math.abs(calculation.escalationAdjustment))}` : '—'}</td>
                    <td>+ {money(calculation.cultureCess)}</td><td>− {money(calculation.rebate)}</td>
                    <td>{calculation.additionalEscalationAdjustment > 0 ? `+ ${money(calculation.additionalEscalationAdjustment)}` : calculation.additionalEscalationAdjustment < 0 ? `− ${money(Math.abs(calculation.additionalEscalationAdjustment))}` : '—'}</td>
                    <td>− {money(calculation.previousBillAmount)}</td>
                    <td>{money(calculation.gross)}</td><td>{Number(bill.security_percent || 0)}%</td><td>− {money(security)}</td>
                    {tender.apply_gst && <td>− {money(gst)}</td>}<td>− {money(incomeTax)}</td><td>− {money(labourCess)}</td><td>− {money(cultureCessDeduction)}</td>
                    <td>− {money(tpa)}</td><td>− {money(withheld)}</td><td>− {money(otherDeduction)}</td>
                    <td>{money(calculation.netPayable)}</td><td>{money(bill.hold_amount)}</td><td>{money(bill.amount_received)}</td><td>{formatDate(bill.received_date)}</td>
                    <td>{formatDate(bill.release_date)}</td><td>{bill.release_against || '—'}</td><td>{bill.release_remark || '—'}</td>
                  </tr>
                )) : <tr><td colSpan={tender.apply_gst ? 29 : 28} className="print-no-bills">No {type.toLowerCase()}s recorded.</td></tr>}
              </tbody>
              {!!printBillRows[type]?.length && <tfoot><tr>
                <th colSpan="6">{type} totals</th><th>{money(printBillRows[type].reduce((total, row) => total + row.calculation.workDone, 0))}</th>
                <th />
                <th>+ {money(printBillRows[type].reduce((total, row) => total + row.calculation.cultureCess, 0))}</th>
                <th>− {money(printBillRows[type].reduce((total, row) => total + row.calculation.rebate, 0))}</th><th />
                <th>− {money(printBillRows[type].reduce((total, row) => total + row.calculation.previousBillAmount, 0))}</th>
                <th>{money(printBillRows[type].reduce((total, row) => total + row.calculation.gross, 0))}</th><th /><th>− {money(printBillRows[type].reduce((total, row) => total + row.security, 0))}</th>
                {tender.apply_gst && <th>− {money(printBillRows[type].reduce((total, row) => total + row.gst, 0))}</th>}
                <th>− {money(printBillRows[type].reduce((total, row) => total + row.incomeTax, 0))}</th><th>− {money(printBillRows[type].reduce((total, row) => total + row.labourCess, 0))}</th>
                <th>− {money(printBillRows[type].reduce((total, row) => total + row.cultureCessDeduction, 0))}</th><th>− {money(printBillRows[type].reduce((total, row) => total + row.tpa, 0))}</th>
                <th>− {money(printBillRows[type].reduce((total, row) => total + row.withheld, 0))}</th><th>− {money(printBillRows[type].reduce((total, row) => total + row.otherDeduction, 0))}</th>
                <th>{money(printBillSummaries.find((summary) => summary.type === type)?.netPayable)}</th><th>{money(printBillSummaries.find((summary) => summary.type === type)?.hold)}</th><th>{money(printBillSummaries.find((summary) => summary.type === type)?.received)}</th><th /><th /><th /><th />
              </tr></tfoot>}
            </table>
          </section>
        ))}
        <p className="print-note">Construction and Maintenance bills are reported separately. Maintenance amounts are not included in Construction contract balance or totals.</p>
      </article>}
      {printingSecurityDetails && <article className="security-print-statement">
        <header className="print-letterhead">
          <div className="print-company-mark">G</div>
          <div><h1>Garg Construction</h1><p>CONTRACTOR PROJECT RECORD</p></div>
          <span className="print-document-label">SECURITY REGISTER</span>
        </header>
        <div className="print-title-block">
          <h2>Bank guarantee and FDR / Insurance details</h2>
          <p>{tender.tender_name}{tender.tender_reference ? ` · Tender ID / NIT: ${tender.tender_reference}` : ''}</p>
        </div>
        <table className="print-guarantee-table">
          <thead><tr><th colSpan="8">Bank Guarantee</th><th colSpan="7">FDR / Insurance</th></tr>
            <tr><th>BG No.</th><th>Amount</th><th>Issue date</th><th>Expiry date</th><th>Extension 1</th><th>Extension 2</th><th>Extension 3</th><th>Release date</th>
              <th>Type</th><th>Instrument No.</th><th>Amount</th><th>Bank / provider</th><th>Issue date</th><th>Maturity / expiry</th><th>Release date</th></tr></thead>
          <tbody>
            {(tender.bank_guarantees || []).length > 0 ? tender.bank_guarantees.map((guarantee, index) => <tr key={guarantee.id || index}>
              <td>{guarantee.bank_guarantee_number || '—'}</td>
              <td>{money(guarantee.bank_guarantee_amount)}</td>
              <td>{formatDate(guarantee.bank_guarantee_issue_date)}</td>
              <td>{formatDate(guarantee.bank_guarantee_expiry_date)}</td>
              {[1, 2, 3].map((number) => <td key={`security-print-extension-${number}`}>{formatDate(guarantee[`bank_guarantee_extension_date_${number}`])}</td>)}
              <td>{formatDate(guarantee.bank_guarantee_released_date)}</td>
              <td>{guarantee.security_instrument_type || '—'}</td>
              <td>{guarantee.security_instrument_number || '—'}</td>
              <td>{money(guarantee.security_instrument_amount)}</td>
              <td>{guarantee.security_instrument_institution || '—'}</td>
              <td>{formatDate(guarantee.security_instrument_issue_date)}</td>
              <td>{formatDate(guarantee.security_instrument_maturity_date)}</td>
              <td>{formatDate(guarantee.security_instrument_release_date)}</td>
            </tr>) : <tr><td colSpan="15" className="print-no-bills">No bank guarantee or FDR / Insurance details recorded.</td></tr>}
          </tbody>
        </table>
      </article>}
      {dialog && <BillDialog tenderId={id} bill={dialog.bill} projectNames={tender.project_names} applyGst={Boolean(tender.apply_gst)} projectRebate={tender.rebate_percent} defaultBillType={dialog.billType || 'Construction bill'} onClose={() => setDialog(null)} onSaved={(result) => {
        setDialog(null);
        setPage(1);
        load();
        if (result?.uploadBillId) setFileUpload({ ownerId: result.uploadBillId, kind: 'bill' });
      }} />}
      {billFilesDialog && <BillFilesDialog bill={billFilesDialog} onClose={() => setBillFilesDialog(null)} />}
      {showCompletionDialog && <ProjectCompletionDialog
        tenderId={id}
        tenderName={tender.tender_name}
        completions={tender.project_completions || []}
        applyGst={Boolean(tender.apply_gst)}
        onClose={() => setShowCompletionDialog(false)}
        onSaved={(completion) => {
          setShowCompletionDialog(false);
          setFileUpload({ ownerId: completion.id, kind: 'completion' });
          setNotice('Project completion saved. Add supporting documents.');
          load();
        }}
      />}
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
