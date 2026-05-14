const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

let mainWindow;
let tray;
let isQuiting = false;

function getQuickNotePath() {
    return path.join(app.getPath('documents'), 'quicknote.txt');
}

function getNotesFilePath() {
    return path.join(app.getPath('userData'), 'notes.json');
}

function readNotes() {
    const notesFilePath = getNotesFilePath();

    if (!fs.existsSync(notesFilePath)) {
        return [];
    }

    try {
        const data = fs.readFileSync(notesFilePath, 'utf-8');

        if (!data.trim()) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading notes:', error);
        return [];
    }
}

function writeNotes(notes) {
    const notesFilePath = getNotesFilePath();
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 650,
        title: 'Quick Note Taker',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function createAppMenu() {
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-new-note');
                        }
                    }
                },
                {
                    label: 'Open File',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-open-file');
                        }
                    }
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-save');
                        }
                    }
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-save-as');
                        }
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
    // Your icon location:
    // quick-note-taker/assets/note taker icon.png
    const iconPath = path.join(__dirname, 'assets', 'image.png');

    console.log('Tray icon path:', iconPath);
    console.log('Icon exists:', fs.existsSync(iconPath));

    let icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
        console.log('ERROR: Tray icon is empty. Check file name and location.');
        return;
    }

    icon = icon.resize({
        width: 16,
        height: 16
    });

    tray = new Tray(icon);
    tray.setToolTip('Quick Note Taker');

    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'Show Quick Note Taker',
            click: () => {
                if (!mainWindow) return;

                mainWindow.show();
                mainWindow.focus();
            }
        },
        {
            label: 'Hide Quick Note Taker',
            click: () => {
                if (!mainWindow) return;

                mainWindow.hide();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(trayMenu);

    tray.on('click', () => {
        if (!mainWindow) return;

        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createAppMenu();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            mainWindow.show();
        }
    });
});

app.on('before-quit', () => {
    isQuiting = true;
});

app.on('window-all-closed', () => {
    // Keep app running because tray icon should stay active.
    // User can quit from File > Quit or tray > Quit.
});

// -------------------------------
// IPC HANDLERS
// -------------------------------

ipcMain.handle('save-note', async (event, text) => {
    const filePath = getQuickNotePath();
    fs.writeFileSync(filePath, text, 'utf-8');

    return {
        success: true,
        filePath: filePath
    };
});

ipcMain.handle('load-note', async () => {
    const filePath = getQuickNotePath();

    if (fs.existsSync(filePath)) {
        const text = fs.readFileSync(filePath, 'utf-8');

        return {
            success: true,
            text: text,
            filePath: filePath
        };
    }

    return {
        success: false,
        text: '',
        filePath: filePath
    };
});

ipcMain.handle('save-as', async (event, text) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'mynote.txt',
        filters: [
            { name: 'Text Files', extensions: ['txt'] }
        ]
    });

    if (result.canceled || !result.filePath) {
        return {
            success: false
        };
    }

    fs.writeFileSync(result.filePath, text, 'utf-8');

    return {
        success: true,
        filePath: result.filePath
    };
});

ipcMain.handle('new-note', async (event, hasUnsavedChanges) => {
    if (!hasUnsavedChanges) {
        return {
            proceed: true
        };
    }

    const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Discard Changes'],
        defaultId: 0,
        cancelId: 0,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes.',
        detail: 'Do you want to discard them and start a new note?'
    });

    return {
        proceed: result.response === 1
    };
});

ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Text Files', extensions: ['txt'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return {
            success: false
        };
    }

    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, 'utf-8');

    return {
        success: true,
        text: text,
        filePath: filePath,
        fileName: path.basename(filePath, '.txt')
    };
});

ipcMain.handle('smart-save', async (event, text, filePath) => {
    const targetPath = filePath || getQuickNotePath();

    fs.writeFileSync(targetPath, text, 'utf-8');

    return {
        success: true,
        filePath: targetPath
    };
});

ipcMain.handle('get-notes', async () => {
    const notes = readNotes();

    return {
        success: true,
        notes: notes
    };
});

ipcMain.handle('save-json-note', async (event, note) => {
    const notes = readNotes();

    const now = new Date().toISOString();

    const noteToSave = {
        id: note.id || Date.now().toString(),
        title: note.title || 'Untitled Note',
        content: note.content || '',
        createdAt: note.createdAt || now,
        updatedAt: now
    };

    const existingIndex = notes.findIndex((item) => item.id === noteToSave.id);

    if (existingIndex >= 0) {
        notes[existingIndex] = noteToSave;
    } else {
        notes.unshift(noteToSave);
    }

    writeNotes(notes);

    return {
        success: true,
        note: noteToSave,
        notes: notes
    };
});

ipcMain.handle('delete-json-note', async (event, noteId) => {
    const notes = readNotes();
    const updatedNotes = notes.filter((note) => note.id !== noteId);

    writeNotes(updatedNotes);

    return {
        success: true,
        notes: updatedNotes
    };
});

ipcMain.handle('delete-all-notes', async () => {
    writeNotes([]);

    const quickNotePath = getQuickNotePath();

    if (fs.existsSync(quickNotePath)) {
        fs.unlinkSync(quickNotePath);
    }

    return {
        success: true
    };
});