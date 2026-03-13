// ========================================
// Init
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    setLang(currentLang);
    updateLangButtons();
});

// ========================================
// Status
// ========================================
function showStatus(msg, type) {
    const bar = document.getElementById('statusBar');
    const text = document.getElementById('statusText');
    const spinner = document.getElementById('statusSpinner');
    bar.className = 'status-bar visible ' + type;
    spinner.style.display = type === 'info' ? 'block' : 'none';
    text.textContent = msg;
}

function hideStatus() {
    document.getElementById('statusBar').className = 'status-bar';
}

// ========================================
// Main Comparison
// ========================================
async function runComparison() {
    showStatus(t('processing'), 'info');
    document.getElementById('compareBtn').disabled = true;
    document.getElementById('resultSection').classList.remove('visible');

    try {
        // Lazy load: read files only when Compare is pressed
        const [currJson, priorJson] = await Promise.all([
            readExcelFile(currentFile),
            readExcelFile(priorFile)
        ]);
        currentData = currJson;
        priorData = priorJson;

        // Update file name display with row counts
        document.getElementById('currentFileName').textContent = currentFile.name + ' (' + currentData.length + ' rows)';
        document.getElementById('priorFileName').textContent = priorFile.name + ' (' + priorData.length + ' rows)';

        // Use setTimeout to allow UI update before heavy processing
        setTimeout(() => {
            try {
                const currentBOM = processBOM(currentData, 'Curr');
                const priorBOM = processBOM(priorData, 'Old');
                rawComparisonResult = fullOuterJoin(currentBOM, priorBOM);
                comparisonResult = mergeIdenticalProducts(rawComparisonResult);
                populateProjectDropdown();
                applyFilters();

                document.getElementById('resultSection').classList.add('visible');
                showStatus(t('done') + ' — ' + rawComparisonResult.length + ' changes found', 'success');
            } catch (err) {
                showStatus('Error: ' + err.message, 'error');
                console.error(err);
            }
            document.getElementById('compareBtn').disabled = false;
        }, 50);
    } catch (err) {
        showStatus('Error: ' + err.message, 'error');
        console.error(err);
        document.getElementById('compareBtn').disabled = false;
    }
}
