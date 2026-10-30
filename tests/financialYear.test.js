import assert from 'node:assert/strict';
import test from 'node:test';
import { financialYearOptions } from '../src/utils/financialYear.js';

test('lists financial years from 2020-21 through 2050-51', () => {
  const years = financialYearOptions();

  assert.equal(years.length, 31);
  assert.equal(years[0], '2050-51');
  assert.equal(years.at(-1), '2020-21');
});
