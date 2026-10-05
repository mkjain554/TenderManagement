const { ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { verifyPassword } = require('./database.cjs');
const { createFileManager } = require('./fileManager.cjs');

function assertText(value, label, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function assertDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a valid date.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
}

function assertAmount(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000_000) {
    throw new Error(`${label} must be a non-negative valid amount.`);
  }
  return number;
}

function optionalText(value, label, maxLength) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalDate(value, label) {
  if (value == null || value === '') return '';
  return assertDate(value, label);
}

function validateTender(values) {
  const tenderDate = assertDate(values?.tender_date, 'Tender date');
  const completionDate = assertDate(values?.completion_date, 'Completion date');
  const submissionDeadline = optionalDate(values?.submission_deadline, 'Bid submission deadline');
  if (completionDate < tenderDate) throw new Error('Completion date cannot be before tender date.');
  if (submissionDeadline && submissionDeadline < tenderDate) {
    throw new Error('Bid submission deadline cannot be before the tender notice date.');
  }
  if (submissionDeadline && completionDate < submissionDeadline) {
    throw new Error('Planned completion date cannot be before the bid submission deadline.');
  }
  const statuses = ['Not set', 'Preparing bid', 'Submitted', 'Awarded', 'Not awarded', 'In progress', 'Completed', 'Cancelled'];
  const status = values?.status || 'Preparing bid';
  if (!statuses.includes(status)) throw new Error('Choose a valid tender status.');
  return {
    tender_name: assertText(values?.tender_name, 'Tender name'),
    tender_date: tenderDate,
    completion_date: completionDate,
    bidding_amount: assertAmount(values?.bidding_amount, 'Bidding amount'),
    tender_reference: optionalText(values?.tender_reference, 'Tender ID / NIT number', 120),
    department: optionalText(values?.department, 'Department / client', 200),
    work_location: optionalText(values?.work_location, 'Work location', 200),
    work_scope: optionalText(values?.work_scope, 'Work description', 2000),
    submission_deadline: submissionDeadline || null,
    emd_amount: assertAmount(values?.emd_amount ?? 0, 'EMD amount'),
    tender_fee: assertAmount(values?.tender_fee ?? 0, 'Tender fee'),
    work_order_number: optionalText(values?.work_order_number, 'Work order number', 120),
    status,
  };
}

function validateBill(values) {
  return {
    bill_name: assertText(values?.bill_name, 'Bill name'),
    bill_date: assertDate(values?.bill_date, 'Bill date'),
    description: typeof values?.description === 'string' ? values.description.trim().slice(0, 2000) : '',
    hold_amount: assertAmount(values?.hold_amount ?? 0, 'Hold amount'),
    amount_received: assertAmount(values?.amount_received ?? 0, 'Amount received'),
  };
}

function nextId(db, prefix) {
  const sequenceName = prefix === 'TND' ? 'tender' : 'bill';
  return db.transaction(() => {
    const row = db.prepare('SELECT value FROM sequences WHERE name = ?').get(sequenceName);
    const value = (row?.value ?? 0) + 1;
    db.prepare(`
      INSERT INTO sequences (name, value) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET value = excluded.value
    `).run(sequenceName, value);
    return `${prefix}-${String(value).padStart(6, '0')}`;
  })();
}

