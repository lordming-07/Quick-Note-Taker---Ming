const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveNote: (text) => ipcRenderer.invoke('save-note', text),
    loadNote: () => ipcRenderer.invoke('load-note'),

    saveAs: (text) => ipcRenderer.invoke('save-as', text),
    newNote: (hasUnsavedChanges) => ipcRenderer.invoke('new-note', hasUnsavedChanges),
    openFile: () => ipcRenderer.invoke('open-file'),
    smartSave: (text, filePath) => ipcRenderer.invoke('smart-save', text, filePath),

    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveJsonNote: (note) => ipcRenderer.invoke('save-json-note', note),
    deleteJsonNote: (noteId) => ipcRenderer.invoke('delete-json-note', noteId),

    deleteAllNotes: () => ipcRenderer.invoke('delete-all-notes'),

    onMenuAction: (channel, callback) => {
        const validChannels = [
            'menu-new-note',
            'menu-open-file',
            'menu-save',
            'menu-save-as'
        ];

        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
        }
    }
});