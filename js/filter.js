// ========================================
// Project Filter
// ========================================
function getFilteredComparison() {
    let rows = rawComparisonResult;
    if (selectedProject !== 'all') {
        rows = rows.filter(r => r.Project === selectedProject);
    }
    // Threshold filter on detail rows: hide where BOTH |DiffPrice%| <= pct AND |AmtDiff| <= amt
    if (thresholdPct > 0 || thresholdAmt > 0) {
        rows = rows.filter(r => {
            const absAmt = Math.abs(r.AmtDiff);
            // If either price is null, skip price% threshold (always keep the row based on amt only)
            if (r['Prior_Unit Cost'] === null || r['Curr_Unit Cost'] === null) {
                return !(absAmt <= thresholdAmt);
            }
            const priorCost = r['Prior_Unit Cost'] || 0;
            const absPct = priorCost === 0 ? Infinity : Math.abs((r['Curr_Unit Cost'] - priorCost) / priorCost) * 100;
            return !(absPct <= thresholdPct && absAmt <= thresholdAmt);
        });
    }
    // Re-merge products after filtering (threshold may make previously-different products identical)
    return mergeIdenticalProducts(rows);
}

function applyFilters() {
    const filtered = getFilteredComparison();
    summaryResult = buildSummary(filtered);
    renderStats();
    renderSummaryTable();
    detailFilter = { product: null, mtlGroup: null };
    resetDetailToEmpty();
}

function onProjectChange(val) {
    selectedProject = val;
    applyFilters();
}

function onThresholdChange() {
    thresholdPct = parseFloat(document.getElementById('thresholdPct').value) || 0;
    thresholdAmt = parseFloat(document.getElementById('thresholdAmt').value) || 0;
    applyFilters();
}

function populateProjectDropdown() {
    const projects = [...new Set(rawComparisonResult.map(r => r.Project))].sort();
    const sel = document.getElementById('projectSelect');
    sel.innerHTML = '';
    if (projects.length === 1) {
        sel.innerHTML = `<option value="${projects[0]}">${projects[0]}</option>`;
        selectedProject = projects[0];
    } else {
        sel.innerHTML = '<option value="all">All</option>' +
            projects.map(p => `<option value="${p}">${p}</option>`).join('');
        selectedProject = 'all';
    }
    document.getElementById('summaryToolbar').style.display = 'flex';
}
