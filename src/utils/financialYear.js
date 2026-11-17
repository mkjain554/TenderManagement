export function financialYearForDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function financialYearOptions() {
  return Array.from({ length: 31 }, (_, index) => {
    const startYear = 2050 - index;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  });
}
