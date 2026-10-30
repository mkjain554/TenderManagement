import { useEffect, useState } from 'react';
import { errorMessage, money, todayDate, useApi } from '../App.jsx';
import { calculateBill } from '../utils/billing.js';
import AppError from './ErrorNotice.jsx';
import AmountInput from './AmountInput.jsx';
import PercentInput from './PercentInput.jsx';
import { financialYearOptions } from '../utils/financialYear.js';

const blankBill = (projectRebate = 0, projectNames = [], billType = 'Construction bill') => ({
  bill_name: '',
  project_name: projectNames[0] || '',
  bill_date: todayDate(),
  financial_year: '',
  description: '',
  bill_type: billType,
  work_done_amount: '0',
  culture_cess_percent: '1',
  rebate_percent: String(projectRebate ?? 2),
  escalation_type: 'None',
  escalation_amount: '0',
  escalation_adjustment_type: 'None',
  escalation_adjustment_amount: '0',
  previous_bill_number: '',
  previous_bill_amount: '0',
  security_percent: '5',
  cgst_percent: '1',
  sgst_percent: '1',
  income_tax_percent: '2',
  labour_cess_percent: '1',
  construction_cess_percent: '1',
  tpa_amount: '0',
  withheld_amount: '0',
  other_deduction_type: '',
  other_deduction_description: '',
  other_deduction_amount: '0',
  hold_amount: '0',
  release_amount: '0',
  release_against: '',
  release_date: '',
  release_remark: '',
  amount_received: '0',
  received_date: '',
  cheque_number: '',
});

const percentFields = [
  ['culture_cess_percent', 'Culture cess rate'],
  ['rebate_percent', 'Rebate rate'],
  ['security_percent', 'Security deduction'],
  ['cgst_percent', 'CGST'],
  ['sgst_percent', 'SGST'],
  ['income_tax_percent', 'Income tax'],
  ['labour_cess_percent', 'Labour cess'],
  ['construction_cess_percent', 'Culture Cess'],
];

function BillAmount({ label, value, emphasize = false }) {
  return <div className={`bill-calculation-row ${emphasize ? 'emphasize' : ''}`}><span>{label}</span><strong>{money(value)}</strong></div>;
}

