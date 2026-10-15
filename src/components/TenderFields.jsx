import AmountInput from './AmountInput.jsx';
import PercentInput from './PercentInput.jsx';

const uppercaseFields = new Set([
  'tender_reference',
  'work_code',
  'work_order_number',
]);

export default function TenderFields({ values, onChange }) {
  const update = (event) => {
    const { name, value } = event.target;
    onChange({ ...values, [name]: uppercaseFields.has(name) ? value.toUpperCase() : value });
  };
  const updateAmount = (name, value) => onChange({ ...values, [name]: value });
  const updateGuarantee = (index, name, value) => onChange({
    ...values,
    bank_guarantees: values.bank_guarantees.map((guarantee, guaranteeIndex) => (
      guaranteeIndex === index
        ? { ...guarantee, [name]: ['bank_guarantee_number', 'security_instrument_number'].includes(name) ? value.toUpperCase() : value }
        : guarantee
    )),
  });

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
            <span>Tender name <b>*</b></span>
            <input name="tender_name" value={values.tender_name} onChange={update} placeholder="Name of the overall tender" maxLength={200} required />
          </label>
          <div className="field field-wide project-names-field">
            <span>Project names <b>*</b></span>
            <div className="project-name-list">
              {(values.project_names || ['']).map((projectName, index) => (
                <div className="project-name-row" key={index}>
                  <input
                    aria-label={`Project name ${index + 1}`}
                    value={projectName}
                    onChange={(event) => onChange({
                      ...values,
                      project_names: values.project_names.map((name, projectIndex) => projectIndex === index ? event.target.value : name),
                    })}
                    placeholder="e.g. Repair of village access road"
                    maxLength={200}
                    required
                  />
                  {values.project_names.length > 1 && <button type="button" className="project-remove-button" onClick={() => onChange({
                    ...values,
                    project_names: values.project_names.filter((_, projectIndex) => projectIndex !== index),
                  })} aria-label={`Remove project name ${index + 1}`}>×</button>}
                </div>
              ))}
            </div>
            <button type="button" className="button button-light button-small project-add-button" onClick={() => onChange({
              ...values,
              project_names: [...values.project_names, ''],
            })}>＋ Add project</button>
          </div>
          <label className="field field-wide">
            <span>Description of project / work</span>
            <textarea name="work_scope" value={values.work_scope} onChange={update} rows="3" maxLength={2000} placeholder="Describe the work, site, or project scope." />
          </label>
          <label className="gst-checkbox">
            <input type="checkbox" name="apply_gst" checked={Boolean(values.apply_gst)} onChange={(event) => onChange({ ...values, apply_gst: event.target.checked })} />
            <span><strong>Apply GST</strong><small>Include CGST and SGST in bill calculations.</small></span>
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
            <span>EMD refund received</span>
            <AmountInput name="emd_refunded_amount" value={values.emd_refunded_amount} onChange={updateAmount} />
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
          <span><strong>Bank guarantee and FDR / Insurance details</strong><small>Record each guarantee with its linked security instrument and release dates</small></span>
        </summary>
        <div className="accordion-content">
          <div className="guarantee-records">
            {values.bank_guarantees.map((guarantee, index) => (
              <section className="guarantee-record" key={index}>
                <div className="guarantee-record-heading">
                  <h3>Guarantee {index + 1}</h3>
                  {values.bank_guarantees.length > 1 && <button type="button" className="project-remove-button" onClick={() => onChange({
                    ...values,
                    bank_guarantees: values.bank_guarantees.filter((_, guaranteeIndex) => guaranteeIndex !== index),
                  })} aria-label={`Remove guarantee ${index + 1}`}>×</button>}
                </div>
                <div className="form-grid">
                  <label className="field"><span>Bank guarantee number</span><input className="uppercase-input" value={guarantee.bank_guarantee_number} onChange={(event) => updateGuarantee(index, 'bank_guarantee_number', event.target.value)} maxLength={120} /></label>
                  <label className="field"><span>Bank guarantee amount</span><AmountInput name={`bank_guarantee_amount_${index}`} value={guarantee.bank_guarantee_amount} onChange={(_, value) => updateGuarantee(index, 'bank_guarantee_amount', value)} /></label>
                  <label className="field"><span>Date of issue</span><input type="date" value={guarantee.bank_guarantee_issue_date} onChange={(event) => updateGuarantee(index, 'bank_guarantee_issue_date', event.target.value)} /></label>
                  <label className="field"><span>Date of expiry</span><input type="date" value={guarantee.bank_guarantee_expiry_date} onChange={(event) => updateGuarantee(index, 'bank_guarantee_expiry_date', event.target.value)} /></label>
                  {[1, 2, 3].map((number) => (
                    <label className="field" key={`bank_guarantee_extension_date_${number}`}>
                      <span>Guarantee extension date {number}</span>
                      <input type="date" value={guarantee[`bank_guarantee_extension_date_${number}`]} onChange={(event) => updateGuarantee(index, `bank_guarantee_extension_date_${number}`, event.target.value)} />
                    </label>
                  ))}
                  <label className="field"><span>Released date</span><input type="date" value={guarantee.bank_guarantee_released_date} onChange={(event) => updateGuarantee(index, 'bank_guarantee_released_date', event.target.value)} /></label>
                  <div className="field-wide guarantee-fdr-label">FDR / Insurance</div>
                  <label className="field"><span>FDR / Insurance number</span><input className="uppercase-input" value={guarantee.security_instrument_number} onChange={(event) => updateGuarantee(index, 'security_instrument_number', event.target.value)} maxLength={120} /></label>
                  <label className="field"><span>FDR / Insurance amount</span><AmountInput name={`security_instrument_amount_${index}`} value={guarantee.security_instrument_amount} onChange={(_, value) => updateGuarantee(index, 'security_instrument_amount', value)} /></label>
                  <label className="field"><span>Bank / provider</span><input value={guarantee.security_instrument_institution} onChange={(event) => updateGuarantee(index, 'security_instrument_institution', event.target.value)} maxLength={120} placeholder="Bank or insurance provider" /></label>
                  <label className="field"><span>Issue date</span><input type="date" value={guarantee.security_instrument_issue_date} onChange={(event) => updateGuarantee(index, 'security_instrument_issue_date', event.target.value)} /></label>
                  <label className="field"><span>Maturity / expiry date</span><input type="date" value={guarantee.security_instrument_maturity_date} onChange={(event) => updateGuarantee(index, 'security_instrument_maturity_date', event.target.value)} /></label>
                  <label className="field"><span>FDR / Insurance release date</span><input type="date" value={guarantee.security_instrument_release_date} onChange={(event) => updateGuarantee(index, 'security_instrument_release_date', event.target.value)} /></label>
                </div>
              </section>
            ))}
          </div>
          <button type="button" className="button button-light button-small guarantee-add-button" onClick={() => onChange({
            ...values,
            bank_guarantees: [...values.bank_guarantees, {
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
            }],
          })}>＋ Add bank guarantee</button>
        </div>
      </details>
    </>
  );
}
