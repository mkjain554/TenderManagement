const { ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifyPassword } = require('./database.cjs');
const { createFileManager } = require('./fileManager.cjs');
const { createBackupManager } = require('./backupRestore.cjs');

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

function assertPercent(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error(`${label} must be between 0 and 100%.`);
  }
  return number;
}

function assertMonths(value, label) {
  const months = Number(value ?? 0);
  if (!Number.isInteger(months) || months < 0 || months > 1200) {
    throw new Error(`${label} must be a whole number of months between 0 and 1200.`);
  }
  return months;
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
  const tenderName = assertText(values?.tender_name, 'Tender name');
  const projectNames = Array.isArray(values?.project_names)
    ? values.project_names.map((name, index) => assertText(name, `Project name ${index + 1}`, 200))
    : [tenderName];
  if (projectNames.length === 0 || projectNames.length > 50) {
    throw new Error('Add between 1 and 50 project names.');
  }
  if (new Set(projectNames.map((name) => name.toLocaleLowerCase())).size !== projectNames.length) {
    throw new Error('Project names must be unique within a tender.');
  }
  if (![true, false, 0, 1].includes(values?.apply_gst ?? false)) {
    throw new Error('Choose whether GST applies to this tender.');
  }
  const emdAmount = assertAmount(values?.emd_amount ?? 0, 'EMD amount');
  const emdRefundedAmount = assertAmount(values?.emd_refunded_amount ?? 0, 'EMD refund received');
  if (emdRefundedAmount > emdAmount) throw new Error('EMD refund received cannot exceed the EMD amount.');
  if (!Array.isArray(values?.bank_guarantees) || values.bank_guarantees.length > 50) {
    throw new Error('Bank guarantee details must contain no more than 50 records.');
  }
  const bankGuarantees = values.bank_guarantees.map((guarantee, index) => {
    const label = `Bank guarantee ${index + 1}`;
    const issueDate = optionalDate(guarantee?.bank_guarantee_issue_date, `${label} issue date`);
    const expiryDate = optionalDate(guarantee?.bank_guarantee_expiry_date, `${label} expiry date`);
    if (issueDate && expiryDate && expiryDate < issueDate) {
      throw new Error(`${label} expiry date cannot be before its issue date.`);
    }
    return {
      bank_guarantee_number: optionalText(guarantee?.bank_guarantee_number, `${label} number`, 120),
      bank_guarantee_amount: assertAmount(guarantee?.bank_guarantee_amount ?? 0, `${label} amount`),
      bank_guarantee_issue_date: issueDate || null,
      bank_guarantee_expiry_date: expiryDate || null,
      bank_guarantee_extension_date_1: optionalDate(guarantee?.bank_guarantee_extension_date_1, `${label} extension date 1`) || null,
      bank_guarantee_extension_date_2: optionalDate(guarantee?.bank_guarantee_extension_date_2, `${label} extension date 2`) || null,
      bank_guarantee_extension_date_3: optionalDate(guarantee?.bank_guarantee_extension_date_3, `${label} extension date 3`) || null,
      bank_guarantee_released_date: optionalDate(guarantee?.bank_guarantee_released_date, `${label} released date`) || null,
      security_instrument_number: optionalText(guarantee?.security_instrument_number, `FDR / Insurance ${index + 1} number`, 120),
      security_instrument_amount: assertAmount(guarantee?.security_instrument_amount ?? 0, `FDR / Insurance ${index + 1} amount`),
      security_instrument_institution: optionalText(guarantee?.security_instrument_institution, `FDR / Insurance ${index + 1} bank or provider`, 120),
      security_instrument_issue_date: optionalDate(guarantee?.security_instrument_issue_date, `FDR / Insurance ${index + 1} issue date`) || null,
      security_instrument_maturity_date: optionalDate(guarantee?.security_instrument_maturity_date, `FDR / Insurance ${index + 1} maturity or expiry date`) || null,
      security_instrument_release_date: optionalDate(guarantee?.security_instrument_release_date, `FDR / Insurance ${index + 1} release date`) || null,
    };
  });
  return {
    tender_name: tenderName,
    project_names: projectNames,
    apply_gst: values?.apply_gst ? 1 : 0,
    tender_date: tenderDate,
    completion_date: completionDate,
    bidding_amount: assertAmount(values?.bidding_amount, 'Bidding amount'),
    tender_reference: optionalText(values?.tender_reference, 'Tender ID / NIT number', 120),
    department: optionalText(values?.department, 'Department / client', 200),
    work_location: optionalText(values?.work_location, 'Work location', 200),
    work_scope: optionalText(values?.work_scope, 'Work description', 2000),
    submission_deadline: submissionDeadline || null,
    emd_amount: emdAmount,
    emd_refunded_amount: emdRefundedAmount,
    tender_fee: assertAmount(values?.tender_fee ?? 0, 'Tender fee'),
    work_order_number: optionalText(values?.work_order_number, 'Work order number', 120),
    status,
    work_code: optionalText(values?.work_code, 'Work code', 120),
    quoted_rate: assertAmount(values?.quoted_rate ?? 0, 'Quoted rate'),
    rebate_percent: assertPercent(values?.rebate_percent ?? 0, 'Project rebate'),
    stipulated_months: assertMonths(values?.stipulated_months ?? 0, 'Stipulated completion time'),
    allotment_date: optionalDate(values?.allotment_date, 'Date of allotment') || null,
    extension_date_1: optionalDate(values?.extension_date_1, 'Project extension date 1') || null,
    extension_date_2: optionalDate(values?.extension_date_2, 'Project extension date 2') || null,
    extension_date_3: optionalDate(values?.extension_date_3, 'Project extension date 3') || null,
    bank_guarantees: bankGuarantees,
  };
}

