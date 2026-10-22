const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { dialog, app } = require('electron');
const Database = require('better-sqlite3');
const extractZip = require('extract-zip');
const yauzl = require('yauzl');
const { createDatabase } = require('./database.cjs');

const FORMAT = 'tender-desk-backup';
const FORMAT_VERSION = 1;
const MAX_ARCHIVE_ENTRIES = 100_000;
const MAX_ARCHIVE_SIZE = 20 * 1024 * 1024 * 1024;
const REQUIRED_TABLES = [
  'users',
  'tenders',
  'bills',
  'tender_projects',
  'tender_bank_guarantees',
  'project_completions',
  'tender_files',
  'bill_files',
  'project_completion_files',
];

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sendProgress(onProgress, phase, percent, message) {
  onProgress?.({ phase, percent, message });
}

function copyDirectory(source, destination) {
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Backup stopped because the tender folder is a symbolic link.');
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Backup stopped because "${entry.name}" is a symbolic link.`);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    else throw new Error(`Backup stopped because "${entry.name}" is not a regular file.`);
  }
}

function archiveToFile(sourceDirectory, outputPath, onProgress) {
  return import('archiver').then(({ ZipArchive }) => new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath, { flags: 'wx' });
    const archive = new ZipArchive({ zlib: { level: 6 } });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      archive.abort();
      output.destroy();
      reject(error);
    };
    output.on('close', () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    output.on('error', fail);
    archive.on('error', fail);
    archive.on('warning', fail);
    archive.on('progress', ({ entries, fs: fileProgress }) => {
      const percent = fileProgress.totalBytes
        ? Math.min(99, Math.round(fileProgress.processedBytes / fileProgress.totalBytes * 100))
        : entries.total
          ? Math.min(99, Math.round(entries.processed / entries.total * 100))
          : 0;
      sendProgress(onProgress, 'archive', percent, 'Compressing backup files…');
    });
    archive.pipe(output);
    archive.file(path.join(sourceDirectory, 'database.sqlite'), { name: 'database.sqlite' });
    archive.file(path.join(sourceDirectory, 'manifest.json'), { name: 'manifest.json' });
    archive.directory(path.join(sourceDirectory, 'tenders'), 'tenders');
    archive.finalize().catch(fail);
  }));
}

function readArchiveEntries(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError) return reject(openError);
      const entries = [];
      const names = new Set();
      let expandedSize = 0;
      let finished = false;
      const fail = (error) => {
        if (finished) return;
        finished = true;
        zipFile.close();
        reject(error);
      };
      zipFile.on('error', fail);
      zipFile.on('end', () => {
        if (finished) return;
        finished = true;
        resolve(entries);
      });
      zipFile.on('entry', (entry) => {
        const unsafeName = yauzl.validateFileName(entry.fileName);
        if (unsafeName) return fail(new Error(`The selected archive contains an unsafe path: ${entry.fileName}`));
        const segments = entry.fileName.split('/');
        const cleanSegments = segments.filter(Boolean);
        if (!cleanSegments.length || cleanSegments.includes('.') || cleanSegments.includes('..') || cleanSegments[0] === '__MACOSX') {
          return fail(new Error(`The selected archive contains an unsupported path: ${entry.fileName}`));
        }
        const canonicalName = cleanSegments.join('/');
        if (names.has(canonicalName)) return fail(new Error(`The selected archive contains a duplicate item: ${entry.fileName}`));
        names.add(canonicalName);
        if (!['manifest.json', 'database.sqlite', 'tenders'].includes(cleanSegments[0])) {
          return fail(new Error(`The selected archive contains an unexpected item: ${entry.fileName}`));
        }
        const fileType = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (fileType === 0o120000) return fail(new Error('The selected archive contains a symbolic link, which is not allowed.'));
        if (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000) {
          return fail(new Error(`The selected archive contains an unsupported file type: ${entry.fileName}`));
        }
        if (cleanSegments[0] === 'manifest.json' && cleanSegments.length !== 1
          || cleanSegments[0] === 'database.sqlite' && cleanSegments.length !== 1) {
          return fail(new Error(`The selected archive has an invalid root path: ${entry.fileName}`));
        }
        if ((cleanSegments[0] === 'manifest.json' || cleanSegments[0] === 'database.sqlite')
          && fileType !== 0 && fileType !== 0o100000) {
          return fail(new Error(`The archive entry "${entry.fileName}" is not a regular file.`));
        }
        if (cleanSegments[0] === 'tenders' && cleanSegments.length === 1 && fileType !== 0 && fileType !== 0o040000) {
          return fail(new Error('The archive entry for the tenders folder is not a directory.'));
        }
        expandedSize += entry.uncompressedSize;
        entries.push(entry.fileName);
        if (entries.length > MAX_ARCHIVE_ENTRIES || expandedSize > MAX_ARCHIVE_SIZE) {
          return fail(new Error('The selected archive is larger than the supported import limit.'));
        }
        zipFile.readEntry();
      });
      zipFile.readEntry();
    });
  });
}

function normalizeStoredFilePath(value) {
  if (typeof value !== 'string') throw new Error('The selected database contains an invalid document reference.');
  const normalizedPath = value.replaceAll('\\', '/');
  const parts = normalizedPath.split('/');
  if (parts[0] !== 'tenders' || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error('The selected database contains an invalid document reference.');
  }
  return parts.join('/');
}

function normalizeDatabaseFileReferences(databasePath) {
  const database = new Database(databasePath, { fileMustExist: true });
  try {
    database.transaction(() => {
      for (const table of ['tender_files', 'bill_files', 'project_completion_files']) {
        const rows = database.prepare(`SELECT id, file_path FROM ${table}`).all();
        const update = database.prepare(`UPDATE ${table} SET file_path = ? WHERE id = ?`);
        for (const { id, file_path: filePath } of rows) {
          const normalizedPath = normalizeStoredFilePath(filePath);
          if (normalizedPath !== filePath) update.run(normalizedPath, id);
        }
      }
    })();
  } finally {
    database.close();
  }
}

function ensureReferencedFiles(databasePath, extractedDirectory) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name));
    for (const table of REQUIRED_TABLES) {
      if (!tables.has(table)) throw new Error(`The selected database is missing the "${table}" table.`);
    }
    if (database.prepare('SELECT COUNT(*) AS count FROM users').get().count !== 0) {
      throw new Error('The selected backup contains local sign-in credentials and cannot be imported.');
    }
    const integrity = database.pragma('integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      throw new Error('The selected database failed its SQLite integrity check.');
    }
    if (database.pragma('foreign_key_check').length) {
      throw new Error('The selected database contains broken tender or bill relationships.');
    }
    const referencedFiles = [
      ...database.prepare('SELECT file_path FROM tender_files').all(),
      ...database.prepare('SELECT file_path FROM bill_files').all(),
      ...database.prepare('SELECT file_path FROM project_completion_files').all(),
    ];
    for (const { file_path: relativePath } of referencedFiles) {
      const normalizedPath = normalizeStoredFilePath(relativePath);
      const parts = normalizedPath.split('/');
      const fullPath = path.resolve(extractedDirectory, ...parts);
      if (!fullPath.startsWith(`${path.resolve(extractedDirectory, 'tenders')}${path.sep}`)) {
        throw new Error('The selected database contains an unsafe document reference.');
      }
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch {
        throw new Error(`A document referenced by the database is missing: ${path.basename(fullPath)}.`);
      }
      if (!stats.isFile()) throw new Error(`A document reference is not a file: ${path.basename(fullPath)}.`);
    }
    return {
      tenderCount: database.prepare('SELECT COUNT(*) AS count FROM tenders').get().count,
      billCount: database.prepare('SELECT COUNT(*) AS count FROM bills').get().count,
      fileCount: referencedFiles.length,
    };
  } finally {
    database.close();
  }
}

async function validateBackup(zipPath, extractionDirectory, onProgress) {
  sendProgress(onProgress, 'validation', 5, 'Checking the backup archive…');
  const entries = await readArchiveEntries(zipPath);
  if (!entries.includes('manifest.json') || !entries.includes('database.sqlite')
    || !entries.some((entry) => entry === 'tenders/' || entry.startsWith('tenders/'))) {
    throw new Error('This ZIP is not a complete Tender Desk backup.');
  }
  await extractZip(zipPath, {
    dir: extractionDirectory,
    onEntry(entry) {
      if (yauzl.validateFileName(entry.fileName)) {
        throw new Error(`The selected archive contains an unsafe path: ${entry.fileName}`);
      }
      const fileType = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (fileType === 0o120000) throw new Error('The selected archive contains a symbolic link, which is not allowed.');
    },
  });
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(extractionDirectory, 'manifest.json'), 'utf8'));
  } catch {
    throw new Error('The backup manifest is missing or invalid.');
  }
  if (manifest.format !== FORMAT || manifest.version !== FORMAT_VERSION) {
    throw new Error('This backup was created by an unsupported Tender Desk version.');
  }
  normalizeDatabaseFileReferences(path.join(extractionDirectory, 'database.sqlite'));
  const stats = ensureReferencedFiles(path.join(extractionDirectory, 'database.sqlite'), extractionDirectory);
  sendProgress(onProgress, 'validation', 20, `Backup validated: ${stats.tenderCount} tenders, ${stats.billCount} bills and ${stats.fileCount} documents.`);
  return stats;
}

function createBackupManager({
  dataDirectory,
  getDatabase,
  replaceDatabase,
  setMaintenanceMode,
  onProgress,
}) {
  let operationInProgress = false;
  function beginOperation() {
    if (operationInProgress) throw new Error('A backup or restore is already in progress.');
    operationInProgress = true;
    setMaintenanceMode(true);
  }
  function endOperation() {
    operationInProgress = false;
    setMaintenanceMode(false);
  }

  async function writeBackup(outputPath, purpose = 'user') {
    const tempRoot = fs.mkdtempSync(path.join(app.getPath('temp'), 'tender-desk-backup-'));
    const partialPath = `${outputPath}.partial-${crypto.randomUUID()}`;
    try {
      sendProgress(onProgress, 'database', 2, 'Creating a consistent SQLite snapshot…');
      await getDatabase().backup(path.join(tempRoot, 'database.sqlite'), {
        progress({ totalPages, remainingPages }) {
          const fraction = totalPages ? (totalPages - remainingPages) / totalPages : 1;
          sendProgress(onProgress, 'database', 2 + Math.round(fraction * 25), 'Creating a consistent SQLite snapshot…');
        },
      });
      const snapshot = new Database(path.join(tempRoot, 'database.sqlite'));
      try {
        snapshot.pragma('journal_mode = DELETE');
        snapshot.exec('DELETE FROM users');
        snapshot.exec('VACUUM');
      } finally {
        snapshot.close();
      }
      sendProgress(onProgress, 'files', 30, 'Gathering tender folders and documents…');
      const tendersDirectory = path.join(dataDirectory, 'tenders');
      const stagedTendersDirectory = path.join(tempRoot, 'tenders');
      fs.mkdirSync(tendersDirectory, { recursive: true });
      copyDirectory(tendersDirectory, stagedTendersDirectory);
      fs.writeFileSync(path.join(tempRoot, 'manifest.json'), JSON.stringify({
        format: FORMAT,
        version: FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        purpose,
        contents: ['database.sqlite', 'tenders/'],
        credentialsExcluded: true,
      }, null, 2));
      sendProgress(onProgress, 'archive', 35, 'Compressing the backup…');
      await archiveToFile(tempRoot, partialPath, onProgress);
      fs.renameSync(partialPath, outputPath);
      sendProgress(onProgress, 'complete', 100, 'Backup saved successfully.');
      return outputPath;
    } catch (error) {
      if (fs.existsSync(partialPath)) fs.rmSync(partialPath, { force: true });
      throw error;
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  function nextSafetyBackupPath() {
    const downloads = app.getPath('downloads');
    const baseName = `TenderBackup_PreRestore_${timestamp()}`;
    let candidate = path.join(downloads, `${baseName}.zip`);
    let suffix = 1;
    while (fs.existsSync(candidate)) candidate = path.join(downloads, `${baseName}_${suffix++}.zip`);
    return candidate;
  }

  function nextBackupPath() {
    const downloads = app.getPath('downloads');
    const baseName = `TenderBackup_${timestamp()}`;
    let candidate = path.join(downloads, `${baseName}.zip`);
    let suffix = 1;
    while (fs.existsSync(candidate)) candidate = path.join(downloads, `${baseName}_${suffix++}.zip`);
    return candidate;
  }

  async function backup() {
    beginOperation();
    try {
      const backupPath = nextBackupPath();
      await writeBackup(backupPath);
      return { canceled: false, fileName: path.basename(backupPath) };
    } finally {
      endOperation();
    }
  }

  async function restore() {
    beginOperation();
    let tempRoot = '';
    let extractedDirectory = '';
    let closedDatabase = false;
    let swapped = false;
    let rollbackDirectory = '';
    try {
      tempRoot = fs.mkdtempSync(path.join(path.dirname(dataDirectory), '.tender-desk-restore-'));
      extractedDirectory = path.join(tempRoot, 'restored-data');
      const selection = await dialog.showOpenDialog({
        title: 'Select a Tender Desk backup',
        defaultPath: app.getPath('downloads'),
        properties: ['openFile'],
        filters: [{ name: 'Tender Desk backup', extensions: ['zip'] }],
      });
      if (selection.canceled || !selection.filePaths.length) return { canceled: true };
      const backupPath = selection.filePaths[0];
      fs.mkdirSync(extractedDirectory, { recursive: true });
      const stats = await validateBackup(backupPath, extractedDirectory, onProgress);
      const confirmation = await dialog.showMessageBox({
        type: 'warning',
        title: 'Replace current Tender Desk data?',
        message: 'Restoring this backup will replace all current tenders, bills and documents.',
        detail: 'A safety backup of the current data will be saved to Downloads before anything is replaced. Continue only if you want to replace the current records.',
        buttons: ['Restore backup', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (confirmation.response !== 0) return { canceled: true };

      const safetyPath = nextSafetyBackupPath();
      sendProgress(onProgress, 'safety-backup', 22, 'Creating a safety backup before restoring…');
      await writeBackup(safetyPath, 'automatic-safety-before-restore');
      sendProgress(onProgress, 'restore', 65, 'Replacing the current tender database and documents…');

      const localUsers = getDatabase().prepare('SELECT username, password_hash, created_at FROM users').all();
      rollbackDirectory = path.join(path.dirname(dataDirectory), `data-before-restore-${crypto.randomUUID()}`);
      getDatabase().close();
      closedDatabase = true;
      fs.renameSync(dataDirectory, rollbackDirectory);
      fs.mkdirSync(dataDirectory, { recursive: true });
      fs.renameSync(path.join(extractedDirectory, 'database.sqlite'), path.join(dataDirectory, 'database.sqlite'));
      fs.renameSync(path.join(extractedDirectory, 'tenders'), path.join(dataDirectory, 'tenders'));
      swapped = true;

      const importedDatabase = new Database(path.join(dataDirectory, 'database.sqlite'));
      try {
        const insertUser = importedDatabase.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)');
        for (const user of localUsers) insertUser.run(user.username, user.password_hash, user.created_at);
      } finally {
        importedDatabase.close();
      }
      const restoredDatabase = createDatabase(dataDirectory);
      replaceDatabase(restoredDatabase);
      sendProgress(onProgress, 'complete', 100, 'Data restored successfully.');
      try {
        fs.rmSync(rollbackDirectory, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Could not remove temporary restore rollback data:', cleanupError);
      }
      return { canceled: false, fileName: path.basename(backupPath), safetyBackup: path.basename(safetyPath), ...stats };
    } catch (error) {
      if (closedDatabase) {
        try {
          const current = getDatabase();
          if (current?.open) current.close();
        } catch (closeError) {
          console.error('Could not close the current database during restore rollback:', closeError);
        }
        try {
          if (swapped && fs.existsSync(dataDirectory)) fs.rmSync(dataDirectory, { recursive: true, force: true });
          if (rollbackDirectory && fs.existsSync(rollbackDirectory)) fs.renameSync(rollbackDirectory, dataDirectory);
          const recoveredDatabase = createDatabase(dataDirectory);
          replaceDatabase(recoveredDatabase);
        } catch (rollbackError) {
          throw new Error(`Restore failed and rollback could not reopen the previous data. Recovery data remains at "${rollbackDirectory}". ${rollbackError.message}`);
        }
      }
      throw new Error(`Restore failed${rollbackDirectory ? '; the previous data has been preserved' : ''}: ${error.message}`);
    } finally {
      endOperation();
      if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  return { backup, restore };
}

module.exports = { createBackupManager };
