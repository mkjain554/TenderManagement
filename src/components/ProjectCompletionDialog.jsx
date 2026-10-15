import { useEffect, useMemo, useState } from 'react';
import { errorMessage, money, useApi } from '../App.jsx';
import AmountInput from './AmountInput.jsx';
import ErrorNotice from './ErrorNotice.jsx';
import { calculateBill } from '../utils/billing.js';

function numericAmount(value) {
  return Number(String(value ?? 0).replaceAll(',', '')) || 0;
}

export default function ProjectCompletionDialog({ tenderId, tenderName, completions, applyGst, onClose, onSaved }) {
  const api = useApi();
  const existing = useMemo(
    () => completions.find((completion) => completion.project_name === tenderName),
    [completions, tenderName],
  );
  const [securityAmount, setSecurityAmount] = useState(0);
  const [values, setValues] = useState({ security_refund: '0', balance_security: '0', remark: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.bills.getStatement(tenderId)
      .then((bills) => {
        let total = 0;
        for (const bill of bills) {
          if (bill.bill_type !== 'Construction bill') continue;
          total += calculateSecurityAmount(bill, applyGst);
        }
        if (active) setSecurityAmount(total);
      })
      .catch((loadError) => active && setError(errorMessage(loadError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [api, applyGst, tenderId]);

  useEffect(() => {
    setValues(existing
      ? {
        security_refund: String(existing.security_refund),
        balance_security: String(existing.balance_security),
        remark: existing.remark || '',
      }
      : { security_refund: '0', balance_security: String(securityAmount), remark: '' });
  }, [existing, securityAmount]);

  function updateRefund(value) {
    const refund = numericAmount(value);
    setValues((current) => ({
      ...current,
      security_refund: value,
      balance_security: String(Math.max(0, securityAmount - refund)),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.projects.complete(tenderId, {
        project_name: tenderName,
        security_amount: securityAmount,
        security_refund: numericAmount(values.security_refund),
        balance_security: numericAmount(values.balance_security),
        remark: values.remark,
      });
      onSaved(result);
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="modal-card project-completion-dialog" role="dialog" aria-modal="true" aria-labelledby="project-completion-title">
        <div className="modal-heading">
          <div><p className="eyebrow">TENDER CLOSEOUT</p><h2 id="project-completion-title">Complete tender</h2><p className="page-description">Record the security refund, remaining balance and closeout documents.</p></div>
          <button className="icon-button" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </div>
        <ErrorNotice>{error}</ErrorNotice>
        {loading ? <div className="loading-state">Calculating project security…</div> : (
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="field field-wide">
                <span>Tender</span>
                <input value={tenderName} readOnly aria-readonly="true" />
              </label>
              <label className="field">
                <span>Security amount</span>
                <input value={money(securityAmount)} readOnly aria-readonly="true" />
                <small>Total Security deductions from this tender's saved Construction bills.</small>
              </label>
              <label className="field">
                <span>Security refund</span>
                <AmountInput name="security_refund" value={values.security_refund} onChange={(_, value) => updateRefund(value)} />
              </label>
              <label className="field">
                <span>Balance security</span>
                <AmountInput name="balance_security" value={values.balance_security} onChange={(_, value) => setValues((current) => ({ ...current, balance_security: value }))} />
                <small>Defaults to security amount less refund; you can adjust it.</small>
              </label>
              <label className="field field-wide">
                <span>Remark</span>
                <textarea value={values.remark} onChange={(event) => setValues((current) => ({ ...current, remark: event.target.value }))} rows="3" maxLength={2000} placeholder="Add project closeout notes" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-light" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : existing ? 'Update completion & add documents' : 'Complete tender & add documents'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function calculateSecurityAmount(bill, applyGst) {
  return calculateBill(bill, applyGst).deductions.find(({ label }) => label === 'Security')?.amount || 0;
}
