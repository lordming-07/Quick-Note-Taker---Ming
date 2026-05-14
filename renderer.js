window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const titleInput = document.getElementById('note-title');
    const saveBtn = document.getElementById('save');
    const saveAsBtn = document.getElementById('save-as');
    const newNoteBtn = document.getElementById('new-note');
    const openFileBtn = document.getElementById('open-file');
    const deleteAllBtn = document.getElementById('delete-all');
    const statusEl = document.getElementById('save_status');
    const filePathEl = document.getElementById('file_path');
    const notesList = document.getElementById('notes-list');

    let notes = [];
    let currentNoteId = null;
    let currentFilePath = null;
    let autoSaveTimer = null;

    let lastSavedTitle = '';
    let lastSavedText = '';

    function getCurrentTitle() {
        const title = titleInput.value.trim();
        return title || 'Untitled Note';
    }

    function getCurrentText() {
        return textarea.value;
    }

    function hasUnsavedChanges() {
        return (
            getCurrentTitle() !== lastSavedTitle ||
            getCurrentText() !== lastSavedText
        );
    }

    function updateSavedSnapshot() {
        lastSavedTitle = getCurrentTitle();
        lastSavedText = getCurrentText();
    }

    function setStatus(message) {
        statusEl.textContent = message;
    }

    function formatDate(dateString) {
        if (!dateString) {
            return '';
        }

        const date = new Date(dateString);
        return date.toLocaleString();
    }

    function renderSidebar() {
        notesList.innerHTML = '';

        if (notes.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No notes yet.';
            emptyMessage.style.color = '#cfd8dc';
            notesList.appendChild(emptyMessage);
            return;
        }

        notes.forEach((note) => {
            const item = document.createElement('div');
            item.className = 'note-item';

            if (note.id === currentNoteId) {
                item.classList.add('active');
            }

            const title = document.createElement('div');
            title.className = 'note-title';
            title.textContent = note.title || 'Untitled Note';

            const date = document.createElement('div');
            date.className = 'note-date';
            date.textContent = formatDate(note.updatedAt);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-note';
            deleteBtn.textContent = 'Delete';

            deleteBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await deleteNote(note.id);
            });

            item.addEventListener('click', async () => {
                await openJsonNote(note.id);
            });

            item.appendChild(title);
            item.appendChild(date);
            item.appendChild(deleteBtn);

            notesList.appendChild(item);
        });
    }

    function clearEditor() {
        currentNoteId = null;
        currentFilePath = null;
        titleInput.value = '';
        textarea.value = '';
        filePathEl.textContent = '';
        updateSavedSnapshot();
        renderSidebar();
    }

    async function loadNotes() {
        const result = await window.electronAPI.getNotes();

        if (result.success) {
            notes = result.notes || [];
            renderSidebar();

            if (notes.length > 0) {
                await openJsonNote(notes[0].id, false);
            } else {
                clearEditor();
            }
        }
    }

    async function openJsonNote(noteId, checkChanges = true) {
        if (checkChanges && hasUnsavedChanges()) {
            const confirmResult = await window.electronAPI.newNote(true);

            if (!confirmResult.proceed) {
                setStatus('Open note cancelled.');
                return;
            }
        }

        const note = notes.find((item) => item.id === noteId);

        if (!note) {
            return;
        }

        currentNoteId = note.id;
        currentFilePath = null;

        titleInput.value = note.title || 'Untitled Note';
        textarea.value = note.content || '';
        filePathEl.textContent = 'Saved in notes.json';

        updateSavedSnapshot();
        renderSidebar();

        setStatus('Note opened.');
    }

    async function saveCurrentNote() {
        const note = {
            id: currentNoteId,
            title: getCurrentTitle(),
            content: getCurrentText()
        };

        const result = await window.electronAPI.saveJsonNote(note);

        if (result.success) {
            currentNoteId = result.note.id;
            notes = result.notes;

            updateSavedSnapshot();
            renderSidebar();

            const time = new Date().toLocaleTimeString();
            setStatus(`Saved at ${time}`);

            // Also smart-save to opened txt file if this note came from Open File
            if (currentFilePath) {
                await window.electronAPI.smartSave(textarea.value, currentFilePath);
                filePathEl.textContent = `Also saved to: ${currentFilePath}`;
            } else {
                filePathEl.textContent = 'Saved in notes.json';
            }
        }
    }


    async function newNote() {
        const confirmResult = await window.electronAPI.newNote(hasUnsavedChanges());

        if (!confirmResult.proceed) {
            setStatus('New note cancelled.');
            return;
        }

        clearEditor();
        setStatus('New note created.');
    }


    async function deleteNote(noteId) {
        const confirmResult = await window.electronAPI.newNote(true);

        if (!confirmResult.proceed) {
            setStatus('Delete cancelled.');
            return;
        }

        const result = await window.electronAPI.deleteJsonNote(noteId);

        if (result.success) {
            notes = result.notes;

            if (currentNoteId === noteId) {
                if (notes.length > 0) {
                    await openJsonNote(notes[0].id, false);
                } else {
                    clearEditor();
                }
            }

            renderSidebar();
            setStatus('Note deleted.');
        }
    }


    async function saveAsFile() {
        const result = await window.electronAPI.saveAs(textarea.value);

        if (result.success) {
            currentFilePath = result.filePath;
            filePathEl.textContent = `Saved as: ${result.filePath}`;
            updateSavedSnapshot();
            setStatus('Save As completed.');
        } else {
            setStatus('Save As cancelled.');
        }
    }


    async function openFile() {
        if (hasUnsavedChanges()) {
            const confirmResult = await window.electronAPI.newNote(true);

            if (!confirmResult.proceed) {
                setStatus('Open file cancelled.');
                return;
            }
        }

        const result = await window.electronAPI.openFile();

        if (result.success) {
            currentNoteId = null;
            currentFilePath = result.filePath;

            titleInput.value = result.fileName || 'Opened File';
            textarea.value = result.text || '';

            filePathEl.textContent = `Opened file: ${result.filePath}`;

            updateSavedSnapshot();
            renderSidebar();

            setStatus('File opened. Click Save to add it to notes.');
        } else {
            setStatus('Open file cancelled.');
        }
    }


    async function deleteAllNotes() {
        const confirmResult = await window.electronAPI.newNote(true);

        if (!confirmResult.proceed) {
            setStatus('Delete all cancelled.');
            return;
        }

        const result = await window.electronAPI.deleteAllNotes();

        if (result.success) {
            notes = [];
            clearEditor();
            setStatus('All notes deleted.');
        }
    }

    function scheduleAutoSave() {
        setStatus('Changes detected - auto-save soon...');

        clearTimeout(autoSaveTimer);

        autoSaveTimer = setTimeout(async () => {
            if (hasUnsavedChanges()) {
                await saveCurrentNote();

                const time = new Date().toLocaleTimeString();
                setStatus(`Auto-saved at ${time}`);
            } else {
                setStatus('No changes - already saved.');
            }
        }, 5000);
    }

    saveBtn.addEventListener('click', async () => {
        await saveCurrentNote();
    });

    saveAsBtn.addEventListener('click', async () => {
        await saveAsFile();
    });

    newNoteBtn.addEventListener('click', async () => {
        await newNote();
    });

    openFileBtn.addEventListener('click', async () => {
        await openFile();
    });

    deleteAllBtn.addEventListener('click', async () => {
        await deleteAllNotes();
    });

    textarea.addEventListener('input', () => {
        scheduleAutoSave();
    });

    titleInput.addEventListener('input', () => {
        scheduleAutoSave();
    });

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

    await loadNotes();
});