function validateBill(values, projectNames) {
  const billTypes = ['Construction bill', 'Maintenance bill'];
  const escalationTypes = ['None', 'Add', 'Deduct'];
  const deductionTypes = ['', 'Penalty', 'Water charges', 'Material recovery', 'Other'];
  const billType = values?.bill_type || 'Construction bill';
  const escalationType = values?.escalation_type || 'None';
  const deductionType = values?.other_deduction_type || '';
  if (!billTypes.includes(billType)) throw new Error('Choose a valid bill type.');
  if (!escalationTypes.includes(escalationType)) throw new Error('Choose a valid escalation adjustment.');
  if (!deductionTypes.includes(deductionType)) throw new Error('Choose a valid other deduction type.');
  const projectName = assertText(values?.project_name, 'Project name', 200);
  if (!projectNames.includes(projectName)) throw new Error('Choose a project listed under this tender.');
  return {
    bill_name: assertText(values?.bill_name, 'Bill name'),
    project_name: projectName,
    bill_date: assertDate(values?.bill_date, 'Bill date'),
    description: typeof values?.description === 'string' ? values.description.trim().slice(0, 2000) : '',
    hold_amount: assertAmount(values?.hold_amount ?? 0, 'Hold amount'),
    amount_received: assertAmount(values?.amount_received ?? 0, 'Amount received'),
    bill_type: billType,
    work_done_amount: assertAmount(values?.work_done_amount ?? 0, 'Work done amount'),
    culture_cess_percent: assertPercent(values?.culture_cess_percent ?? 0, 'Culture cess'),
    rebate_percent: assertPercent(values?.rebate_percent ?? 0, 'Bill rebate'),
    escalation_type: escalationType,
    escalation_amount: assertAmount(values?.escalation_amount ?? 0, 'Escalation amount'),
    security_percent: assertPercent(values?.security_percent ?? 0, 'Security deduction'),
    cgst_percent: assertPercent(values?.cgst_percent ?? 0, 'CGST'),
    sgst_percent: assertPercent(values?.sgst_percent ?? 0, 'SGST'),
    income_tax_percent: assertPercent(values?.income_tax_percent ?? 0, 'Income tax'),
    labour_cess_percent: assertPercent(values?.labour_cess_percent ?? 0, 'Labour cess'),
    construction_cess_percent: assertPercent(values?.construction_cess_percent ?? 0, 'Construction cess'),
    tpa_amount: assertAmount(values?.tpa_amount ?? 0, 'TPA deduction'),
    withheld_amount: assertAmount(values?.withheld_amount ?? 0, 'Withheld amount'),
    other_deduction_type: deductionType,
    other_deduction_description: optionalText(values?.other_deduction_description, 'Other deduction details', 200),
    other_deduction_amount: assertAmount(values?.other_deduction_amount ?? 0, 'Other deduction'),
    received_date: optionalDate(values?.received_date, 'Payment received date') || null,
    cheque_number: optionalText(values?.cheque_number, 'Cheque number', 120),
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

function registerIpc(db, dataDirectory, { onDatabaseReplaced, onProgress } = {}) {
  let files = createFileManager(db, dataDirectory);
  let maintenanceMode = false;
  const backupManager = createBackupManager({
    dataDirectory,
    getDatabase: () => db,
    replaceDatabase(nextDatabase) {
      db = nextDatabase;
      files = createFileManager(db, dataDirectory);
      onDatabaseReplaced?.(db);
    },
    setMaintenanceMode(value) {
      maintenanceMode = value;
    },
    onProgress,
  });
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
      const category = ['allotted', 'participated'].includes(options.category) ? options.category : 'allotted';
      const allottedCondition = "t.status IN ('Awarded', 'In progress', 'Completed')";
      const date = new Date();
      const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const conditions = [];
      const parameters = [];
      if (search) {
        conditions.push(`(t.tender_name LIKE ? OR t.id LIKE ? OR t.tender_reference LIKE ?
          OR t.department LIKE ? OR t.work_location LIKE ? OR t.work_order_number LIKE ?
          OR t.work_code LIKE ?)`);
        parameters.push(...Array(7).fill(`%${search}%`));
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
      const baseWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const categoryCondition = category === 'allotted' ? allottedCondition : `NOT ${allottedCondition}`;
      const where = `${baseWhere}${baseWhere ? ' AND ' : 'WHERE '}${categoryCondition}`;
      const count = db.prepare(`SELECT COUNT(*) AS total FROM tenders t ${where}`).get(...parameters).total;
      const categoryCounts = db.prepare(`
        SELECT
          SUM(CASE WHEN ${allottedCondition} THEN 1 ELSE 0 END) AS allotted,
          SUM(CASE WHEN NOT ${allottedCondition} THEN 1 ELSE 0 END) AS participated
        FROM tenders t ${baseWhere}
      `).get(...parameters);
      const summary = db.prepare(`
        SELECT COALESCE(SUM(bidding_amount), 0) AS total_value,
          COALESCE(SUM(total_received), 0) AS total_received,
          COALESCE(SUM(total_hold), 0) AS total_hold,
          COALESCE(SUM(MAX(0, bidding_amount - total_received)), 0) AS total_pending,
          COALESCE(SUM(tender_fee), 0) AS total_tender_fee,
          COALESCE(SUM(emd_amount), 0) AS total_emd,
          COALESCE(SUM(emd_refunded_amount), 0) AS total_emd_refunded
        FROM (
          SELECT t.bidding_amount, t.tender_fee, t.emd_amount, t.emd_refunded_amount,
            COALESCE((SELECT SUM(b.amount_received) FROM bills b WHERE b.tender_id = t.id AND b.bill_type = 'Construction bill'), 0) AS total_received,
            COALESCE((SELECT SUM(b.hold_amount) FROM bills b WHERE b.tender_id = t.id AND b.bill_type = 'Construction bill'), 0) AS total_hold
          FROM tenders t ${where}
        )
      `).get(...parameters);
      const rows = db.prepare(`
        SELECT t.id, t.tender_name, t.tender_reference, t.department, t.status,
          t.tender_date, t.submission_deadline, t.completion_date, t.bidding_amount,
          t.tender_fee, t.emd_amount, t.emd_refunded_amount,
          (SELECT COUNT(*) FROM bills b WHERE b.tender_id = t.id) AS bill_count,
          COALESCE((SELECT SUM(b.amount_received) FROM bills b WHERE b.tender_id = t.id AND b.bill_type = 'Construction bill'), 0) AS total_received,
          COALESCE((SELECT SUM(b.hold_amount) FROM bills b WHERE b.tender_id = t.id AND b.bill_type = 'Construction bill'), 0) AS total_hold
        FROM tenders t ${where}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ? OFFSET ?
      `).all(...parameters, pageSize, (page - 1) * pageSize);
      return { rows, total: count, summary, categoryCounts, page, pageSize };
    },
    'tenders:getById': (_event, id) => {
      const tender = db.prepare('SELECT * FROM tenders WHERE id = ?').get(assertText(id, 'Tender ID', 80));
      if (!tender) throw new Error('Tender not found.');
      tender.project_names = db.prepare('SELECT project_name FROM tender_projects WHERE tender_id = ? ORDER BY id').all(id).map((project) => project.project_name);
      tender.bank_guarantees = db.prepare('SELECT * FROM tender_bank_guarantees WHERE tender_id = ? ORDER BY id').all(id);
      tender.project_completions = db.prepare(`
        SELECT c.*,
          (SELECT json_group_array(json_object('id', f.id, 'short_name', f.short_name, 'file_name', f.file_name, 'created_at', f.created_at))
            FROM project_completion_files f WHERE f.completion_id = c.id) AS files_json
        FROM project_completions c WHERE c.tender_id = ? ORDER BY c.project_name COLLATE NOCASE
      `).all(id).map((completion) => ({
        ...completion,
        files: JSON.parse(completion.files_json || '[]'),
      }));
      tender.files = db.prepare('SELECT id, short_name, file_name, created_at FROM tender_files WHERE tender_id = ? ORDER BY created_at').all(id);
      const totals = db.prepare(`
        SELECT COUNT(*) AS bill_count,
          COALESCE(SUM(CASE WHEN bill_type = 'Construction bill' THEN hold_amount ELSE 0 END), 0) AS total_hold,
          COALESCE(SUM(CASE WHEN bill_type = 'Construction bill' THEN amount_received ELSE 0 END), 0) AS total_received
        FROM bills WHERE tender_id = ?
      `).get(id);
      return { ...tender, ...totals, outstanding: Math.max(0, tender.bidding_amount - totals.total_received) };
    },
    'tenders:create': (_event, values) => {
      const tender = validateTender(values);
      const { project_names: projectNames, bank_guarantees: bankGuarantees, ...tenderValues } = tender;
      const id = nextId(db, 'TND');
      try {
        fs.mkdirSync(path.join(dataDirectory, 'tenders', id, 'documents'), { recursive: true });
        db.transaction(() => {
          db.prepare(`
          INSERT INTO tenders (
            id, tender_name, tender_date, completion_date, bidding_amount, tender_reference,
            department, work_location, work_scope, submission_deadline, emd_amount, emd_refunded_amount, apply_gst, tender_fee,
            work_order_number, status, work_code, quoted_rate, rebate_percent, stipulated_months,
            allotment_date, extension_date_1, extension_date_2, extension_date_3
          )
          VALUES (
            @id, @tender_name, @tender_date, @completion_date, @bidding_amount, @tender_reference,
            @department, @work_location, @work_scope, @submission_deadline, @emd_amount, @emd_refunded_amount, @apply_gst, @tender_fee,
            @work_order_number, @status, @work_code, @quoted_rate, @rebate_percent, @stipulated_months,
            @allotment_date, @extension_date_1, @extension_date_2, @extension_date_3
          )
          `).run({ ...tenderValues, id });
          const insertProject = db.prepare('INSERT INTO tender_projects (tender_id, project_name) VALUES (?, ?)');
          for (const projectName of projectNames) insertProject.run(id, projectName);
          const insertGuarantee = db.prepare(`
            INSERT INTO tender_bank_guarantees (
              tender_id, bank_guarantee_number, bank_guarantee_amount, bank_guarantee_issue_date,
              bank_guarantee_expiry_date, bank_guarantee_extension_date_1,
              bank_guarantee_extension_date_2, bank_guarantee_extension_date_3,
              bank_guarantee_released_date, security_instrument_number, security_instrument_amount,
              security_instrument_institution, security_instrument_issue_date,
              security_instrument_maturity_date, security_instrument_release_date
            ) VALUES (
              @tender_id, @bank_guarantee_number, @bank_guarantee_amount, @bank_guarantee_issue_date,
              @bank_guarantee_expiry_date, @bank_guarantee_extension_date_1,
              @bank_guarantee_extension_date_2, @bank_guarantee_extension_date_3,
              @bank_guarantee_released_date, @security_instrument_number, @security_instrument_amount,
              @security_instrument_institution, @security_instrument_issue_date,
              @security_instrument_maturity_date, @security_instrument_release_date
            )
          `);
          for (const guarantee of bankGuarantees) insertGuarantee.run({ ...guarantee, tender_id: id });
        })();
      } catch (error) {
        fs.rmSync(path.join(dataDirectory, 'tenders', id), { recursive: true, force: true });
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('A tender with this name already exists.');
        throw new Error(`Could not create tender: ${error.message}`);
      }
      return { id };
    },
    'tenders:update': (_event, id, values) => {
      const tender = validateTender(values);
      const { project_names: projectNames, bank_guarantees: bankGuarantees, ...tenderValues } = tender;
      try {
        db.transaction(() => {
          const result = db.prepare(`
          UPDATE tenders SET tender_name = @tender_name, tender_date = @tender_date,
            completion_date = @completion_date, bidding_amount = @bidding_amount,
            tender_reference = @tender_reference, department = @department,
            work_location = @work_location, work_scope = @work_scope,
            submission_deadline = @submission_deadline, emd_amount = @emd_amount,
            emd_refunded_amount = @emd_refunded_amount, apply_gst = @apply_gst, tender_fee = @tender_fee,
            work_order_number = @work_order_number, status = @status,
            work_code = @work_code, quoted_rate = @quoted_rate, rebate_percent = @rebate_percent,
            stipulated_months = @stipulated_months, allotment_date = @allotment_date,
            extension_date_1 = @extension_date_1, extension_date_2 = @extension_date_2,
            updated_at = CURRENT_TIMESTAMP WHERE id = @id
          `).run({ ...tenderValues, id: assertText(id, 'Tender ID', 80) });
          if (!result.changes) throw new Error('Tender not found.');
          db.prepare('DELETE FROM tender_projects WHERE tender_id = ?').run(id);
          const insertProject = db.prepare('INSERT INTO tender_projects (tender_id, project_name) VALUES (?, ?)');
          for (const projectName of projectNames) insertProject.run(id, projectName);
          db.prepare('DELETE FROM tender_bank_guarantees WHERE tender_id = ?').run(id);
          const insertGuarantee = db.prepare(`
            INSERT INTO tender_bank_guarantees (
              tender_id, bank_guarantee_number, bank_guarantee_amount, bank_guarantee_issue_date,
              bank_guarantee_expiry_date, bank_guarantee_extension_date_1,
              bank_guarantee_extension_date_2, bank_guarantee_extension_date_3,
              bank_guarantee_released_date, security_instrument_number, security_instrument_amount,
              security_instrument_institution, security_instrument_issue_date,
              security_instrument_maturity_date, security_instrument_release_date
            ) VALUES (
              @tender_id, @bank_guarantee_number, @bank_guarantee_amount, @bank_guarantee_issue_date,
              @bank_guarantee_expiry_date, @bank_guarantee_extension_date_1,
              @bank_guarantee_extension_date_2, @bank_guarantee_extension_date_3,
              @bank_guarantee_released_date, @security_instrument_number, @security_instrument_amount,
              @security_instrument_institution, @security_instrument_issue_date,
              @security_instrument_maturity_date, @security_instrument_release_date
            )
          `);
          for (const guarantee of bankGuarantees) insertGuarantee.run({ ...guarantee, tender_id: id });
        })();
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
    'projects:complete': (_event, tenderId, values = {}) => {
      const id = assertText(tenderId, 'Tender ID', 80);
      const tender = db.prepare('SELECT id, tender_name FROM tenders WHERE id = ?').get(id);
      if (!tender) throw new Error('Tender not found.');
      const projectName = assertText(values.project_name, 'Tender name', 200);
      if (projectName !== tender.tender_name) throw new Error('Tender name does not match this tender record.');
      const securityAmount = assertAmount(values.security_amount, 'Security amount');
      const securityRefund = assertAmount(values.security_refund, 'Security refund');
      const balanceSecurity = assertAmount(values.balance_security, 'Balance security');
      const remark = typeof values.remark === 'string' ? values.remark.trim().slice(0, 2000) : '';
      const existing = db.prepare('SELECT id FROM project_completions WHERE tender_id = ? AND project_name = ?').get(id, projectName);
      if (existing) {
        db.prepare(`
          UPDATE project_completions
          SET security_amount = ?, security_refund = ?, balance_security = ?, remark = ?,
            completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(securityAmount, securityRefund, balanceSecurity, remark, existing.id);
        return { id: existing.id };
      }
      const completionId = `COMP-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO project_completions (
          id, tender_id, project_name, security_amount, security_refund, balance_security, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(completionId, id, projectName, securityAmount, securityRefund, balanceSecurity, remark);
      return { id: completionId };
    },
    'bills:list': (_event, tenderId, options = {}) => {
      const id = assertText(tenderId, 'Tender ID', 80);
      if (!db.prepare('SELECT id FROM tenders WHERE id = ?').get(id)) throw new Error('Tender not found.');
      const page = Math.max(1, Math.floor(Number(options.page) || 1));
      const pageSize = Math.min(50, Math.max(1, Math.floor(Number(options.pageSize) || 10)));
      const billType = ['Construction bill', 'Maintenance bill'].includes(options.billType)
        ? options.billType
        : 'Construction bill';
      const total = db.prepare('SELECT COUNT(*) AS total FROM bills WHERE tender_id = ? AND bill_type = ?').get(id, billType).total;
      const rows = db.prepare(`
        SELECT b.*,
          (SELECT COUNT(*) FROM bill_files f WHERE f.bill_id = b.id) AS file_count
        FROM bills b WHERE b.tender_id = ? AND b.bill_type = ?
        ORDER BY b.bill_date DESC, b.created_at DESC
        LIMIT ? OFFSET ?
      `).all(id, billType, pageSize, (page - 1) * pageSize);
      for (const bill of rows) {
        bill.files = db.prepare('SELECT id, short_name, file_name, created_at FROM bill_files WHERE bill_id = ? ORDER BY created_at').all(bill.id);
      }
      return { rows, total, billType, page, pageSize };
    },
    'bills:getById': (_event, billId) => {
      const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(assertText(billId, 'Bill ID', 80));
      if (!bill) throw new Error('Bill not found.');
      return bill;
    },
    'bills:getStatement': (_event, tenderId) => {
      const id = assertText(tenderId, 'Tender ID', 80);
      if (!db.prepare('SELECT id FROM tenders WHERE id = ?').get(id)) throw new Error('Tender not found.');
      return db.prepare(`
        SELECT *
        FROM bills
        WHERE tender_id = ?
        ORDER BY bill_date ASC, created_at ASC
      `).all(id);
    },
    'bills:create': (_event, tenderId, values) => {
      const parent = assertText(tenderId, 'Tender ID', 80);
      if (!db.prepare('SELECT id FROM tenders WHERE id = ?').get(parent)) throw new Error('Tender not found.');
      const projectNames = db.prepare('SELECT project_name FROM tender_projects WHERE tender_id = ?').all(parent).map((project) => project.project_name);
      const bill = validateBill(values, projectNames);
      const id = nextId(db, 'BILL');
      try {
        fs.mkdirSync(path.join(dataDirectory, 'tenders', parent, 'bills', id), { recursive: true });
        db.prepare(`
          INSERT INTO bills (
            id, tender_id, bill_name, project_name, bill_date, description, hold_amount, amount_received,
            bill_type, work_done_amount, culture_cess_percent, rebate_percent,
            escalation_type, escalation_amount, security_percent, cgst_percent, sgst_percent,
            income_tax_percent, labour_cess_percent, construction_cess_percent, tpa_amount,
            withheld_amount, other_deduction_type, other_deduction_description,
            other_deduction_amount, received_date, cheque_number
          )
          VALUES (
            @id, @tender_id, @bill_name, @project_name, @bill_date, @description, @hold_amount, @amount_received,
            @bill_type, @work_done_amount, @culture_cess_percent, @rebate_percent,
            @escalation_type, @escalation_amount, @security_percent, @cgst_percent, @sgst_percent,
            @income_tax_percent, @labour_cess_percent, @construction_cess_percent, @tpa_amount,
            @withheld_amount, @other_deduction_type, @other_deduction_description,
            @other_deduction_amount, @received_date, @cheque_number
          )
        `).run({ ...bill, id, tender_id: parent });
      } catch (error) {
        fs.rmSync(path.join(dataDirectory, 'tenders', parent, 'bills', id), { recursive: true, force: true });
        throw new Error(`Could not create bill: ${error.message}`);
      }
      return { id };
    },
    'bills:update': (_event, id, values) => {
      const existingBill = db.prepare('SELECT id, tender_id, project_name FROM bills WHERE id = ?').get(assertText(id, 'Bill ID', 80));
      if (!existingBill) throw new Error('Bill not found.');
      const projectNames = db.prepare('SELECT project_name FROM tender_projects WHERE tender_id = ?').all(existingBill.tender_id).map((project) => project.project_name);
      if (!projectNames.includes(existingBill.project_name)) projectNames.push(existingBill.project_name);
      const bill = validateBill(values, projectNames);
      const result = db.prepare(`
        UPDATE bills SET bill_name = @bill_name, project_name = @project_name, bill_date = @bill_date, description = @description,
          hold_amount = @hold_amount, amount_received = @amount_received,
          bill_type = @bill_type, work_done_amount = @work_done_amount,
          culture_cess_percent = @culture_cess_percent, rebate_percent = @rebate_percent,
          escalation_type = @escalation_type, escalation_amount = @escalation_amount,
          security_percent = @security_percent, cgst_percent = @cgst_percent, sgst_percent = @sgst_percent,
          income_tax_percent = @income_tax_percent, labour_cess_percent = @labour_cess_percent,
          construction_cess_percent = @construction_cess_percent, tpa_amount = @tpa_amount,
          withheld_amount = @withheld_amount, other_deduction_type = @other_deduction_type,
          other_deduction_description = @other_deduction_description,
          other_deduction_amount = @other_deduction_amount, received_date = @received_date,
          cheque_number = @cheque_number,
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
    'files:selectCompletion': (_event, completionId) => files.selectCompletionFiles(assertText(completionId, 'Project completion ID', 80)),
    'files:saveSelected': (_event, ownerId, token, shortName) => files.saveSelectedFile(
      assertText(ownerId, 'Tender or bill ID', 80),
      assertText(token, 'File selection', 80),
      shortName,
    ),
    'files:discardSelected': (_event, token) => files.discardSelectedFile(assertText(token, 'File selection', 80)),
    'files:remove': (_event, fileId) => files.remove(assertText(fileId, 'File ID', 80)),
    'files:open': (_event, fileId) => files.open(assertText(fileId, 'File ID', 80)),
    'files:download': (_event, fileId) => files.download(assertText(fileId, 'File ID', 80)),
    'data:backup': () => backupManager.backup(),
    'data:restore': () => backupManager.restore(),
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      try {
        if (maintenanceMode && channel !== 'data:backup' && channel !== 'data:restore') {
          throw new Error('A backup or restore is in progress. Please wait until it finishes.');
        }
        return handler(event, ...args);
      } catch (error) {
        console.error(`[${channel}]`, error);
        throw error;
      }
    });
  }
}

module.exports = { registerIpc };
