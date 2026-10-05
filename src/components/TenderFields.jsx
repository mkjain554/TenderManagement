import AmountInput from './AmountInput.jsx';

export default function TenderFields({ values, onChange }) {
  const update = (event) => onChange({ ...values, [event.target.name]: event.target.value });
  const updateAmount = (name, value) => onChange({ ...values, [name]: value });
  return (
    <>
      <section className="tender-form-section">
        <div className="tender-form-heading"><h3>Reference and work</h3><p>Use the tender number and department shown on the notice. The notice and contract documents remain the final reference.</p></div>
        <div className="form-grid">
          <label className="field">
            <span>Tender ID / NIT number</span>
            <input autoFocus name="tender_reference" value={values.tender_reference} onChange={update} placeholder="Number from the tender notice" maxLength={120} />
            <small>Official NIT / tender number from the notice. The app also creates its own record number.</small>
          </label>
          <label className="field">
            <span>Record status</span>
            <select name="status" value={values.status || 'Preparing bid'} onChange={update}>
              <option>Not set</option><option>Preparing bid</option><option>Submitted</option>
              <option>Awarded</option><option>Not awarded</option><option>In progress</option>
              <option>Completed</option><option>Cancelled</option>
            </select>
          </label>
          <label className="field field-wide">
            <span>Work / project name <b>*</b></span>
            <input name="tender_name" value={values.tender_name} onChange={update} placeholder="e.g. Repair of village access road" maxLength={200} required />
          </label>
          <label className="field">
            <span>Department / client</span>
            <input name="department" value={values.department} onChange={update} placeholder="e.g. Public Works Department" maxLength={200} />
          </label>
          <label className="field">
            <span>Work location</span>
            <input name="work_location" value={values.work_location} onChange={update} placeholder="Village, district or site" maxLength={200} />
          </label>
          <label className="field field-wide">
            <span>Work description</span>
            <textarea name="work_scope" value={values.work_scope} onChange={update} rows="3" maxLength={2000} placeholder="Briefly describe the work, for example road length, building or repair details." />
          </label>
        </div>
      </section>

      <section className="tender-form-section">
        <div className="tender-form-heading"><h3>Important dates</h3><p>Enter dates shown in the notice and contract documents.</p></div>
        <div className="form-grid">
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
            <span>Work order number</span>
            <input name="work_order_number" value={values.work_order_number} onChange={update} placeholder="Fill in when work is awarded" maxLength={120} />
          </label>
        </div>
      </section>

      <section className="tender-form-section">
        <div className="tender-form-heading"><h3>Amounts</h3><p>Amounts are in Indian rupees (₹). Enter zero if none applies.</p></div>
        <div className="form-grid">
          <label className="field">
            <span>Tender / contract amount <b>*</b></span>
            <AmountInput name="bidding_amount" value={values.bidding_amount} onChange={updateAmount} required />
            <small>Use your bid amount or awarded amount for this record.</small>
          </label>
          <label className="field">
            <span>EMD / bid security</span>
            <AmountInput name="emd_amount" value={values.emd_amount} onChange={updateAmount} />
          </label>
          <label className="field">
            <span>Tender document fee</span>
            <AmountInput name="tender_fee" value={values.tender_fee} onChange={updateAmount} />
          </label>
        </div>
      </section>
    </>
  );
}
