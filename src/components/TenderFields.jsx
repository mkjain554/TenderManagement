import AmountInput from './AmountInput.jsx';
import PercentInput from './PercentInput.jsx';

const uppercaseFields = new Set([
  'tender_reference',
  'work_code',
  'work_order_number',
  'bank_guarantee_number',
  'fdr_number',
  'insurance_number',
]);

export default function TenderFields({ values, onChange }) {
  const update = (event) => {
    const { name, value } = event.target;
    onChange({ ...values, [name]: uppercaseFields.has(name) ? value.toUpperCase() : value });
  };
  const updateAmount = (name, value) => onChange({ ...values, [name]: value });

  return (
    <>
      <details className="tender-form-section accordion-section" open>
        <summary className="tender-form-heading accordion-heading">
          <span><strong>Project information</strong><small>Work reference, dates, contract value and project status</small></span>
        </summary>
        <div className="form-grid accordion-content">
          <label className="field">
            <span>Official Tender ID / NIT number</span>
            <input autoFocus className="uppercase-input" name="tender_reference" value={values.tender_reference} onChange={update} placeholder="Number from the tender notice" maxLength={120} />
          </label>
          <label className="field">
            <span>Work code</span>
            <input className="uppercase-input" name="work_code" value={values.work_code} onChange={update} maxLength={120} placeholder="Department or project work code" />
          </label>
          <label className="field field-wide">
            <span>Project name <b>*</b></span>
            <input name="tender_name" value={values.tender_name} onChange={update} placeholder="e.g. Repair of village access road" maxLength={200} required />
          </label>
          <label className="field field-wide">
            <span>Description of project / work</span>
            <textarea name="work_scope" value={values.work_scope} onChange={update} rows="3" maxLength={2000} placeholder="Describe the work, site, or project scope." />
          </label>
          <label className="field">
            <span>Department / client</span>
            <input name="department" value={values.department} onChange={update} placeholder="e.g. Public Works Department" maxLength={200} />
          </label>
          <label className="field">
            <span>Work location</span>
            <input name="work_location" value={values.work_location} onChange={update} placeholder="Village, district or site" maxLength={200} />
          </label>
          <label className="field">
            <span>Record status</span>
            <select name="status" value={values.status || 'Preparing bid'} onChange={update}>
              <option>Not set</option><option>Preparing bid</option><option>Submitted</option>
              <option>Awarded</option><option>Not awarded</option><option>In progress</option>
              <option>Completed</option><option>Cancelled</option>
            </select>
          </label>
          <label className="field">
            <span>Work order number</span>
            <input className="uppercase-input" name="work_order_number" value={values.work_order_number} onChange={update} placeholder="Fill in when work is awarded" maxLength={120} />
          </label>
          <label className="field">
            <span>Tender / contract amount <b>*</b></span>
            <AmountInput name="bidding_amount" value={values.bidding_amount} onChange={updateAmount} required />
          </label>
          <label className="field">
            <span>Quoted rate</span>
            <AmountInput name="quoted_rate" value={values.quoted_rate} onChange={updateAmount} />
          </label>
          <label className="field">
            <span>Project rebate rate</span>
            <PercentInput name="rebate_percent" value={values.rebate_percent} onChange={updateAmount} />
          </label>
          <label className="field">
            <span>EMD / bid security</span>
            <AmountInput name="emd_amount" value={values.emd_amount} onChange={updateAmount} />
          </label>
          <label className="field">
            <span>Tender document fee</span>
            <AmountInput name="tender_fee" value={values.tender_fee} onChange={updateAmount} />
          </label>
          <label className="field">
            <span>Notice / tender date <b>*</b></span>
            <input type="date" name="tender_date" value={values.tender_date} onChange={update} required />
          </label>
          <label className="field">
            <span>Bid submission deadline</span>
            <input type="date" name="submission_deadline" value={values.submission_deadline} onChange={update} min={values.tender_date} />
          </label>
          <label className="field">
            <span>Planned completion date <b>*</b></span>
            <input type="date" name="completion_date" value={values.completion_date} onChange={update} min={values.submission_deadline || values.tender_date} required />
          </label>
          <label className="field">
            <span>Stipulated completion time</span>
            <div className="input-with-unit"><input type="number" name="stipulated_months" value={values.stipulated_months} onChange={update} min="0" max="1200" step="1" placeholder="e.g. 9" /><span>months</span></div>
          </label>
          <label className="field">
            <span>Date of allotment</span>
            <input type="date" name="allotment_date" value={values.allotment_date} onChange={update} />
          </label>
          {[1, 2, 3].map((number) => (
            <label className="field" key={`extension_date_${number}`}>
              <span>Project extension date {number}</span>
              <input type="date" name={`extension_date_${number}`} value={values[`extension_date_${number}`]} onChange={update} />
            </label>
          ))}
        </div>
      </details>

      <details className="tender-form-section accordion-section">
        <summary className="tender-form-heading accordion-heading">
          <span><strong>Bank guarantee details</strong><small>Record the guarantee, amount, validity and extensions</small></span>
        </summary>
        <div className="form-grid accordion-content">
          <label className="field"><span>Bank guarantee number</span><input className="uppercase-input" name="bank_guarantee_number" value={values.bank_guarantee_number} onChange={update} maxLength={120} /></label>
          <label className="field"><span>Bank guarantee amount</span><AmountInput name="bank_guarantee_amount" value={values.bank_guarantee_amount} onChange={updateAmount} /></label>
          <label className="field"><span>Date of issue</span><input type="date" name="bank_guarantee_issue_date" value={values.bank_guarantee_issue_date} onChange={update} /></label>
          <label className="field"><span>Date of expiry</span><input type="date" name="bank_guarantee_expiry_date" value={values.bank_guarantee_expiry_date} onChange={update} /></label>
          {[1, 2, 3].map((number) => (
            <label className="field" key={`bank_guarantee_extension_date_${number}`}>
              <span>Guarantee extension date {number}</span>
              <input type="date" name={`bank_guarantee_extension_date_${number}`} value={values[`bank_guarantee_extension_date_${number}`]} onChange={update} />
            </label>
          ))}
        </div>
      </details>

      <details className="tender-form-section accordion-section">
        <summary className="tender-form-heading accordion-heading">
          <span><strong>FDR details</strong><small>Record fixed deposit security and its related project insurance information</small></span>
        </summary>
        <div className="form-grid accordion-content">
          <label className="field"><span>FDR number</span><input className="uppercase-input" name="fdr_number" value={values.fdr_number} onChange={update} maxLength={120} /></label>
          <label className="field"><span>FDR amount</span><AmountInput name="fdr_amount" value={values.fdr_amount} onChange={updateAmount} /></label>
          <label className="field"><span>Bank / branch</span><input name="fdr_bank" value={values.fdr_bank} onChange={update} maxLength={120} placeholder="Bank holding the FDR" /></label>
          <label className="field"><span>FDR issue date</span><input type="date" name="fdr_issue_date" value={values.fdr_issue_date} onChange={update} /></label>
          <label className="field"><span>FDR maturity date</span><input type="date" name="fdr_maturity_date" value={values.fdr_maturity_date} onChange={update} /></label>
          <label className="field"><span>Insurance policy number</span><input className="uppercase-input" name="insurance_number" value={values.insurance_number} onChange={update} maxLength={120} /></label>
          <label className="field"><span>Insurance provider</span><input name="insurance_provider" value={values.insurance_provider} onChange={update} maxLength={120} placeholder="Insurer or issuing bank" /></label>
          <label className="field"><span>Insurance issue date</span><input type="date" name="insurance_issue_date" value={values.insurance_issue_date} onChange={update} /></label>
          <label className="field"><span>Insurance amount</span><AmountInput name="insurance_amount" value={values.insurance_amount} onChange={updateAmount} /></label>
          <label className="field"><span>Insurance payment release date</span><input type="date" name="insurance_payment_release_date" value={values.insurance_payment_release_date} onChange={update} /></label>
        </div>
      </details>
    </>
  );
}
