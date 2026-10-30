const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { createDatabase } = require('../electron/database.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tender-desk-fields-test-'));
const handlers = new Map();
const electronMock = {
  app: { getPath: () => root },
  dialog: {},
  shell: {},
  ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'electron') return electronMock;
  return originalLoad.call(this, request, parent, isMain);
};
const { registerIpc } = require('../electron/ipc.cjs');
Module._load = originalLoad;

const dataDirectory = path.join(root, 'data');
const database = createDatabase(dataDirectory);
registerIpc(database, dataDirectory);

function invoke(channel, ...args) {
  const handler = handlers.get(channel);
  assert.ok(handler, `Expected registered IPC handler for ${channel}`);
  return handler({}, ...args);
}

try {
  const longTenderName = `Fields integration tender ${'x'.repeat(474)}`;
  const tenderValues = {
    tender_name: longTenderName,
    tender_date: '2026-01-01',
    completion_date: '2026-12-31',
    status: 'Awarded',
    bidding_amount: '1000',
    emd_amount: '100',
    emd_refunded_amount: '50',
    emd_submission_date: '2026-01-02',
    emd_refund_received_date: '2026-02-03',
    project_names: ['Road'],
    bank_guarantees: [{
      security_instrument_type: 'Insurance',
      security_instrument_number: 'INS-2026',
      security_instrument_amount: 75,
      security_instrument_release_date: '2026-06-01',
    }],
  };
  assert.equal(longTenderName.trim().length, 500);
  const tenderResult = invoke('tenders:create', tenderValues);
  const tender = database.prepare('SELECT * FROM tenders WHERE id = ?').get(tenderResult.id);
  assert.equal(tender.tender_name, longTenderName);
  const updatedLongTenderName = `Updated integration tender ${'y'.repeat(473)}`;
  assert.equal(updatedLongTenderName.length, 500);
  invoke('tenders:update', tenderResult.id, { ...tenderValues, tender_name: updatedLongTenderName });
  assert.equal(database.prepare('SELECT tender_name FROM tenders WHERE id = ?').get(tenderResult.id).tender_name, updatedLongTenderName);
  assert.throws(() => invoke('tenders:update', tenderResult.id, {
    ...tenderValues,
    tender_name: `${updatedLongTenderName}x`,
  }), /Tender name must be at most 500 characters/);
  assert.equal(tender.emd_submission_date, '2026-01-02');
  assert.equal(tender.emd_refund_received_date, '2026-02-03');
  const instrument = database.prepare('SELECT * FROM tender_bank_guarantees WHERE tender_id = ?').get(tenderResult.id);
  assert.equal(instrument.security_instrument_type, 'Insurance');
  assert.equal(instrument.security_instrument_number, 'INS-2026');
  assert.equal(instrument.security_instrument_release_date, '2026-06-01');

  const billValues = {
    bill_name: 'Bill 2',
    previous_bill_number: 'Bill 1',
    previous_bill_amount: '25',
    project_name: 'Road',
    bill_date: '2026-03-01',
    financial_year: '2024-25',
    hold_amount: '40',
    release_amount: '10',
    release_against: 'Certificate',
    release_date: '2026-06-05',
    release_remark: 'Release after verification',
    escalation_adjustment_type: 'Add',
    escalation_adjustment_amount: '15',
    escalation_type: 'Add',
    escalation_amount: '20',
    work_done_amount: '500',
    rebate_percent: '2',
    rebate_include_escalation: 'Exclude',
  };
  const billResult = invoke('bills:create', tenderResult.id, billValues);
  let bill = database.prepare('SELECT * FROM bills WHERE id = ?').get(billResult.id);
  assert.equal(bill.previous_bill_number, 'Bill 1');
  assert.equal(bill.previous_bill_amount, 25);
  assert.equal(bill.release_amount, 10);
  assert.equal(bill.release_against, 'Certificate');
  assert.equal(bill.financial_year, '2024-25');
  assert.equal(bill.release_date, '2026-06-05');
  assert.equal(bill.release_remark, 'Release after verification');
  assert.equal(bill.escalation_adjustment_type, 'Add');
  assert.equal(bill.escalation_adjustment_amount, 15);
  assert.equal(bill.rebate_include_escalation, 'Exclude');
  assert.equal(bill.culture_cess_percent, 5);

  invoke('bills:update', billResult.id, {
    ...billValues,
    previous_bill_amount: '30',
    release_date: '2026-06-06',
    release_remark: 'Updated release remark',
  });
  bill = database.prepare('SELECT * FROM bills WHERE id = ?').get(billResult.id);
  assert.equal(bill.previous_bill_amount, 30);
  assert.equal(bill.release_date, '2026-06-06');
  assert.equal(bill.release_remark, 'Updated release remark');

  const financialYearTenders = invoke('tenders:list', {
    financialYear: '2024-25',
    page: 1,
  });
  assert.equal(financialYearTenders.total, 1);
  assert.equal(financialYearTenders.rows[0].total_gross, 520.48);
  assert.equal(financialYearTenders.summary.total_gross, 520.48);
  invoke('bills:update', billResult.id, {
    ...billValues,
    previous_bill_amount: '30',
    release_date: '2026-06-06',
    release_remark: 'Updated release remark',
    rebate_include_escalation: 'Include',
  });
  bill = database.prepare('SELECT * FROM bills WHERE id = ?').get(billResult.id);
  assert.equal(bill.rebate_include_escalation, 'Include');
  const includedRebateTender = invoke('tenders:list', {
    financialYear: '2024-25',
    page: 1,
  });
  assert.equal(includedRebateTender.rows[0].total_gross, 520.08);
  assert.throws(() => invoke('tenders:list', { financialYear: '2024/25' }), /valid Financial Year/);

  const completion = invoke('projects:complete', tenderResult.id, {
    project_name: updatedLongTenderName,
    security_amount: 80,
    security_refund: 20,
    security_refund_2: 10,
    security_refund_date_1: '2026-04-01',
    security_refund_date_2: '2026-05-01',
    balance_security: 50,
  });
  const completionRow = database.prepare('SELECT * FROM project_completions WHERE id = ?').get(completion.id);
  assert.equal(completionRow.security_refund, 20);
  assert.equal(completionRow.security_refund_2, 10);
  assert.equal(completionRow.security_refund_date_1, '2026-04-01');
  assert.equal(completionRow.security_refund_date_2, '2026-05-01');
} finally {
  database.close();
  fs.rmSync(root, { recursive: true, force: true });
}