export default function BillDialog({ tenderId, bill, projectNames = [], applyGst = true, projectRebate = 0, defaultBillType = 'Construction bill', onClose, onSaved }) {
  const api = useApi();
  const [values, setValues] = useState(() => bill
    ? { ...blankBill(projectRebate, projectNames, defaultBillType), ...bill }
    : blankBill(projectRebate, projectNames, defaultBillType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const calculation = calculateBill(values, applyGst);
  const financialYears = financialYearOptions();

  useEffect(() => {
    setValues(bill ? { ...blankBill(projectRebate, projectNames, defaultBillType), ...bill } : blankBill(projectRebate, projectNames, defaultBillType));
  }, [bill, defaultBillType, projectNames, projectRebate]);

  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const update = (event) => {
    const { name, value } = event.target;
    setValues({ ...values, [name]: name === 'cheque_number' ? value.toUpperCase() : value });
  };
  const updateAmount = (name, value) => setValues({ ...values, [name]: value });
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (bill) {
        await api.bills.update(bill.id, values);
        onSaved();
      } else {
        const result = await api.bills.create(tenderId, values);
        onSaved({ uploadBillId: result.id });
      }
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card bill-dialog-card" role="dialog" aria-modal="true" aria-labelledby="bill-dialog-title">
        <div className="modal-heading">
          <div><p className="eyebrow">TENDER BILL</p><h2 id="bill-dialog-title">{bill ? 'Edit bill' : 'Add a bill'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <AppError>{error}</AppError>
        <div className="bill-quick-summary" aria-live="polite">
          <div><span>Gross amount</span><strong>{money(calculation.gross)}</strong></div>
          <div><span>Total deductions</span><strong>{money(calculation.totalDeduction)}</strong></div>
          <div><span>Net payable</span><strong>{money(calculation.netPayable)}</strong></div>
        </div>
        <form onSubmit={submit}>
          <section className="bill-form-section">
            <h3>Bill information</h3>
            <div className="form-grid">
              <label className="field"><span>Bill type</span><select name="bill_type" value={values.bill_type} onChange={update}><option>Construction bill</option><option>Maintenance bill</option></select></label>
              <label className="field"><span>Bill Number <b>*</b></span><input autoFocus name="bill_name" value={values.bill_name} onChange={update} maxLength={200} required placeholder="e.g. Running Bill 01" /></label>
              <label className="field"><span>Previous bill number</span><input name="previous_bill_number" value={values.previous_bill_number || ''} onChange={update} maxLength={120} placeholder="Reference to the previous bill" /></label>
              <label className="field"><span>Road name <b>*</b></span><select name="project_name" value={values.project_name} onChange={update} required>{projectNames.map((projectName) => <option key={projectName}>{projectName}</option>)}{!projectNames.includes(values.project_name) && <option>{values.project_name}</option>}</select></label>
              <label className="field"><span>Bill date <b>*</b></span><input type="date" name="bill_date" value={values.bill_date} onChange={update} required /></label>
              <label className="field"><span>Financial Year <b>*</b></span><select name="financial_year" value={values.financial_year || ''} onChange={update} required><option value="" disabled>Select financial year</option>{financialYears.map((year) => <option key={year} value={year}>FY {year}</option>)}{values.financial_year && !financialYears.includes(values.financial_year) && <option value={values.financial_year}>FY {values.financial_year}</option>}</select></label>
              <label className="field field-wide"><span>Description</span><textarea name="description" value={values.description} onChange={update} rows="2" maxLength={2000} placeholder="Optional notes about this bill" /></label>
              <label className="field field-wide"><span>Total work done as per Measurement Book (MB)</span><AmountInput name="work_done_amount" value={values.work_done_amount} onChange={updateAmount} /></label>
            </div>
          </section>

          <section className="bill-form-section">
            <h3>Bill calculation</h3>
            <p className="bill-section-help">Rates from the reference sheet are filled in as editable starting values. Confirm each rate against the contract.</p>
            <div className="form-grid">
              <label className="field"><span>Escalation adjustment (+/−)</span><select name="escalation_type" value={values.escalation_type} onChange={update}><option>None</option><option>Add</option><option>Deduct</option></select></label>
              <label className="field"><span>Escalation adjustment amount</span><AmountInput name="escalation_amount" value={values.escalation_amount} onChange={updateAmount} /></label>
              {percentFields.slice(0, 2).map(([name, label]) => (
                <label className="field" key={name}><span>{label}</span><PercentInput name={name} value={values[name]} onChange={updateAmount} /></label>
              ))}
              <label className="field"><span>Price adjustment (+/−)</span><select name="escalation_adjustment_type" value={values.escalation_adjustment_type} onChange={update}><option>None</option><option>Add</option><option>Deduct</option></select></label>
              <label className="field"><span>Price adjustment amount</span><AmountInput name="escalation_adjustment_amount" value={values.escalation_adjustment_amount} onChange={updateAmount} /></label>
              <label className="field"><span>Previous bill amount to deduct</span><AmountInput name="previous_bill_amount" value={values.previous_bill_amount} onChange={updateAmount} /></label>
            </div>
            <div className="bill-calculation-summary">
              <BillAmount label="Total work done as per MB" value={calculation.workDone} />
              <BillAmount label={`Escalation adjustment (${values.escalation_type})`} value={calculation.escalationAdjustment} />
              <BillAmount label="Work amount after escalation adjustment" value={calculation.workAfterPriceAdjustment} />
              <BillAmount label={`Culture cess (${values.culture_cess_percent || 0}%)`} value={calculation.cultureCess} />
              <BillAmount label="Total before rebate" value={calculation.totalBeforeRebate} />
              <BillAmount label={`Rebate (${values.rebate_percent || 0}%)`} value={calculation.rebate} />
              <BillAmount label="Amount after rebate" value={calculation.amountAfterRebate} />
              <BillAmount label={`Price adjustment (${values.escalation_adjustment_type})`} value={calculation.additionalEscalationAdjustment} />
              <BillAmount label="Previous bill amount (−)" value={calculation.previousBillAmount} />
              <BillAmount label="Gross amount after price adjustment and previous bill deduction" value={calculation.gross} emphasize />
            </div>
          </section>

          <section className="bill-form-section">
            <h3>Deductions</h3>
            <div className="form-grid">
              {percentFields.slice(2).filter(([name]) => applyGst || (name !== 'cgst_percent' && name !== 'sgst_percent')).map(([name, label]) => (
                <label className="field" key={name}><span>{label}</span><PercentInput name={name} value={values[name]} onChange={updateAmount} /></label>
              ))}
              <label className="field"><span>TPA amount</span><AmountInput name="tpa_amount" value={values.tpa_amount} onChange={updateAmount} /></label>
              <label className="field"><span>Withheld amount</span><AmountInput name="withheld_amount" value={values.withheld_amount} onChange={updateAmount} /></label>
              <label className="field"><span>Other deduction type</span><select name="other_deduction_type" value={values.other_deduction_type} onChange={update}><option value="">None</option><option>Penalty</option><option>Water charges</option><option>Material recovery</option><option>Other</option></select></label>
              {values.other_deduction_type === 'Other' && <label className="field"><span>Other deduction details</span><input name="other_deduction_description" value={values.other_deduction_description || ''} onChange={update} maxLength={200} placeholder="Describe this deduction" /></label>}
              <label className="field"><span>Other deduction amount</span><AmountInput name="other_deduction_amount" value={values.other_deduction_amount} onChange={updateAmount} /></label>
            </div>
            <div className="bill-calculation-summary">
              {calculation.deductions.map((deduction) => <BillAmount key={deduction.label} label={deduction.label} value={deduction.amount} />)}
              <BillAmount label="Total deduction" value={calculation.totalDeduction} emphasize />
              <BillAmount label="Net payable amount" value={calculation.netPayable} emphasize />
            </div>
          </section>

          <section className="bill-form-section">
            <h3>Hold and payment received</h3>
            <div className="form-grid">
              <label className="field"><span>Amount on hold</span><AmountInput name="hold_amount" value={values.hold_amount} onChange={updateAmount} /><small>Enter the amount being tracked as held separately from the calculated deductions.</small></label>
              <label className="field"><span>Amount release</span><AmountInput name="release_amount" value={values.release_amount} onChange={updateAmount} /></label>
              <label className="field"><span>Release against</span><input name="release_against" value={values.release_against || ''} onChange={update} maxLength={200} /></label>
              <label className="field"><span>Release date</span><input type="date" name="release_date" value={values.release_date || ''} onChange={update} /></label>
              <label className="field"><span>Release remark</span><input name="release_remark" value={values.release_remark || ''} onChange={update} maxLength={500} /></label>
              <label className="field"><span>Amount received</span><AmountInput name="amount_received" value={values.amount_received} onChange={updateAmount} /></label>
              <label className="field"><span>Date received</span><input type="date" name="received_date" value={values.received_date || ''} onChange={update} /></label>
              <label className="field"><span>Cheque / transaction number</span><input className="uppercase-input" name="cheque_number" value={values.cheque_number} onChange={update} maxLength={120} /></label>
            </div>
          </section>

          {!bill && <p className="form-hint">You can choose multiple bill documents after saving.</p>}
          <div className="modal-actions">
            <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : bill ? 'Save changes' : 'Save bill & add files'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