function registerIpc(db, dataDirectory) {
  const files = createFileManager(db, dataDirectory);
  const handlers = {
    'auth:login': (_event, username, password) => {
      const name = assertText(username, 'Username', 80);
      if (typeof password !== 'string' || password.length > 200) throw new Error('Invalid username or password.');
      const user = verifyPassword(db, name, password);
      if (!user) throw new Error('Invalid username or password.');
      return user;
    },
    'tenders:list': (_event, options = {}) => {
      const page = Math.max(1, Math.floor(Number(options.page) || 1));
      const pageSize = Math.min(50, Math.max(1, Math.floor(Number(options.pageSize) || 20)));
      const search = typeof options.search === 'string' ? options.search.trim().slice(0, 200) : '';
      const filter = ['all', 'active', 'completed', 'upcoming'].includes(options.filter) ? options.filter : 'all';
      const date = new Date();
      const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const conditions = [];
      const parameters = [];
      if (search) {
        conditions.push(`(t.tender_name LIKE ? OR t.id LIKE ? OR t.tender_reference LIKE ?
          OR t.department LIKE ? OR t.work_location LIKE ? OR t.work_order_number LIKE ?)`);
        parameters.push(...Array(6).fill(`%${search}%`));
      }
      if (filter === 'active') {
        conditions.push('t.completion_date >= ? AND t.tender_date <= ?');
        parameters.push(today, today);
      } else if (filter === 'completed') {
        conditions.push('t.completion_date < ?');
        parameters.push(today);
      } else if (filter === 'upcoming') {
        conditions.push('t.tender_date > ?');
        parameters.push(today);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = db.prepare(`SELECT COUNT(*) AS total FROM tenders t ${where}`).get(...parameters).total;
      const summary = db.prepare(`
        SELECT COALESCE(SUM(bidding_amount), 0) AS total_value,
          COALESCE(SUM(total_received), 0) AS total_received,
          COALESCE(SUM(total_hold), 0) AS total_hold,
          COALESCE(SUM(MAX(0, bidding_amount - total_received)), 0) AS total_pending
        FROM (
          SELECT t.bidding_amount,
            COALESCE((SELECT SUM(b.amount_received) FROM bills b WHERE b.tender_id = t.id), 0) AS total_received,
            COALESCE((SELECT SUM(b.hold_amount) FROM bills b WHERE b.tender_id = t.id), 0) AS total_hold
          FROM tenders t ${where}
        )
      `).get(...parameters);
      const rows = db.prepare(`
        SELECT t.id, t.tender_name, t.tender_reference, t.department, t.status,
          t.tender_date, t.submission_deadline, t.completion_date, t.bidding_amount,
          (SELECT COUNT(*) FROM bills b WHERE b.tender_id = t.id) AS bill_count,
          COALESCE((SELECT SUM(b.amount_received) FROM bills b WHERE b.tender_id = t.id), 0) AS total_received,
          COALESCE((SELECT SUM(b.hold_amount) FROM bills b WHERE b.tender_id = t.id), 0) AS total_hold
        FROM tenders t ${where}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ? OFFSET ?
      `).all(...parameters, pageSize, (page - 1) * pageSize);
      return { rows, total: count, summary, page, pageSize };
    },
    'tenders:getById': (_event, id) => {
      const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(assertText(id, 'Tender ID', 80));
      if (!tender) throw new Error('Tender not found.');
      tender.files = db.prepare('SELECT id, short_name, file_name, created_at FROM tender_files WHERE tender_id = ? ORDER BY created_at').all(id);
      const totals = db.prepare(`
        SELECT COUNT(*) AS bill_count, COALESCE(SUM(hold_amount), 0) AS total_hold,
          COALESCE(SUM(amount_received), 0) AS total_received
        FROM bills WHERE tender_id = ?
      `).get(id);
      return { ...tender, ...totals, outstanding: Math.max(0, tender.bidding_amount - totals.total_received) };
    },
    'tenders:create': (_event, values) => {
      const tender = validateTender(values);
      const id = nextId(db, 'TND');
      try {
        fs.mkdirSync(path.join(dataDirectory, 'tenders', id, 'documents'), { recursive: true });
        db.prepare(`
          INSERT INTO tenders (
            id, tender_name, tender_date, completion_date, bidding_amount, tender_reference,
            department, work_location, work_scope, submission_deadline, emd_amount, tender_fee,
            work_order_number, status
          )
          VALUES (
            @id, @tender_name, @tender_date, @completion_date, @bidding_amount, @tender_reference,
            @department, @work_location, @work_scope, @submission_deadline, @emd_amount, @tender_fee,
            @work_order_number, @status
          )
        `).run({ ...tender, id });
      } catch (error) {
        fs.rmSync(path.join(dataDirectory, 'tenders', id), { recursive: true, force: true });
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('A tender with this name already exists.');
        throw new Error(`Could not create tender: ${error.message}`);
      }
      return { id };
    },
    'tenders:update': (_event, id, values) => {
      const tender = validateTender(values);
      try {
        const result = db.prepare(`
          UPDATE tenders SET tender_name = @tender_name, tender_date = @tender_date,
            completion_date = @completion_date, bidding_amount = @bidding_amount,
            tender_reference = @tender_reference, department = @department,
            work_location = @work_location, work_scope = @work_scope,
            submission_deadline = @submission_deadline, emd_amount = @emd_amount,
            tender_fee = @tender_fee, work_order_number = @work_order_number, status = @status,
            updated_at = CURRENT_TIMESTAMP WHERE id = @id
        `).run({ ...tender, id: assertText(id, 'Tender ID', 80) });
        if (!result.changes) throw new Error('Tender not found.');
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('A tender with this name already exists.');
        throw error;
      }
      return true;
    },
    'tenders:delete': (_event, id) => {
      const tender = db.prepare('SELECT id FROM tenders WHERE id = ?').get(assertText(id, 'Tender ID', 80));
      if (!tender) throw new Error('Tender not found.');
      files.removeTenderFolder(id);
      db.prepare('DELETE FROM tenders WHERE id = ?').run(id);
      return true;
    },
    'bills:list': (_event, tenderId, options = {}) => {
      const id = assertText(tenderId, 'Tender ID', 80);
      if (!db.prepare('SELECT id FROM tenders WHERE id = ?').get(id)) throw new Error('Tender not found.');
      const page = Math.max(1, Math.floor(Number(options.page) || 1));
      const pageSize = Math.min(50, Math.max(1, Math.floor(Number(options.pageSize) || 10)));
      const total = db.prepare('SELECT COUNT(*) AS total FROM bills WHERE tender_id = ?').get(id).total;
      const rows = db.prepare(`
        SELECT b.id, b.bill_name, b.bill_date, b.description, b.hold_amount, b.amount_received,
          (SELECT COUNT(*) FROM bill_files f WHERE f.bill_id = b.id) AS file_count
        FROM bills b WHERE b.tender_id = ?
        ORDER BY b.bill_date DESC, b.created_at DESC
        LIMIT ? OFFSET ?
      `).all(id, pageSize, (page - 1) * pageSize);
      for (const bill of rows) {
        bill.files = db.prepare('SELECT id, short_name, file_name, created_at FROM bill_files WHERE bill_id = ? ORDER BY created_at').all(bill.id);
      }
      return { rows, total, page, pageSize };
    },
    'bills:getStatement': (_event, tenderId) => {
      const id = assertText(tenderId, 'Tender ID', 80);
      if (!db.prepare('SELECT id FROM tenders WHERE id = ?').get(id)) throw new Error('Tender not found.');
      return db.prepare(`
        SELECT id, bill_name, bill_date, description, hold_amount, amount_received
        FROM bills
        WHERE tender_id = ?
        ORDER BY bill_date ASC, created_at ASC
      `).all(id);
    },
    'bills:create': (_event, tenderId, values) => {
      const parent = assertText(tenderId, 'Tender ID', 80);
      if (!db.prepare('SELECT id FROM tenders WHERE id = ?').get(parent)) throw new Error('Tender not found.');
      const bill = validateBill(values);
      const id = nextId(db, 'BILL');
      try {
        fs.mkdirSync(path.join(dataDirectory, 'tenders', parent, 'bills', id), { recursive: true });
        db.prepare(`
          INSERT INTO bills (id, tender_id, bill_name, bill_date, description, hold_amount, amount_received)
          VALUES (@id, @tender_id, @bill_name, @bill_date, @description, @hold_amount, @amount_received)
        `).run({ ...bill, id, tender_id: parent });
      } catch (error) {
        fs.rmSync(path.join(dataDirectory, 'tenders', parent, 'bills', id), { recursive: true, force: true });
        throw new Error(`Could not create bill: ${error.message}`);
      }
      return { id };
    },
    'bills:update': (_event, id, values) => {
      const bill = validateBill(values);
      const result = db.prepare(`
        UPDATE bills SET bill_name = @bill_name, bill_date = @bill_date, description = @description,
          hold_amount = @hold_amount, amount_received = @amount_received,
          updated_at = CURRENT_TIMESTAMP WHERE id = @id
      `).run({ ...bill, id: assertText(id, 'Bill ID', 80) });
      if (!result.changes) throw new Error('Bill not found.');
      return true;
    },
    'bills:delete': (_event, id) => {
      const bill = db.prepare('SELECT id, tender_id FROM bills WHERE id = ?').get(assertText(id, 'Bill ID', 80));
      if (!bill) throw new Error('Bill not found.');
      files.removeBillFolder(bill.tender_id, bill.id);
      db.prepare('DELETE FROM bills WHERE id = ?').run(id);
      return true;
    },
    'files:selectTender': (_event, tenderId) => files.selectTenderFiles(assertText(tenderId, 'Tender ID', 80)),
    'files:selectBill': (_event, billId) => files.selectBillFiles(assertText(billId, 'Bill ID', 80)),
    'files:saveSelected': (_event, ownerId, token, shortName) => files.saveSelectedFile(
      assertText(ownerId, 'Tender or bill ID', 80),
      assertText(token, 'File selection', 80),
      shortName,
    ),
    'files:discardSelected': (_event, token) => files.discardSelectedFile(assertText(token, 'File selection', 80)),
    'files:remove': (_event, fileId) => files.remove(assertText(fileId, 'File ID', 80)),
    'files:open': (_event, fileId) => files.open(assertText(fileId, 'File ID', 80)),
    'files:download': (_event, fileId) => files.download(assertText(fileId, 'File ID', 80)),
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      try {
        return handler(event, ...args);
      } catch (error) {
        console.error(`[${channel}]`, error);
        throw error;
      }
    });
  }
}

module.exports = { registerIpc };
