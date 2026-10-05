import { useLayoutEffect, useRef } from 'react';
import { amountInWords, formatAmountInput, sanitizeAmountInput } from '../utils/amounts.js';

export default function AmountInput({ name, value, onChange, required = false, placeholder = '0.00' }) {
  const inputRef = useRef(null);
  const caretPosition = useRef(null);
  const formattedValue = formatAmountInput(value);

  useLayoutEffect(() => {
    if (caretPosition.current === null || !inputRef.current) return;
    let position = 0;
    let characters = 0;
    while (position < formattedValue.length && characters < caretPosition.current) {
      if (formattedValue[position] !== ',') characters += 1;
      position += 1;
    }
    inputRef.current.setSelectionRange(position, position);
    caretPosition.current = null;
  }, [formattedValue]);

  function update(event) {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? input.value.length;
    caretPosition.current = input.value.slice(0, caret).replace(/,/g, '').length;
    onChange(name, sanitizeAmountInput(input.value));
  }

  return (
    <>
      <div className="amount-input">
        <span>₹</span>
        <input
          ref={inputRef}
          type="text"
          name={name}
          inputMode="decimal"
          autoComplete="off"
          value={formattedValue}
          onChange={update}
          placeholder={placeholder}
          required={required}
          aria-describedby={`${name}-words`}
        />
      </div>
      <small className="amount-words" id={`${name}-words`} aria-live="polite">
        In words: {amountInWords(value)}
      </small>
    </>
  );
}
