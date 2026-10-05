const ones = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const indianGroups = ['', 'thousand', 'lakh', 'crore', 'arab', 'kharab', 'neel', 'padma'];

function twoDigitWords(value) {
  if (value < 20) return ones[value];
  return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`;
}

function integerWords(value) {
  if (value === 0n) return 'zero';

  let number = value;
  const groups = [];
  groups.push(Number(number % 1000n));
  number /= 1000n;

  while (number > 0n) {
    groups.push(Number(number % 100n));
    number /= 100n;
  }

  const parts = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) continue;
    const words = index === 0 && group >= 100
      ? `${ones[Math.floor(group / 100)]} hundred${group % 100 ? ` ${twoDigitWords(group % 100)}` : ''}`
      : twoDigitWords(group);
    parts.push(`${words}${indianGroups[index] ? ` ${indianGroups[index]}` : ''}`);
  }
  return parts.join(' ');
}

export function formatAmountInput(value) {
  const amount = String(value ?? '').replace(/,/g, '');
  if (!amount || !/^\d*(\.\d*)?$/.test(amount)) return amount;

  const [integerPart, decimalPart] = amount.split('.');
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || (amount.startsWith('.') ? '0' : '');
  const groupedInteger = normalizedInteger.length > 3
    ? `${normalizedInteger.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${normalizedInteger.slice(-3)}`
    : normalizedInteger;
  return decimalPart === undefined ? groupedInteger : `${groupedInteger}.${decimalPart}`;
}

export function sanitizeAmountInput(value) {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  const decimalAt = cleaned.indexOf('.');
  if (decimalAt === -1) return cleaned;
  const integerPart = cleaned.slice(0, decimalAt);
  const decimalPart = cleaned.slice(decimalAt + 1).replace(/\./g, '').slice(0, 2);
  return `${integerPart || '0'}.${decimalPart}`;
}

export function amountInWords(value) {
  const amount = String(value ?? '').replace(/,/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(amount)) return 'Enter an amount to see it in words';

  const [rupeesPart, paisePart = ''] = amount.split('.');
  const rupees = BigInt(rupeesPart);
  const paise = Number(paisePart.padEnd(2, '0'));
  const rupeeText = integerWords(rupees);
  const currency = `${rupeeText} rupee${rupees === 1n ? '' : 's'}`;
  const paiseText = paise ? ` and ${integerWords(BigInt(paise))} paise` : '';
  const result = `${currency}${paiseText} only`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}
