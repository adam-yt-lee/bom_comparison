// ========================================
// File Handling
// ========================================
function handleFile(input, type) {
    const file = input.files[0];
    if (!file) return;

    // Validate extension only
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
        showStatus('Please select an .xlsx or .xls file', 'error');
        return;
    }

    const box = document.getElementById(type === 'current' ? 'currentBox' : 'priorBox');
    const nameEl = document.getElementById(type === 'current' ? 'currentFileName' : 'priorFileName');

    // Store File object only — defer reading until Compare
    if (type === 'current') {
        currentFile = file;
        currentData = null;
    } else {
        priorFile = file;
        priorData = null;
    }

    box.classList.add('loaded');
    nameEl.textContent = file.name;
    checkReady();
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheetName = workbook.SheetNames.find(n => n === 'BOM Data') || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
        reader.readAsArrayBuffer(file);
    });
}

// Drag & drop
document.querySelectorAll('.upload-box').forEach(box => {
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('dragover'); });
    box.addEventListener('dragleave', () => box.classList.remove('dragover'));
    box.addEventListener('drop', e => {
        e.preventDefault();
        box.classList.remove('dragover');
        const input = box.querySelector('input[type="file"]');
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
    });
});

function checkReady() {
    document.getElementById('compareBtn').disabled = !(currentFile && priorFile);
}
