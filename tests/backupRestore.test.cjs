const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const Database = require('better-sqlite3');
const { createDatabase } = require('../electron/database.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tender-desk-backup-test-'));
const dataDirectory = path.join(root, 'userData', 'data');
const downloadsDirectory = path.join(root, 'Downloads');
const tempDirectory = path.join(root, 'temp');
fs.mkdirSync(downloadsDirectory, { recursive: true });
fs.mkdirSync(tempDirectory, { recursive: true });

let selectedBackup = '';
let confirmationResponse = 0;
const electronMock = {
  app: {
    getPath(name) {
      return name === 'downloads' ? downloadsDirectory : tempDirectory;
    },
  },
  dialog: {
    async showOpenDialog() {
      return { canceled: false, filePaths: [selectedBackup] };
    },
    async showMessageBox() {
      return { response: confirmationResponse };
    },
  },
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'electron') return electronMock;
  return originalLoad.call(this, request, parent, isMain);
};
const { createBackupManager } = require('../electron/backupRestore.cjs');
Module._load = originalLoad;

let database;
let maintenance = false;
const progressEvents = [];

function insertFixtureData(db) {
  db.prepare(`
    INSERT INTO tenders (id, tender_name, tender_date, completion_date, bidding_amount)
    VALUES (?, ?, ?, ?, ?)
  `).run('TND-TEST-1', 'Tender Before Backup', '2026-01-01', '2026-12-31', 125000);
  db.prepare('INSERT INTO tender_projects (tender_id, project_name) VALUES (?, ?)').run('TND-TEST-1', 'Road Project');
  db.prepare(`
    INSERT INTO bills (id, tender_id, bill_name, project_name, bill_date, bill_type, work_done_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('BILL-TEST-1', 'TND-TEST-1', 'Construction 1', 'Road Project', '2026-02-01', 'Construction bill', 25000);
  db.prepare(`
    INSERT INTO project_completions (id, tender_id, project_name, security_amount, security_refund, balance_security)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('COMP-TEST-1', 'TND-TEST-1', 'Tender Before Backup', 1250, 0, 1250);

  const fileRows = [
    ['tender_files', 'TENDER-FILE-1', 'tender_id', 'TND-TEST-1', 'tenders/TND-TEST-1/documents/notice.pdf', 'tender document'],
    ['bill_files', 'BILL-FILE-1', 'bill_id', 'BILL-TEST-1', 'tenders/TND-TEST-1/bills/BILL-TEST-1/bill.pdf', 'bill document'],
    ['project_completion_files', 'COMPLETION-FILE-1', 'completion_id', 'COMP-TEST-1', 'tenders/TND-TEST-1/completions/COMP-TEST-1/closeout.pdf', 'completion document'],
  ];
  for (const [table, id, ownerColumn, ownerId, filePath, content] of fileRows) {
    const absolutePath = path.join(dataDirectory, ...filePath.split('/'));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
    db.prepare(`INSERT INTO ${table} (id, ${ownerColumn}, file_name, file_path) VALUES (?, ?, ?, ?)`)
      .run(id, ownerId, path.basename(filePath), filePath);
  }
}

async function run() {
  database = createDatabase(dataDirectory);
  insertFixtureData(database);
  const originalPasswordHash = database.prepare('SELECT password_hash FROM users WHERE username = ?').get('admin').password_hash;

  const manager = createBackupManager({
    dataDirectory,
    getDatabase: () => database,
    replaceDatabase(nextDatabase) {
      database = nextDatabase;
    },
    setMaintenanceMode(value) {
      maintenance = value;
    },
    onProgress(event) {
      progressEvents.push(event);
    },
  });

  const backupResult = await manager.backup();
  assert.equal(backupResult.canceled, false);
  assert.match(backupResult.fileName, /^TenderBackup_\d{4}-\d{2}-\d{2}_\d{6}(?:_\d+)?\.zip$/);
  selectedBackup = path.join(downloadsDirectory, backupResult.fileName);
  assert.equal(fs.existsSync(selectedBackup), true);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1, 'live sign-in records remain unchanged');
  assert.equal(maintenance, false);

  const snapshotDirectory = path.join(root, 'snapshot-check');
  fs.mkdirSync(snapshotDirectory);
  await require('extract-zip')(selectedBackup, { dir: snapshotDirectory });
  const snapshotDatabase = new Database(path.join(snapshotDirectory, 'database.sqlite'), { readonly: true });
  assert.equal(snapshotDatabase.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0, 'backup omits local credentials');
  assert.equal(snapshotDatabase.prepare('SELECT COUNT(*) AS count FROM tenders').get().count, 1);
  assert.equal(snapshotDatabase.prepare('SELECT COUNT(*) AS count FROM bills').get().count, 1);
  snapshotDatabase.close();
  assert.equal(fs.readFileSync(path.join(snapshotDirectory, 'tenders/TND-TEST-1/documents/notice.pdf'), 'utf8'), 'tender document');
  assert.equal(fs.readFileSync(path.join(snapshotDirectory, 'tenders/TND-TEST-1/bills/BILL-TEST-1/bill.pdf'), 'utf8'), 'bill document');
  assert.equal(fs.readFileSync(path.join(snapshotDirectory, 'tenders/TND-TEST-1/completions/COMP-TEST-1/closeout.pdf'), 'utf8'), 'completion document');

  database.prepare('UPDATE tenders SET tender_name = ? WHERE id = ?').run('Tender Changed After Backup', 'TND-TEST-1');
  database.prepare('UPDATE bills SET bill_name = ? WHERE id = ?').run('Changed bill', 'BILL-TEST-1');
  fs.rmSync(path.join(dataDirectory, 'tenders/TND-TEST-1'), { recursive: true });
  confirmationResponse = 0;
  const restoreResult = await manager.restore();
  assert.equal(restoreResult.canceled, false);
  assert.equal(restoreResult.tenderCount, 1);
  assert.equal(restoreResult.billCount, 1);
  assert.equal(restoreResult.fileCount, 3);
  assert.equal(maintenance, false);
  assert.equal(database.prepare('SELECT tender_name FROM tenders WHERE id = ?').get('TND-TEST-1').tender_name, 'Tender Before Backup');
  assert.equal(database.prepare('SELECT bill_name FROM bills WHERE id = ?').get('BILL-TEST-1').bill_name, 'Construction 1');
  assert.equal(database.prepare('SELECT password_hash FROM users WHERE username = ?').get('admin').password_hash, originalPasswordHash, 'restore retains this installation sign-in');
  assert.equal(fs.readFileSync(path.join(dataDirectory, 'tenders/TND-TEST-1/documents/notice.pdf'), 'utf8'), 'tender document');
  assert.equal(fs.readFileSync(path.join(dataDirectory, 'tenders/TND-TEST-1/bills/BILL-TEST-1/bill.pdf'), 'utf8'), 'bill document');
  assert.equal(fs.readFileSync(path.join(dataDirectory, 'tenders/TND-TEST-1/completions/COMP-TEST-1/closeout.pdf'), 'utf8'), 'completion document');
  assert.equal(fs.existsSync(path.join(downloadsDirectory, restoreResult.safetyBackup)), true, 'restore wrote a safety backup');

  selectedBackup = path.join(root, 'invalid.zip');
  fs.writeFileSync(selectedBackup, 'not a zip archive');
  await assert.rejects(manager.restore(), /Restore failed/);
  assert.equal(database.prepare('SELECT tender_name FROM tenders WHERE id = ?').get('TND-TEST-1').tender_name, 'Tender Before Backup', 'invalid restore leaves data untouched');
  assert.equal(maintenance, false);
  assert(progressEvents.some(({ phase }) => phase === 'complete'), 'progress reports completion');
  console.log('Backup/restore integration passed: database rows, IDs, document paths, credentials, safety backup and invalid archive handling.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      if (database?.open) database.close();
    } catch (error) {
      console.error('Could not close test database:', error);
      process.exitCode = 1;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
