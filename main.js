const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let tray = null;
let isQuiting = false;

const notesFilePath = path.join(app.getPath('userData'), 'notes.json');

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');

    win.on('close', (event) => {
        if (!isQuiting) {
            event.preventDefault();
            win.hide();
        }
    });
}

function readNotes() {
    if (!fs.existsSync(notesFilePath)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(notesFilePath, 'utf-8');
        return JSON.parse(raw);
    } catch (error) {
        return [];
    }
}

function writeNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

function createMenu() {
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) win.webContents.send('menu-new-note');
                    }
                },
                {
                    label: 'Open File',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) win.webContents.send('menu-open-file');
                    }
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) win.webContents.send('menu-save');
                    }
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        const win = BrowserWindow.getFocusedWindow();
                        if (win) win.webContents.send('menu-save-as');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        isQuiting = true;
                        app.quit();
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'tray-icon.png'));

    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                const win = BrowserWindow.getAllWindows()[0];
                if (win) {
                    win.show();
                    win.focus();
                }
            }
        },
        {
            label: 'Quit',
            click: () => {
                isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Quick Note Taker');
    tray.setContextMenu(trayMenu);

    tray.on('double-click', () => {
        const win = BrowserWindow.getAllWindows()[0];

        if (!win) return;

        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createMenu();
    createTray();

    ipcMain.handle('save-note', async (event, text) => {
        const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
        fs.writeFileSync(filePath, text);
        return { success: true };
    });

    ipcMain.handle('load-note', async () => {
        const filePath = path.join(app.getPath('documents'), 'quicknote.txt');

        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }

        return '';
    });

    ipcMain.handle('save-as', async (event, text) => {
        const result = await dialog.showSaveDialog({
            defaultPath: 'mynote.txt'
        });

        if (result.canceled) {
            return { success: false };
        }

        fs.writeFileSync(result.filePath, text);
        return { success: true, filePath: result.filePath };
    });

    ipcMain.handle('new-note', async () => {
        const result = await dialog.showMessageBox({
            type: 'warning',
            buttons: ['Discard', 'Cancel'],
            message: 'Unsaved changes. Continue?'
        });

        return { confirmed: result.response === 0 };
    });

    ipcMain.handle('open-file', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (result.canceled) {
            return { success: false };
        }

        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');

        return { success: true, content, filePath };
    });

    ipcMain.handle('smart-save', async (event, text, filePath) => {
        if (filePath) {
            fs.writeFileSync(filePath, text);
            return { success: true, filePath };
        }

        const result = await dialog.showSaveDialog({
            defaultPath: 'mynote.txt'
        });

        if (result.canceled) {
            return { success: false };
        }

        fs.writeFileSync(result.filePath, text);
        return { success: true, filePath: result.filePath };
    });

    ipcMain.handle('get-notes', async () => {
        return readNotes();
    });

    ipcMain.handle('delete-note', async (event, id) => {
        const notes = readNotes();
        const filtered = notes.filter(n => n.id !== id);

        writeNotes(filtered);

        return { success: true };
    });

    ipcMain.handle('save-note-json', async (event, note) => {
        const notes = readNotes();
        const index = notes.findIndex(n => n.id === note.id);
        const now = new Date().toISOString();

        if (index === -1) {
            notes.push({
                ...note,
                createdAt: now,
                updatedAt: now
            });
        } else {
            notes[index] = {
                ...notes[index],
                ...note,
                updatedAt: now
            };
        }

        writeNotes(notes);

        return { success: true };
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});