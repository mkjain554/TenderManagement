const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { dialog, shell } = require('electron');

function createFileManager(db, dataDirectory) {
  const root = path.resolve(dataDirectory);
  const pendingUploads = new Map();

  function resolveStoredPath(relativePath) {
    const resolved = path.resolve(root, relativePath);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error('The requested file path is invalid.');
    }
    return resolved;
  }

  async function selectFiles(ownerId, kind) {
    const owner = kind === 'tender'
      ? db.prepare('SELECT id FROM tenders WHERE id = ?').get(ownerId)
      : kind === 'bill'
        ? db.prepare('SELECT id, tender_id FROM bills WHERE id = ?').get(ownerId)
        : db.prepare('SELECT id FROM project_completions WHERE id = ?').get(ownerId);
    if (!owner) throw new Error(kind === 'tender' ? 'Tender not found.' : kind === 'bill' ? 'Bill not found.' : 'Project completion not found.');

    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Choose documents',
    });
    if (result.canceled || result.filePaths.length === 0) return [];

    const selections = result.filePaths.map((source) => {
      const token = crypto.randomUUID();
      const fileName = path.basename(source);
      pendingUploads.set(token, { ownerId, kind, source, fileName });
      return { token, file_name: fileName };
    });
    return selections;
  }

  function saveSelectedFile(ownerId, token, shortName) {
    const selection = pendingUploads.get(token);
    if (!selection || selection.ownerId !== ownerId) throw new Error('This file selection has expired. Please choose the file again.');
    const cleanShortName = typeof shortName === 'string' ? shortName.trim() : '';
    if (!/^[\p{L}\p{N}_ -]{1,10}$/u.test(cleanShortName)) {
      throw new Error('Short name must be 1–10 letters, numbers, spaces, hyphens or underscores.');
    }

    const owner = selection.kind === 'tender'
      ? db.prepare('SELECT id FROM tenders WHERE id = ?').get(ownerId)
      : selection.kind === 'bill'
        ? db.prepare('SELECT id, tender_id FROM bills WHERE id = ?').get(ownerId)
        : db.prepare('SELECT id, tender_id FROM project_completions WHERE id = ?').get(ownerId);
    if (!owner) throw new Error(selection.kind === 'tender' ? 'Tender not found.' : selection.kind === 'bill' ? 'Bill not found.' : 'Project completion not found.');
    const relativeFolder = selection.kind === 'tender'
      ? path.join('tenders', ownerId, 'documents')
      : selection.kind === 'bill'
        ? path.join('tenders', owner.tender_id, 'bills', ownerId)
        : path.join('tenders', owner.tender_id, 'completions', ownerId);
    const folder = resolveStoredPath(relativeFolder);
    fs.mkdirSync(folder, { recursive: true });
    const table = selection.kind === 'tender' ? 'tender_files' : selection.kind === 'bill' ? 'bill_files' : 'project_completion_files';
    const ownerColumn = selection.kind === 'tender' ? 'tender_id' : selection.kind === 'bill' ? 'bill_id' : 'completion_id';
    const fileName = selection.fileName;
    let storedName = fileName;
    let target = path.join(folder, storedName);
    let suffix = 1;
    while (fs.existsSync(target)) {
      const extension = path.extname(fileName);
      const baseName = path.basename(fileName, extension);
      storedName = `${baseName} (${suffix++})${extension}`;
      target = path.join(folder, storedName);
    }

    const id = crypto.randomUUID();
    const relativePath = path.relative(root, target);
    try {
      fs.copyFileSync(selection.source, target, fs.constants.COPYFILE_EXCL);
      db.prepare(
        `INSERT INTO ${table} (id, ${ownerColumn}, short_name, file_name, file_path) VALUES (?, ?, ?, ?, ?)`,
      ).run(id, ownerId, cleanShortName, fileName, relativePath);
      pendingUploads.delete(token);
      return { id, short_name: cleanShortName, file_name: fileName };
    } catch (error) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      throw new Error(`Could not save "${fileName}": ${error.message}`);
    }
  }

  function findFile(fileId) {
    return db.prepare(`
      SELECT id, short_name, file_name, file_path FROM tender_files WHERE id = ?
      UNION ALL
      SELECT id, short_name, file_name, file_path FROM bill_files WHERE id = ?
      UNION ALL
      SELECT id, short_name, file_name, file_path FROM project_completion_files WHERE id = ?
      LIMIT 1
    `).get(fileId, fileId, fileId);
  }

  return {
    selectTenderFiles: (tenderId) => selectFiles(tenderId, 'tender'),
    selectBillFiles: (billId) => selectFiles(billId, 'bill'),
    selectCompletionFiles: (completionId) => selectFiles(completionId, 'completion'),
    saveSelectedFile,
    discardSelectedFile(token) {
      return pendingUploads.delete(token);
    },
    async open(fileId) {
      const file = findFile(fileId);
      if (!file) throw new Error('Document not found.');
      const fullPath = resolveStoredPath(file.file_path);
      if (!fs.existsSync(fullPath)) throw new Error(`The file "${file.file_name}" is missing.`);
      const error = await shell.openPath(fullPath);
      if (error) throw new Error(`Could not open the file: ${error}`);
      return true;
    },
    async download(fileId) {
      const file = findFile(fileId);
      if (!file) throw new Error('Document not found.');
      const sourcePath = resolveStoredPath(file.file_path);
      if (!fs.existsSync(sourcePath)) throw new Error(`The file "${file.file_name}" is missing.`);
      const result = await dialog.showSaveDialog({
        title: 'Save bill document',
        defaultPath: file.file_name,
      });
      if (result.canceled || !result.filePath) return false;
      try {
        fs.copyFileSync(sourcePath, result.filePath);
      } catch (error) {
        throw new Error(`Could not save "${file.file_name}": ${error.message}`);
      }
      return true;
    },
    remove(fileId) {
      const file = findFile(fileId);
      if (!file) throw new Error('Document not found.');
      const fullPath = resolveStoredPath(file.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      db.prepare('DELETE FROM tender_files WHERE id = ?').run(fileId);
      db.prepare('DELETE FROM bill_files WHERE id = ?').run(fileId);
      db.prepare('DELETE FROM project_completion_files WHERE id = ?').run(fileId);
      return true;
    },
    removeTenderFolder(tenderId) {
      const folder = resolveStoredPath(path.join('tenders', tenderId));
      if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
    },
    removeBillFolder(tenderId, billId) {
      const folder = resolveStoredPath(path.join('tenders', tenderId, 'bills', billId));
      if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
    },
  };
}

module.exports = { createFileManager };
