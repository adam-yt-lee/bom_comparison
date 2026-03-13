// ========================================
// Rendering
// ========================================
function renderStats() {
    const filtered = getFilteredComparison();
    const totalAmtDiff = filtered.reduce((s, r) => s + r.AmtDiff, 0);
    const newItems = filtered.filter(r => r._isNew).length;
    const removedItems = filtered.filter(r => r._isRemoved).length;
    const products = [...new Set(filtered.map(r => r.Product))].length;

    const fmtAmt = totalAmtDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const amtClass = totalAmtDiff >= 0 ? 'num-positive' : 'num-negative';

    document.getElementById('statsRow').innerHTML = `
        <div class="stat-card">
            <div class="stat-label">${t('totalChanges')}</div>
            <div class="stat-value">${filtered.length}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">${t('totalAmtDiff')}</div>
            <div class="stat-value ${amtClass}">${fmtAmt}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">${t('newItems')}</div>
            <div class="stat-value">${newItems}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">${t('removedItems')}</div>
            <div class="stat-value">${removedItems}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">${t('products')}</div>
            <div class="stat-value">${products}</div>
        </div>
    `;
}

function fmtNum(v, decimals = 2) {
    if (v == null || isNaN(v)) return '';
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function numClass(v) {
    if (v > 0) return 'num-cell num-positive';
    if (v < 0) return 'num-cell num-negative';
    return 'num-cell';
}

// ========================================
// Filter State & Tags
// ========================================
function setFilter(key, value) {
    detailFilter[key] = value;
    renderDetailFromFilter();
}

function removeFilter(key) {
    detailFilter[key] = null;
    if (!detailFilter.product && !detailFilter.mtlGroup) {
        resetDetailToEmpty();
    } else {
        renderDetailFromFilter();
    }
}

function clearAllFilters() {
    detailFilter = { product: null, mtlGroup: null };
    resetDetailToEmpty();
}

function resetDetailToEmpty() {
    document.getElementById('detailContent').innerHTML =
        `<div class="detail-empty-hint" data-i18n="detailHint">${t('detailHint')}</div>`;
    renderFilterTags();
}

function renderFilterTags() {
    const bar = document.getElementById('detailFilterBar');
    const hasFilter = detailFilter.product || detailFilter.mtlGroup;
    if (!hasFilter) { bar.innerHTML = ''; return; }

    let html = `<button class="btn btn-option" style="font-size:11px; padding:2px 8px;" onclick="clearAllFilters()">✕</button>`;
    if (detailFilter.product) {
        html += `<span class="filter-tag">Product: ${detailFilter.product}<button class="tag-close" onclick="removeFilter('product')">✕</button></span>`;
    }
    if (detailFilter.mtlGroup) {
        html += `<span class="filter-tag">MtlGroup: ${detailFilter.mtlGroup}<button class="tag-close" onclick="removeFilter('mtlGroup')">✕</button></span>`;
    }
    bar.innerHTML = html;
}

function renderDetailFromFilter() {
    const fp = detailFilter.product;
    const fm = detailFilter.mtlGroup;
    const hasFilter = fp || fm;

    const isMtlGroupOnly = fm && !fp;
    const showProject = selectedProject === 'all';
    const allCols = isMtlGroupOnly
        ? [...(showProject ? ['Project'] : []), 'Products', 'Material', 'Desc/Spec',
           'Prior_Unit Cost', 'Curr_Unit Cost', 'DiffPrice%', 'Prior_Ttl. Usage', 'Curr_Ttl. Usage', 'AmtDiff']
        : [...(showProject ? ['Project'] : []), 'Product', 'MtlGroup', 'Material', 'Desc/Spec',
           'Prior_Unit Cost', 'Curr_Unit Cost', 'DiffPrice%', 'Prior_Ttl. Usage', 'Curr_Ttl. Usage', 'AmtDiff'];
    // Hide columns that are active filters
    const hideCols = new Set();
    if (fp) hideCols.add('Product');
    if (fm) hideCols.add('MtlGroup');
    const cols = allCols.filter(c => !hideCols.has(c));
    const numCols = new Set(['Prior_Unit Cost', 'Curr_Unit Cost', 'DiffPrice%', 'Prior_Ttl. Usage', 'Curr_Ttl. Usage', 'AmtDiff']);
    const mergeCols = cols.filter(c => ['Project', 'Product', 'MtlGroup'].includes(c));

    // Filter rows (threshold already applied in getFilteredComparison)
    let rows = getFilteredComparison().filter(r => {
        if (fp && r.Product !== fp) return false;
        if (fm && r.MtlGroup !== fm) return false;
        return true;
    });

    // Compute DiffPrice% for each row (skip if either price is null)
    for (const r of rows) {
        if (r['Prior_Unit Cost'] === null || r['Curr_Unit Cost'] === null) {
            r['DiffPrice%'] = null;
        } else {
            const prior = r['Prior_Unit Cost'] || 0;
            r['DiffPrice%'] = prior === 0 ? (r['Curr_Unit Cost'] ? Infinity : 0)
                : ((r['Curr_Unit Cost'] - prior) / Math.abs(prior)) * 100;
        }
    }

    // Dedup when filtering by MtlGroup only (no product): collapse rows with same Material + same Usage
    // Keep Project as-is, merge Product (textjoin with newline)
    if (fm && !fp) {
        const groups = {};
        const order = [];
        for (const r of rows) {
            const key = r.Material + '|' + r['Prior_Unit Cost'] + '|' + r['Curr_Unit Cost']
                      + '|' + r['Prior_Ttl. Usage'] + '|' + r['Curr_Ttl. Usage'];
            if (!groups[key]) {
                groups[key] = { ...r, _products: new Set() };
                order.push(key);
            }
            if (r.Product) groups[key]._products.add(r.Product);
        }
        rows = order.map(k => {
            const g = groups[k];
            g._affectedProducts = [...g._products].join('\n');
            return g;
        });
    }

    // Pre-compute rowspans for merge columns
    const spans = {};
    for (const mc of mergeCols) {
        spans[mc] = new Array(rows.length).fill(1);
        const skip = new Set();
        for (let i = 0; i < rows.length; i++) {
            if (skip.has(i)) { spans[mc][i] = 0; continue; }
            let count = 1;
            while (i + count < rows.length && rows[i + count][mc] === rows[i][mc]) {
                skip.add(i + count);
                count++;
            }
            spans[mc][i] = count;
        }
    }

    // Classify rows into 3 categories
    const qtyRows = [];   // price same, qty different
    const priceRows = []; // qty same, price different
    const bothRows = [];  // both different
    for (const r of rows) {
        const priorPrice = r['Prior_Unit Cost'];
        const currPrice = r['Curr_Unit Cost'];
        // If either price is null, treat prices as "same" (item only exists on one side)
        const priceSame = (priorPrice === null || currPrice === null)
            ? true
            : (priorPrice || 0) === (currPrice || 0);
        const qtySame = (r['Prior_Ttl. Usage'] || 0) === (r['Curr_Ttl. Usage'] || 0);
        if (priceSame && !qtySame) qtyRows.push(r);
        else if (!priceSame && qtySame) priceRows.push(r);
        else bothRows.push(r);
    }

    // When showing all projects, sort each section by Project first so merge columns group properly
    if (showProject) {
        const byProject = (a, b) => {
            const p = String(a.Project ?? '').localeCompare(String(b.Project ?? ''));
            if (p !== 0) return p;
            const mg = String(a.MtlGroup ?? '').localeCompare(String(b.MtlGroup ?? ''));
            if (mg !== 0) return mg;
            return String(a.Material ?? '').localeCompare(String(b.Material ?? ''));
        };
        qtyRows.sort(byProject);
        priceRows.sort(byProject);
        bothRows.sort(byProject);
    }

    // Helper: compute extra diff columns per category
    for (const r of qtyRows) {
        r._QtyDiff = (r['Curr_Ttl. Usage'] || 0) - (r['Prior_Ttl. Usage'] || 0);
    }
    for (const r of priceRows) {
        r._PriceDiff = (r['Curr_Unit Cost'] ?? 0) - (r['Prior_Unit Cost'] ?? 0);
    }
    for (const r of bothRows) {
        r._QtyDiff = (r['Curr_Ttl. Usage'] || 0) - (r['Prior_Ttl. Usage'] || 0);
        r._PriceDiff = (r['Curr_Unit Cost'] ?? 0) - (r['Prior_Unit Cost'] ?? 0);
    }

    // Build sub-table HTML
    let _pivotId = 0;
    function buildSubTable(secRows, secCols, secNumCols, secMergeCols, extraCols) {
        // Pre-compute rowspans for merge columns
        const sp = {};
        for (const mc of secMergeCols) {
            sp[mc] = new Array(secRows.length).fill(1);
            const sk = new Set();
            for (let i = 0; i < secRows.length; i++) {
                if (sk.has(i)) { sp[mc][i] = 0; continue; }
                let count = 1;
                while (i + count < secRows.length && secRows[i + count][mc] === secRows[i][mc]) {
                    sk.add(i + count);
                    count++;
                }
                sp[mc][i] = count;
            }
        }

        // Determine which merge column to use for pivot grouping (use the last one with rowspan > 1)
        // Priority: use the deepest available merge column
        const pivotCol = secMergeCols.length > 0 ? secMergeCols[secMergeCols.length - 1] : null;

        // Compute sticky left offsets for merge columns + Desc/Spec
        const stickyWidths = { 'Project': 90, 'Product': 110, 'Products': 140, 'MtlGroup': 100, 'Material': 110, 'Desc/Spec': 160 };
        const stickyCols = secCols.filter(c => secMergeCols.includes(c) || c === 'Material' || c === 'Desc/Spec');
        const stickyOffsets = {};
        let stickyLeft = 0;
        for (const c of stickyCols) {
            stickyOffsets[c] = stickyLeft;
            stickyLeft += (stickyWidths[c] || 100);
        }

        // Identify detail columns to hide on pivot collapse (non-merge, non-AmtDiff)
        const detailHideCols = secCols.filter(c => !secMergeCols.includes(c) && c !== 'AmtDiff');

        // Pre-compute AmtDiff sums for pivot groups
        const pivotAmtSums = {};
        if (pivotCol) {
            for (let i = 0; i < secRows.length; i++) {
                if (sp[pivotCol][i] > 1) {
                    let sum = 0;
                    for (let j = i; j < i + sp[pivotCol][i]; j++) {
                        sum += (secRows[j].AmtDiff ?? 0);
                    }
                    pivotAmtSums[i] = sum;
                }
            }
        }

        let h = '<div class="table-wrapper"><table class="data-table"><thead><tr>';
        for (const c of secCols) {
            if (c in stickyOffsets) {
                h += `<th class="sticky-col" style="left:${stickyOffsets[c]}px;">${c}</th>`;
            } else {
                h += `<th>${c}</th>`;
            }
        }
        h += '</tr></thead><tbody>';

        for (let i = 0; i < secRows.length; i++) {
            const row = secRows[i];
            // Assign pivot group data attribute for collapsible rows
            const isGroupStart = pivotCol && sp[pivotCol][i] > 1;
            const isGroupChild = pivotCol && sp[pivotCol][i] === 0;
            const gid = isGroupStart ? `pvt${++_pivotId}` : null;
            // Track current group id for child rows
            if (isGroupStart) buildSubTable._currentGid = gid;
            const rowGid = isGroupChild ? buildSubTable._currentGid : gid;
            h += `<tr${isGroupChild ? ` data-pivot-group="${rowGid}" class="pivot-child"` : ''}>`;
            let pvtSummaryDone = false;
            for (const c of secCols) {
                const isSticky = c in stickyOffsets;
                const stickyStyle = isSticky ? `left:${stickyOffsets[c]}px;` : '';
                const stickyClass = isSticky ? ' sticky-col' : '';
                if (secMergeCols.includes(c)) {
                    if (sp[c][i] === 0) continue;
                    const spanCount = sp[c][i];
                    const rs = spanCount > 1 ? ` rowspan="${spanCount}"` : '';
                    const val = String(row[c] ?? '').replace(/\n/g, '<br>');
                    if (c === pivotCol && spanCount > 1) {
                        h += `<td${rs} class="pivot-toggle${stickyClass}" style="${stickyStyle}white-space:pre-line;vertical-align:top;cursor:pointer;" data-pivot-id="${gid}" data-pivot-span="${spanCount}" onclick="togglePivot(this)"><span class="pivot-arrow">&#9660;</span> ${val}</td>`;
                    } else {
                        h += `<td${rs} class="${stickyClass.trim()}" style="${stickyStyle}white-space:pre-line;vertical-align:top;">${val}</td>`;
                    }
                    continue;
                }

                // Insert hidden summary cell before first detail column (once per group-start row)
                if (isGroupStart && !pvtSummaryDone) {
                    h += `<td class="pvt-summary" data-pvt="${gid}" colspan="${detailHideCols.length}" style="display:none;text-align:center;color:var(--text-secondary);font-style:italic;"></td>`;
                    pvtSummaryDone = true;
                }

                let cell = '';
                if (c === 'Products') {
                    const val = String(row._affectedProducts ?? '').replace(/\n/g, '<br>');
                    cell = `<td class="${stickyClass.trim()}" style="${stickyStyle}white-space:pre-line;font-size:11px;color:var(--text-secondary);">${val}</td>`;
                } else if (c === 'DiffPrice%') {
                    const v = row[c];
                    if (v === null || v === undefined) {
                        cell = `<td style="text-align:right;font-style:italic;color:var(--text-secondary);">null</td>`;
                    } else if (!isFinite(v)) {
                        cell = `<td class="num-positive" style="text-align:right;">add</td>`;
                    } else if (v === -100) {
                        cell = `<td class="num-negative" style="text-align:right;">remove</td>`;
                    } else {
                        cell = `<td class="${numClass(v)}" title="${fmtNum(v, 5)}%">${fmtNum(v)}%</td>`;
                    }
                } else if (extraCols[c]) {
                    const v = row[extraCols[c]] ?? 0;
                    cell = `<td class="${numClass(v)}" title="${fmtNum(v, 5)}">${fmtNum(v)}</td>`;
                } else if (secNumCols.has(c)) {
                    const v = row[c];
                    if (v === null && (c === 'Prior_Unit Cost' || c === 'Curr_Unit Cost')) {
                        cell = `<td style="text-align:right;font-style:italic;color:var(--text-secondary);">null</td>`;
                    } else {
                        const nv = v ?? 0;
                        cell = `<td class="${numClass(c === 'AmtDiff' ? nv : 0)}" title="${fmtNum(nv, 5)}">${fmtNum(nv)}</td>`;
                    }
                } else {
                    if (isSticky) {
                        cell = `<td class="sticky-col" style="left:${stickyOffsets[c]}px;">${row[c] ?? ''}</td>`;
                    } else {
                        cell = `<td>${row[c] ?? ''}</td>`;
                    }
                }

                // Add pivot data attributes for group-start rows
                if (isGroupStart && cell) {
                    const pvtCls = c === 'AmtDiff' ? 'pvt-amtdiff' : 'pvt-detail';
                    const pvtData = c === 'AmtDiff'
                        ? ` data-pvt="${gid}" data-pvt-sum="${pivotAmtSums[i]}"`
                        : ` data-pvt="${gid}"`;
                    if (cell.includes('class="')) {
                        cell = cell.replace('class="', `class="${pvtCls} `);
                        cell = cell.replace('<td', `<td${pvtData}`);
                    } else {
                        cell = cell.replace('<td', `<td class="${pvtCls}"${pvtData}`);
                    }
                }

                h += cell;
            }
            h += '</tr>';
        }

        // Total row
        const totalKeys = ['AmtDiff'];
        const tots = {};
        for (const c of totalKeys) tots[c] = secRows.reduce((s, r) => s + (r[c] ?? 0), 0);
        const nonNum = secCols.filter(c => !secNumCols.has(c) && !extraCols[c] && c !== 'Products').length + (secCols.includes('Products') ? 1 : 0);
        h += '</tbody><tfoot><tr>';
        h += `<td class="sticky-col" colspan="${nonNum}" style="left:0;text-align:left;">Total</td>`;
        for (const c of secCols) {
            if (!secNumCols.has(c) && !extraCols[c]) continue;
            if (c === 'AmtDiff') {
                const v = tots[c];
                h += `<td class="${numClass(v)}" title="${fmtNum(v, 5)}">${fmtNum(v)}</td>`;
            } else {
                h += '<td></td>';
            }
        }
        h += '</tr></tfoot></table></div>';
        return h;
    }

    // Define columns per section
    // qtyRows: show Unit Cost, show QtyDiff
    const qtyOnlyCols = [...cols];
    // Insert QtyDiff before AmtDiff
    const qtyIdx = qtyOnlyCols.indexOf('AmtDiff');
    if (qtyIdx >= 0) qtyOnlyCols.splice(qtyIdx, 0, 'QtyDiff');
    const qtyNumCols = new Set([...numCols, 'QtyDiff']);

    // priceRows: show Ttl. Usage, show PriceDiff
    const priceOnlyCols = [...cols];
    const priceIdx = priceOnlyCols.indexOf('AmtDiff');
    if (priceIdx >= 0) priceOnlyCols.splice(priceIdx, 0, 'PriceDiff');
    const priceNumCols = new Set([...numCols, 'PriceDiff']);

    // bothRows: show all + QtyDiff + PriceDiff
    const bothCols = [...cols];
    const bothIdx = bothCols.indexOf('AmtDiff');
    if (bothIdx >= 0) { bothCols.splice(bothIdx, 0, 'QtyDiff'); bothCols.splice(bothIdx + 1, 0, 'PriceDiff'); }
    const bothNumCols = new Set([...numCols, 'QtyDiff', 'PriceDiff']);

    let html = '';

    const sections = [
        { key: 'secQtyDiff',   css: 'sec-qty',   rows: qtyRows,   secCols: qtyOnlyCols,   secNumCols: qtyNumCols,   extra: { 'QtyDiff': '_QtyDiff' } },
        { key: 'secPriceDiff', css: 'sec-price',  rows: priceRows, secCols: priceOnlyCols, secNumCols: priceNumCols, extra: { 'PriceDiff': '_PriceDiff' } },
        { key: 'secBothDiff',  css: 'sec-both',   rows: bothRows,  secCols: bothCols,      secNumCols: bothNumCols,  extra: { 'QtyDiff': '_QtyDiff', 'PriceDiff': '_PriceDiff' } },
    ];

    for (const sec of sections) {
        if (sec.rows.length === 0) continue;
        html += `<div class="detail-section ${sec.css}">`;
        html += `<div class="detail-section-title">${t(sec.key)} <span class="badge">${sec.rows.length}</span></div>`;
        html += buildSubTable(sec.rows, sec.secCols, sec.secNumCols, mergeCols, sec.extra);
        html += '</div>';
    }

    if (html === '') {
        html = `<div style="text-align:center;padding:20px;color:var(--text-secondary);">No detail rows to display.</div>`;
    }

    document.getElementById('detailContent').innerHTML = html;
    renderFilterTags();
    document.getElementById('detailContent').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function drillDown(product, mtlGroup) {
    detailFilter = { product: product, mtlGroup: mtlGroup };
    renderDetailFromFilter();
}

function drillDownProduct(product) {
    detailFilter = { product: product, mtlGroup: null };
    renderDetailFromFilter();
}

function drillDownMtlGroup(mtlGroup) {
    detailFilter = { product: null, mtlGroup: mtlGroup };
    renderDetailFromFilter();
}

function togglePivot(td) {
    const gid = td.getAttribute('data-pivot-id');
    const origSpan = parseInt(td.getAttribute('data-pivot-span'));
    const isCollapsed = td.classList.contains('collapsed');
    const table = td.closest('table');
    const childRows = table.querySelectorAll(`tr[data-pivot-group="${gid}"]`);
    const parentRow = td.closest('tr');
    const detailCells = parentRow.querySelectorAll(`.pvt-detail[data-pvt="${gid}"]`);
    const summaryCell = parentRow.querySelector(`.pvt-summary[data-pvt="${gid}"]`);
    const amtCell = parentRow.querySelector(`.pvt-amtdiff[data-pvt="${gid}"]`);

    if (isCollapsed) {
        // Expand
        td.classList.remove('collapsed');
        td.setAttribute('rowspan', origSpan);
        childRows.forEach(r => r.style.display = '');
        // Restore detail cells
        detailCells.forEach(c => c.style.display = '');
        if (summaryCell) summaryCell.style.display = 'none';
        if (amtCell && amtCell.hasAttribute('data-pvt-orig')) {
            amtCell.innerHTML = amtCell.getAttribute('data-pvt-orig');
            amtCell.className = amtCell.getAttribute('data-pvt-origclass') || '';
        }
    } else {
        // Collapse
        td.classList.add('collapsed');
        td.setAttribute('rowspan', '1');
        childRows.forEach(r => r.style.display = 'none');
        // Hide detail cells, show summary placeholder
        detailCells.forEach(c => c.style.display = 'none');
        if (summaryCell) summaryCell.style.display = '';
        if (amtCell) {
            // Save original content on first collapse
            if (!amtCell.hasAttribute('data-pvt-orig')) {
                amtCell.setAttribute('data-pvt-orig', amtCell.innerHTML);
                amtCell.setAttribute('data-pvt-origclass', amtCell.className);
            }
            const sum = parseFloat(amtCell.getAttribute('data-pvt-sum'));
            amtCell.className = `pvt-amtdiff ${numClass(sum)}`;
            amtCell.innerHTML = `<span title="${fmtNum(sum, 5)}">${fmtNum(sum)}</span>`;
        }
    }
}

function renderSummaryTable() {
    const { data, products } = summaryResult;
    const showProject = selectedProject === 'all';
    const baseCols = showProject ? ['Project', 'MtlGroup'] : ['MtlGroup'];

    // Compute rowspans for Project column
    const projectSpans = new Array(data.length).fill(1);
    if (showProject) {
        const skip = new Set();
        for (let i = 0; i < data.length; i++) {
            if (skip.has(i)) { projectSpans[i] = 0; continue; }
            let count = 1;
            while (i + count < data.length && data[i + count].Project === data[i].Project) {
                skip.add(i + count);
                count++;
            }
            projectSpans[i] = count;
        }
    }

    // Compute sticky left offsets
    const colWidths = showProject ? [100, 120] : [120]; // estimated px widths
    const stickyOffsets = [];
    let offset = 0;
    for (let ci = 0; ci < baseCols.length; ci++) {
        stickyOffsets.push(offset);
        offset += colWidths[ci];
    }

    let html = '<table class="data-table"><thead><tr>';
    for (let ci = 0; ci < baseCols.length; ci++) {
        html += `<th class="sticky-col" style="left:${stickyOffsets[ci]}px;min-width:${colWidths[ci]}px;max-width:${colWidths[ci]}px;">${baseCols[ci]}</th>`;
    }
    for (const p of products) html += `<th style="white-space:pre-line;">${p}</th>`;
    html += '</tr></thead><tbody>';

    let _sumPivotId = 0;
    let _sumCurrentGid = null;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const isChild = showProject && projectSpans[i] === 0;
        const isGroupStart = showProject && projectSpans[i] > 1;
        const gid = isGroupStart ? `spvt${++_sumPivotId}` : null;
        if (isGroupStart) _sumCurrentGid = gid;
        html += `<tr${isChild ? ` data-pivot-group="${_sumCurrentGid}" class="pivot-child"` : ''}>`;
        if (showProject && projectSpans[i] > 0) {
            const spanCount = projectSpans[i];
            const rs = spanCount > 1 ? ` rowspan="${spanCount}"` : '';
            if (spanCount > 1) {
                html += `<td class="sticky-col pivot-toggle" style="left:${stickyOffsets[0]}px;min-width:${colWidths[0]}px;max-width:${colWidths[0]}px;vertical-align:top;cursor:pointer;" data-pivot-id="${gid}" data-pivot-span="${spanCount}" onclick="togglePivot(this)"${rs}><span class="pivot-arrow">&#9660;</span> ${row.Project ?? ''}</td>`;
            } else {
                html += `<td class="sticky-col" style="left:${stickyOffsets[0]}px;min-width:${colWidths[0]}px;max-width:${colWidths[0]}px;vertical-align:top;"${rs}>${row.Project ?? ''}</td>`;
            }
        }
        const escaped_mg = String(row.MtlGroup ?? '').replace(/'/g, "\\'");
        const mgIdx = showProject ? 1 : 0;
        const mgLeft = stickyOffsets[mgIdx];
        html += `<td class="sticky-col summary-clickable" style="left:${mgLeft}px;min-width:${colWidths[mgIdx]}px;max-width:${colWidths[mgIdx]}px;" onclick="drillDownMtlGroup('${escaped_mg}')">${row.MtlGroup ?? ''}</td>`;
        for (const p of products) {
            const v = row[p] ?? 0;
            const escaped_p = String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
            html += `<td class="${numClass(v)} summary-clickable" onclick="drillDown('${escaped_p}','${escaped_mg}')" title="${fmtNum(v, 5)}">${fmtNum(v)}</td>`;
        }
        html += '</tr>';
    }

    // Total row
    html += '</tbody><tfoot><tr>';
    html += `<td class="sticky-col" colspan="${baseCols.length}" style="left:0;text-align:left;">Total</td>`;
    for (const p of products) {
        const total = data.reduce((s, r) => s + (r[p] ?? 0), 0);
        const escaped_p = String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        html += `<td class="${numClass(total)} summary-clickable" onclick="drillDownProduct('${escaped_p}')" title="${fmtNum(total, 5)}">${fmtNum(total)}</td>`;
    }
    html += '</tr></tfoot></table>';
    document.getElementById('tableSum').innerHTML = html;
}
