export function financialYearForDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function financialYearOptions(currentDate = new Date()) {
  const currentStartYear = Number(financialYearForDate(currentDate).slice(0, 4));
  return Array.from({ length: currentStartYear - 1999 + 5 }, (_, index) => {
    const startYear = currentStartYear + 3 - index;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  });
}
