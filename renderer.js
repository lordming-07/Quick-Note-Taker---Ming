window.addEventListener('DOMContentLoaded', async () => {

    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('save_status');
    const saveAsBtn = document.getElementById('save-as');
    const newNoteBtn = document.getElementById('new-note');
    const openFileBtn = document.getElementById('open-file');

    let lastSavedText = '';
    let currentFilePath = null;

    // Menu Actions
    window.electronAPI.onMenuAction('menu-new-note', () => {
        newNoteBtn.click();
    });

    window.electronAPI.onMenuAction('menu-open-file', () => {
        openFileBtn.click();
    });

    window.electronAPI.onMenuAction('menu-save', () => {
        saveBtn.click();
    });

    window.electronAPI.onMenuAction('menu-save-as', () => {
        saveAsBtn.click();
    });

    // Load existing note
    const savedNote = await window.electronAPI.loadNote();
    textarea.value = savedNote;
    lastSavedText = savedNote;

    // Save As
    saveAsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.saveAs(textarea.value);

        if (result.success) {
            currentFilePath = result.filePath;
            lastSavedText = textarea.value;
            statusEl.textContent = `Saved to: ${result.filePath}`;
        } else {
            statusEl.textContent = 'Save As cancelled';
        }
    });

    // New Note
    newNoteBtn.addEventListener('click', async () => {
        if (textarea.value !== lastSavedText) {
            const confirmNew = confirm('You have unsaved changes. Continue?');

            if (!confirmNew) {
                return;
            }
        }

        textarea.value = '';
        lastSavedText = '';
        currentFilePath = null;
        statusEl.textContent = 'New note created';
    });

    // Open File
    openFileBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.openFile();

        if (result.success) {
            textarea.value = result.content;
            lastSavedText = result.content;
            currentFilePath = result.filePath;
            statusEl.textContent = 'File opened';
        } else {
            statusEl.textContent = 'Open cancelled';
        }
    });

    // Auto Save
    let timer;

    textarea.addEventListener('input', () => {
        clearTimeout(timer);

        timer = setTimeout(async () => {
            await window.electronAPI.saveNote(textarea.value);

            lastSavedText = textarea.value;
            statusEl.textContent = 'Auto Saved';
        }, 2000);
    });

    // Manual Save
    saveBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.smartSave(textarea.value, currentFilePath);

        if (result.success) {
            currentFilePath = result.filePath;
            lastSavedText = textarea.value;
            statusEl.textContent = 'Saved!';
        }
    });

});