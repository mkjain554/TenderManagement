export default function PercentInput({ name, value, onChange, placeholder = '0' }) {
  function update(event) {
    const typed = event.target.value.replace(/[^\d.]/g, '');
    const decimalAt = typed.indexOf('.');
    const normalized = decimalAt < 0
      ? typed
      : `${typed.slice(0, decimalAt)}.${typed.slice(decimalAt + 1).replace(/\./g, '').slice(0, 2)}`;
    onChange(name, normalized);
  }

  return (
    <div className="percent-input">
      <input
        type="text"
        inputMode="decimal"
        name={name}
        value={value ?? ''}
        onChange={update}
        placeholder={placeholder}
        aria-label={`${name.replaceAll('_', ' ')} percentage`}
      />
      <span>%</span>
    </div>
  );
}
