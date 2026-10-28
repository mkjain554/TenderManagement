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
  const tenderResult = invoke('tenders:create', {
    tender_name: 'Fields integration tender',
    tender_date: '2026-01-01',
    completion_date: '2026-12-31',
    bidding_amount: '1000',
    emd_amount: '100',
    emd_refunded_amount: '50',
    emd_submission_date: '2026-01-02',
    emd_refund_received_date: '2026-02-03',
    project_names: ['Road'],
    bank_guarantees: [],
  });
  const tender = database.prepare('SELECT * FROM tenders WHERE id = ?').get(tenderResult.id);
  assert.equal(tender.emd_submission_date, '2026-01-02');
  assert.equal(tender.emd_refund_received_date, '2026-02-03');

  const billValues = {
    bill_name: 'Bill 2',
    previous_bill_number: 'Bill 1',
    previous_bill_amount: '25',
    project_name: 'Road',
    bill_date: '2026-03-01',
    hold_amount: '40',
    release_amount: '10',
    release_against: 'Certificate',
    escalation_adjustment_type: 'Add',
    escalation_adjustment_amount: '15',
    work_done_amount: '500',
  };
  const billResult = invoke('bills:create', tenderResult.id, billValues);
  let bill = database.prepare('SELECT * FROM bills WHERE id = ?').get(billResult.id);
  assert.equal(bill.previous_bill_number, 'Bill 1');
  assert.equal(bill.previous_bill_amount, 25);
  assert.equal(bill.release_amount, 10);
  assert.equal(bill.release_against, 'Certificate');
  assert.equal(bill.escalation_adjustment_type, 'Add');
  assert.equal(bill.escalation_adjustment_amount, 15);

  invoke('bills:update', billResult.id, { ...billValues, previous_bill_amount: '30' });
  bill = database.prepare('SELECT * FROM bills WHERE id = ?').get(billResult.id);
  assert.equal(bill.previous_bill_amount, 30);

  const completion = invoke('projects:complete', tenderResult.id, {
    project_name: 'Fields integration tender',
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
