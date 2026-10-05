import { useEffect, useState } from 'react';
import { errorMessage, todayDate, useApi } from '../App.jsx';
import AppError from './ErrorNotice.jsx';
import AmountInput from './AmountInput.jsx';

const blankBill = () => ({
  bill_name: '',
  bill_date: todayDate(),
  description: '',
  hold_amount: '0',
  amount_received: '0',
});

export default function BillDialog({ tenderId, bill, onClose, onSaved }) {
  const api = useApi();
  const [values, setValues] = useState(bill ? { ...bill } : blankBill());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value });
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
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="bill-dialog-title">
        <div className="modal-heading">
          <div><p className="eyebrow">TENDER BILL</p><h2 id="bill-dialog-title">{bill ? 'Edit bill' : 'Add a bill'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <AppError>{error}</AppError>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field field-wide"><span>Bill name <b>*</b></span><input autoFocus name="bill_name" value={values.bill_name} onChange={update} maxLength={200} required placeholder="e.g. Foundation work — Bill 01" /></label>
            <label className="field field-wide"><span>Bill date <b>*</b></span><input type="date" name="bill_date" value={values.bill_date} onChange={update} required /></label>
            <label className="field field-wide"><span>Description</span><textarea name="description" value={values.description} onChange={update} rows="3" maxLength={2000} placeholder="Optional notes about this bill" /></label>
            <label className="field"><span>Hold amount</span><AmountInput name="hold_amount" value={values.hold_amount} onChange={updateAmount} /></label>
            <label className="field"><span>Amount received</span><AmountInput name="amount_received" value={values.amount_received} onChange={updateAmount} /></label>
          </div>
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
