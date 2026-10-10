const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('tenderDesk', {
  auth: {
    login: (username, password) => invoke('auth:login', username, password),
  },
  tenders: {
    list: (options) => invoke('tenders:list', options),
    getById: (id) => invoke('tenders:getById', id),
    create: (tender) => invoke('tenders:create', tender),
    update: (id, tender) => invoke('tenders:update', id, tender),
    delete: (id) => invoke('tenders:delete', id),
  },
  bills: {
    list: (tenderId, options) => invoke('bills:list', tenderId, options),
    getById: (id) => invoke('bills:getById', id),
    getStatement: (tenderId) => invoke('bills:getStatement', tenderId),
    create: (tenderId, bill) => invoke('bills:create', tenderId, bill),
    update: (id, bill) => invoke('bills:update', id, bill),
    delete: (id) => invoke('bills:delete', id),
  },
  files: {
    selectTenderFiles: (tenderId) => invoke('files:selectTender', tenderId),
    selectBillFiles: (billId) => invoke('files:selectBill', billId),
    saveSelectedFile: (ownerId, token, shortName) => invoke('files:saveSelected', ownerId, token, shortName),
    discardSelectedFile: (token) => invoke('files:discardSelected', token),
    remove: (fileId) => invoke('files:remove', fileId),
    open: (fileId) => invoke('files:open', fileId),
    download: (fileId) => invoke('files:download', fileId),
  },
});
