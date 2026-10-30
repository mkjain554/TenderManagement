const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

function createDatabase(dataDirectory) {
  fs.mkdirSync(path.join(dataDirectory, 'tenders'), { recursive: true });
  const db = new Database(path.join(dataDirectory, 'database.sqlite'));
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tenders (
      id TEXT PRIMARY KEY,
      tender_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      tender_date TEXT NOT NULL,
      completion_date TEXT NOT NULL,
      bidding_amount REAL NOT NULL CHECK (bidding_amount >= 0),
      tender_reference TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      work_location TEXT NOT NULL DEFAULT '',
      work_scope TEXT NOT NULL DEFAULT '',
      submission_deadline TEXT,
      emd_amount REAL NOT NULL DEFAULT 0 CHECK (emd_amount >= 0),
      emd_refunded_amount REAL NOT NULL DEFAULT 0 CHECK (emd_refunded_amount >= 0),
      emd_submission_date TEXT,
      emd_refund_received_date TEXT,
      apply_gst INTEGER NOT NULL DEFAULT 0 CHECK (apply_gst IN (0, 1)),
      tender_fee REAL NOT NULL DEFAULT 0 CHECK (tender_fee >= 0),
      work_order_number TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Not set',
      work_code TEXT NOT NULL DEFAULT '',
      quoted_rate REAL NOT NULL DEFAULT 0 CHECK (quoted_rate >= 0),
      rebate_percent REAL NOT NULL DEFAULT 0 CHECK (rebate_percent >= 0),
      stipulated_months INTEGER NOT NULL DEFAULT 0 CHECK (stipulated_months >= 0),
      allotment_date TEXT,
      extension_date_1 TEXT,
      extension_date_2 TEXT,
      extension_date_3 TEXT,
      bank_guarantee_number TEXT NOT NULL DEFAULT '',
      bank_guarantee_amount REAL NOT NULL DEFAULT 0 CHECK (bank_guarantee_amount >= 0),
      bank_guarantee_issue_date TEXT,
      bank_guarantee_expiry_date TEXT,
      bank_guarantee_extension_date_1 TEXT,
      bank_guarantee_extension_date_2 TEXT,
      bank_guarantee_extension_date_3 TEXT,
      fdr_number TEXT NOT NULL DEFAULT '',
      fdr_amount REAL NOT NULL DEFAULT 0 CHECK (fdr_amount >= 0),
      fdr_bank TEXT NOT NULL DEFAULT '',
      fdr_issue_date TEXT,
      fdr_maturity_date TEXT,
      insurance_number TEXT NOT NULL DEFAULT '',
      insurance_provider TEXT NOT NULL DEFAULT '',
      insurance_issue_date TEXT,
      insurance_amount REAL NOT NULL DEFAULT 0 CHECK (insurance_amount >= 0),
      insurance_payment_release_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tender_files (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      short_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tender_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL COLLATE NOCASE,
      UNIQUE (tender_id, project_name)
    );
    CREATE TABLE IF NOT EXISTS tender_bank_guarantees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      bank_guarantee_number TEXT NOT NULL DEFAULT '',
      bank_guarantee_amount REAL NOT NULL DEFAULT 0 CHECK (bank_guarantee_amount >= 0),
      bank_guarantee_issue_date TEXT,
      bank_guarantee_expiry_date TEXT,
      bank_guarantee_extension_date_1 TEXT,
      bank_guarantee_extension_date_2 TEXT,
      bank_guarantee_extension_date_3 TEXT,
      bank_guarantee_released_date TEXT,
      fdr_number TEXT NOT NULL DEFAULT '',
      fdr_amount REAL NOT NULL DEFAULT 0 CHECK (fdr_amount >= 0),
      fdr_bank TEXT NOT NULL DEFAULT '',
      fdr_issue_date TEXT,
      fdr_maturity_date TEXT,
      insurance_number TEXT NOT NULL DEFAULT '',
      insurance_provider TEXT NOT NULL DEFAULT '',
      insurance_issue_date TEXT,
      insurance_amount REAL NOT NULL DEFAULT 0 CHECK (insurance_amount >= 0),
      insurance_payment_release_date TEXT,
      security_instrument_number TEXT NOT NULL DEFAULT '',
      security_instrument_type TEXT NOT NULL DEFAULT '',
      security_instrument_amount REAL NOT NULL DEFAULT 0 CHECK (security_instrument_amount >= 0),
      security_instrument_institution TEXT NOT NULL DEFAULT '',
      security_instrument_issue_date TEXT,
      security_instrument_maturity_date TEXT,
      security_instrument_release_date TEXT
    );
    CREATE TABLE IF NOT EXISTS project_completions (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      security_amount REAL NOT NULL DEFAULT 0 CHECK (security_amount >= 0),
      security_refund REAL NOT NULL DEFAULT 0 CHECK (security_refund >= 0),
      security_refund_2 REAL NOT NULL DEFAULT 0 CHECK (security_refund_2 >= 0),
      security_refund_date_1 TEXT,
      security_refund_date_2 TEXT,
      balance_security REAL NOT NULL DEFAULT 0 CHECK (balance_security >= 0),
      remark TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tender_id, project_name)
    );
    CREATE TABLE IF NOT EXISTS project_completion_files (
      id TEXT PRIMARY KEY,
      completion_id TEXT NOT NULL REFERENCES project_completions(id) ON DELETE CASCADE,
      short_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      bill_name TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      bill_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      hold_amount REAL NOT NULL DEFAULT 0 CHECK (hold_amount >= 0),
      release_amount REAL NOT NULL DEFAULT 0 CHECK (release_amount >= 0),
      release_against TEXT NOT NULL DEFAULT '',
      release_date TEXT,
      release_remark TEXT NOT NULL DEFAULT '',
      amount_received REAL NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
      bill_type TEXT NOT NULL DEFAULT 'Construction bill',
      financial_year TEXT NOT NULL DEFAULT '',
      work_done_amount REAL NOT NULL DEFAULT 0 CHECK (work_done_amount >= 0),
      culture_cess_percent REAL NOT NULL DEFAULT 5 CHECK (culture_cess_percent >= 0),
      rebate_percent REAL NOT NULL DEFAULT 2 CHECK (rebate_percent >= 0),
      rebate_include_escalation TEXT NOT NULL DEFAULT 'Exclude' CHECK (rebate_include_escalation IN ('Include', 'Exclude')),
      escalation_type TEXT NOT NULL DEFAULT 'None',
      escalation_amount REAL NOT NULL DEFAULT 0 CHECK (escalation_amount >= 0),
      escalation_adjustment_type TEXT NOT NULL DEFAULT 'None',
      escalation_adjustment_amount REAL NOT NULL DEFAULT 0 CHECK (escalation_adjustment_amount >= 0),
      previous_bill_number TEXT NOT NULL DEFAULT '',
      previous_bill_amount REAL NOT NULL DEFAULT 0 CHECK (previous_bill_amount >= 0),
      security_percent REAL NOT NULL DEFAULT 5 CHECK (security_percent >= 0),
      cgst_percent REAL NOT NULL DEFAULT 1 CHECK (cgst_percent >= 0),
      sgst_percent REAL NOT NULL DEFAULT 1 CHECK (sgst_percent >= 0),
      income_tax_percent REAL NOT NULL DEFAULT 2 CHECK (income_tax_percent >= 0),
      labour_cess_percent REAL NOT NULL DEFAULT 1 CHECK (labour_cess_percent >= 0),
      construction_cess_percent REAL NOT NULL DEFAULT 1 CHECK (construction_cess_percent >= 0),
      tpa_amount REAL NOT NULL DEFAULT 0 CHECK (tpa_amount >= 0),
      withheld_amount REAL NOT NULL DEFAULT 0 CHECK (withheld_amount >= 0),
      other_deduction_type TEXT NOT NULL DEFAULT '',
      other_deduction_description TEXT NOT NULL DEFAULT '',
      other_deduction_amount REAL NOT NULL DEFAULT 0 CHECK (other_deduction_amount >= 0),
      received_date TEXT,
      cheque_number TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS bills_by_tender ON bills(tender_id, bill_date);
    CREATE TABLE IF NOT EXISTS bill_files (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      short_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const tenderColumns = [
    ['tender_reference', "TEXT NOT NULL DEFAULT ''"],
    ['department', "TEXT NOT NULL DEFAULT ''"],
    ['work_location', "TEXT NOT NULL DEFAULT ''"],
    ['work_scope', "TEXT NOT NULL DEFAULT ''"],
    ['submission_deadline', 'TEXT'],
    ['emd_submission_date', 'TEXT'],
    ['emd_refund_received_date', 'TEXT'],
    ['emd_amount', 'REAL NOT NULL DEFAULT 0 CHECK (emd_amount >= 0)'],
    ['emd_refunded_amount', 'REAL NOT NULL DEFAULT 0 CHECK (emd_refunded_amount >= 0)'],
    ['apply_gst', 'INTEGER NOT NULL DEFAULT 1 CHECK (apply_gst IN (0, 1))'],
    ['tender_fee', 'REAL NOT NULL DEFAULT 0 CHECK (tender_fee >= 0)'],
    ['work_order_number', "TEXT NOT NULL DEFAULT ''"],
    ['status', "TEXT NOT NULL DEFAULT 'Not set'"],
    ['work_code', "TEXT NOT NULL DEFAULT ''"],
    ['quoted_rate', 'REAL NOT NULL DEFAULT 0 CHECK (quoted_rate >= 0)'],
    ['rebate_percent', 'REAL NOT NULL DEFAULT 0 CHECK (rebate_percent >= 0)'],
    ['stipulated_months', 'INTEGER NOT NULL DEFAULT 0 CHECK (stipulated_months >= 0)'],
    ['allotment_date', 'TEXT'],
    ['extension_date_1', 'TEXT'],
    ['extension_date_2', 'TEXT'],
    ['extension_date_3', 'TEXT'],
    ['bank_guarantee_number', "TEXT NOT NULL DEFAULT ''"],
    ['bank_guarantee_amount', 'REAL NOT NULL DEFAULT 0 CHECK (bank_guarantee_amount >= 0)'],
    ['bank_guarantee_issue_date', 'TEXT'],
    ['bank_guarantee_expiry_date', 'TEXT'],
    ['bank_guarantee_extension_date_1', 'TEXT'],
    ['bank_guarantee_extension_date_2', 'TEXT'],
    ['bank_guarantee_extension_date_3', 'TEXT'],
    ['fdr_number', "TEXT NOT NULL DEFAULT ''"],
    ['fdr_amount', 'REAL NOT NULL DEFAULT 0 CHECK (fdr_amount >= 0)'],
    ['fdr_bank', "TEXT NOT NULL DEFAULT ''"],
    ['fdr_issue_date', 'TEXT'],
    ['fdr_maturity_date', 'TEXT'],
    ['insurance_number', "TEXT NOT NULL DEFAULT ''"],
    ['insurance_provider', "TEXT NOT NULL DEFAULT ''"],
    ['insurance_issue_date', 'TEXT'],
    ['insurance_amount', 'REAL NOT NULL DEFAULT 0 CHECK (insurance_amount >= 0)'],
    ['insurance_payment_release_date', 'TEXT'],
  ];
  const existingColumns = new Set(db.pragma('table_info(tenders)').map((column) => column.name));
  const migrateTenders = db.transaction(() => {
    for (const [name, definition] of tenderColumns) {
      if (!existingColumns.has(name)) {
        db.exec(`ALTER TABLE tenders ADD COLUMN ${name} ${definition}`);
      }
    }
  });
  migrateTenders();

  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const existingCompletionColumns = new Set(db.pragma('table_info(project_completions)').map((column) => column.name));
  const completionColumns = [
    ['security_refund_2', 'REAL NOT NULL DEFAULT 0 CHECK (security_refund_2 >= 0)'],
    ['security_refund_date_1', 'TEXT'],
    ['security_refund_date_2', 'TEXT'],
  ];
  for (const [name, definition] of completionColumns) {
    if (!existingCompletionColumns.has(name)) {
      db.exec(`ALTER TABLE project_completions ADD COLUMN ${name} ${definition}`);
    }
  }
  const guaranteeMigration = db.transaction(() => {
    const migrated = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get('bank-guarantee-records');
    if (migrated) return;
    db.exec(`
      INSERT INTO tender_bank_guarantees (
        tender_id, bank_guarantee_number, bank_guarantee_amount, bank_guarantee_issue_date,
        bank_guarantee_expiry_date, bank_guarantee_extension_date_1,
        bank_guarantee_extension_date_2, bank_guarantee_extension_date_3,
        fdr_number, fdr_amount, fdr_bank, fdr_issue_date, fdr_maturity_date
      )
      SELECT id, bank_guarantee_number, bank_guarantee_amount, bank_guarantee_issue_date,
        bank_guarantee_expiry_date, bank_guarantee_extension_date_1,
        bank_guarantee_extension_date_2, bank_guarantee_extension_date_3,
        fdr_number, fdr_amount, fdr_bank, fdr_issue_date, fdr_maturity_date
      FROM tenders
      WHERE bank_guarantee_number != '' OR bank_guarantee_amount != 0
        OR bank_guarantee_issue_date IS NOT NULL OR bank_guarantee_expiry_date IS NOT NULL
        OR bank_guarantee_extension_date_1 IS NOT NULL OR bank_guarantee_extension_date_2 IS NOT NULL
        OR bank_guarantee_extension_date_3 IS NOT NULL OR fdr_number != '' OR fdr_amount != 0
        OR fdr_bank != '' OR fdr_issue_date IS NOT NULL OR fdr_maturity_date IS NOT NULL
    `);
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('bank-guarantee-records');
  });
  guaranteeMigration();

  const existingGuaranteeColumns = new Set(db.pragma('table_info(tender_bank_guarantees)').map((column) => column.name));
  const guaranteeInsuranceColumns = [
    ['insurance_number', "TEXT NOT NULL DEFAULT ''"],
    ['insurance_provider', "TEXT NOT NULL DEFAULT ''"],
    ['insurance_issue_date', 'TEXT'],
    ['insurance_amount', 'REAL NOT NULL DEFAULT 0 CHECK (insurance_amount >= 0)'],
    ['insurance_payment_release_date', 'TEXT'],
    ['security_instrument_type', "TEXT NOT NULL DEFAULT ''"],
    ['security_instrument_number', "TEXT NOT NULL DEFAULT ''"],
    ['security_instrument_amount', 'REAL NOT NULL DEFAULT 0 CHECK (security_instrument_amount >= 0)'],
    ['security_instrument_institution', "TEXT NOT NULL DEFAULT ''"],
    ['security_instrument_issue_date', 'TEXT'],
    ['security_instrument_maturity_date', 'TEXT'],
    ['security_instrument_release_date', 'TEXT'],
  ];
  const migrateGuaranteeInsurance = db.transaction(() => {
    for (const [name, definition] of guaranteeInsuranceColumns) {
      if (!existingGuaranteeColumns.has(name)) {
        db.exec(`ALTER TABLE tender_bank_guarantees ADD COLUMN ${name} ${definition}`);
      }
    }
    if (!existingGuaranteeColumns.has('security_instrument_type')) {
      db.exec(`
        UPDATE tender_bank_guarantees
        SET security_instrument_type = CASE
          WHEN fdr_number != '' THEN 'FDR'
          WHEN insurance_number != '' THEN 'Insurance'
          ELSE ''
        END
      `);
    }
    const migrated = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get('insurance-by-guarantee');
    if (!migrated) {
      db.exec(`
      INSERT INTO tender_bank_guarantees (
        tender_id, insurance_number, insurance_provider, insurance_issue_date,
        insurance_amount, insurance_payment_release_date
      )
      SELECT t.id, t.insurance_number, t.insurance_provider, t.insurance_issue_date,
        t.insurance_amount, t.insurance_payment_release_date
      FROM tenders t
      WHERE (t.insurance_number != '' OR t.insurance_provider != ''
        OR t.insurance_issue_date IS NOT NULL OR t.insurance_amount != 0
        OR t.insurance_payment_release_date IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM tender_bank_guarantees g WHERE g.tender_id = t.id)
    `);
    db.exec(`
      UPDATE tender_bank_guarantees
      SET insurance_number = (SELECT t.insurance_number FROM tenders t WHERE t.id = tender_bank_guarantees.tender_id),
        insurance_provider = (SELECT t.insurance_provider FROM tenders t WHERE t.id = tender_bank_guarantees.tender_id),
        insurance_issue_date = (SELECT t.insurance_issue_date FROM tenders t WHERE t.id = tender_bank_guarantees.tender_id),
        insurance_amount = (SELECT t.insurance_amount FROM tenders t WHERE t.id = tender_bank_guarantees.tender_id),
        insurance_payment_release_date = (SELECT t.insurance_payment_release_date FROM tenders t WHERE t.id = tender_bank_guarantees.tender_id)
      WHERE id = (
        SELECT MIN(g.id) FROM tender_bank_guarantees g
        WHERE g.tender_id = tender_bank_guarantees.tender_id
      )
        `);
        db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('insurance-by-guarantee');
    }
    const instrumentMigrated = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get('shared-fdr-insurance-instrument');
    if (!instrumentMigrated) {
        db.exec(`
          UPDATE tender_bank_guarantees
          SET security_instrument_number = CASE
                WHEN fdr_number != '' THEN fdr_number ELSE insurance_number END,
              security_instrument_amount = CASE
                WHEN fdr_amount != 0 THEN fdr_amount ELSE insurance_amount END,
              security_instrument_institution = CASE
                WHEN fdr_bank != '' THEN fdr_bank ELSE insurance_provider END,
              security_instrument_issue_date = COALESCE(fdr_issue_date, insurance_issue_date),
              security_instrument_maturity_date = fdr_maturity_date,
              security_instrument_release_date = insurance_payment_release_date
          WHERE security_instrument_number = '' AND security_instrument_amount = 0
            AND security_instrument_institution = '' AND security_instrument_issue_date IS NULL
            AND security_instrument_maturity_date IS NULL AND security_instrument_release_date IS NULL
        `);
        db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('shared-fdr-insurance-instrument');
    }
  });
  migrateGuaranteeInsurance();

  const existingBillColumns = new Set(db.pragma('table_info(bills)').map((column) => column.name));
  const migrateProjectBills = db.transaction(() => {
    if (!existingBillColumns.has('project_name')) {
      db.exec("ALTER TABLE bills ADD COLUMN project_name TEXT NOT NULL DEFAULT ''");
    }
    db.exec(`
      INSERT INTO tender_projects (tender_id, project_name)
      SELECT t.id, t.tender_name
      FROM tenders t
      WHERE NOT EXISTS (SELECT 1 FROM tender_projects p WHERE p.tender_id = t.id)
    `);
    db.exec(`
      UPDATE bills
      SET project_name = (SELECT t.tender_name FROM tenders t WHERE t.id = bills.tender_id)
      WHERE project_name = ''
    `);
  });
  migrateProjectBills();

  const billColumns = [
    ['bill_type', "TEXT NOT NULL DEFAULT 'Construction bill'"],
    ['work_done_amount', 'REAL NOT NULL DEFAULT 0 CHECK (work_done_amount >= 0)'],
    ['culture_cess_percent', 'REAL NOT NULL DEFAULT 5 CHECK (culture_cess_percent >= 0)'],
    ['rebate_percent', 'REAL NOT NULL DEFAULT 2 CHECK (rebate_percent >= 0)'],
    ['rebate_include_escalation', "TEXT NOT NULL DEFAULT 'Exclude' CHECK (rebate_include_escalation IN ('Include', 'Exclude'))"],
    ['escalation_type', "TEXT NOT NULL DEFAULT 'None'"],
    ['escalation_amount', 'REAL NOT NULL DEFAULT 0 CHECK (escalation_amount >= 0)'],
    ['escalation_adjustment_type', "TEXT NOT NULL DEFAULT 'None'"],
    ['escalation_adjustment_amount', 'REAL NOT NULL DEFAULT 0 CHECK (escalation_adjustment_amount >= 0)'],
    ['previous_bill_number', "TEXT NOT NULL DEFAULT ''"],
    ['previous_bill_amount', 'REAL NOT NULL DEFAULT 0 CHECK (previous_bill_amount >= 0)'],
    ['release_amount', 'REAL NOT NULL DEFAULT 0 CHECK (release_amount >= 0)'],
    ['release_against', "TEXT NOT NULL DEFAULT ''"],
    ['release_date', 'TEXT'],
    ['release_remark', "TEXT NOT NULL DEFAULT ''"],
    ['financial_year', "TEXT NOT NULL DEFAULT ''"],
    ['security_percent', 'REAL NOT NULL DEFAULT 5 CHECK (security_percent >= 0)'],
    ['cgst_percent', 'REAL NOT NULL DEFAULT 1 CHECK (cgst_percent >= 0)'],
    ['sgst_percent', 'REAL NOT NULL DEFAULT 1 CHECK (sgst_percent >= 0)'],
    ['income_tax_percent', 'REAL NOT NULL DEFAULT 2 CHECK (income_tax_percent >= 0)'],
    ['labour_cess_percent', 'REAL NOT NULL DEFAULT 1 CHECK (labour_cess_percent >= 0)'],
    ['construction_cess_percent', 'REAL NOT NULL DEFAULT 1 CHECK (construction_cess_percent >= 0)'],
    ['tpa_amount', 'REAL NOT NULL DEFAULT 0 CHECK (tpa_amount >= 0)'],
    ['withheld_amount', 'REAL NOT NULL DEFAULT 0 CHECK (withheld_amount >= 0)'],
    ['other_deduction_type', "TEXT NOT NULL DEFAULT ''"],
    ['other_deduction_description', "TEXT NOT NULL DEFAULT ''"],
    ['other_deduction_amount', 'REAL NOT NULL DEFAULT 0 CHECK (other_deduction_amount >= 0)'],
    ['received_date', 'TEXT'],
    ['cheque_number', "TEXT NOT NULL DEFAULT ''"],
  ];
  const migrateBills = db.transaction(() => {
    for (const [name, definition] of billColumns) {
      if (!existingBillColumns.has(name)) {
        db.exec(`ALTER TABLE bills ADD COLUMN ${name} ${definition}`);
      }
    }
  });
  migrateBills();
  db.transaction(() => {
    const billsWithoutFinancialYear = db.prepare(`
      SELECT id, bill_date FROM bills WHERE financial_year = ''
    `).all();
    const updateFinancialYear = db.prepare('UPDATE bills SET financial_year = ? WHERE id = ?');
    for (const bill of billsWithoutFinancialYear) {
      const [year, month] = bill.bill_date.split('-').map(Number);
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) continue;
      const startYear = month >= 4 ? year : year - 1;
      const financialYear = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
      updateFinancialYear.run(financialYear, bill.id);
    }
  })();

  const billTypeMigration = db.transaction(() => {
    const migrated = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get('construction-maintenance-bill-types');
    if (migrated) return;
    db.exec(`
      UPDATE bills
      SET bill_type = 'Construction bill'
      WHERE bill_type NOT IN ('Construction bill', 'Maintenance bill')
    `);
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('construction-maintenance-bill-types');
  });
  billTypeMigration();

  for (const table of ['tender_files', 'bill_files']) {
    const columns = new Set(db.pragma(`table_info(${table})`).map((column) => column.name));
    if (!columns.has('short_name')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN short_name TEXT NOT NULL DEFAULT ''`);
    }
  }

  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      'admin',
      `${salt}:${hash}`,
    );
  }
  return db;
}

function verifyPassword(db, username, password) {
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const [salt, storedHash] = user.password_hash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) return null;
  return { username: user.username };
}

module.exports = { createDatabase, verifyPassword };
