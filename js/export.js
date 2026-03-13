// ========================================
// Template Download
// ========================================
function downloadTemplate() {
    const templateCols = ['Project', 'Product', 'MtlGroup', 'Material', 'Desc/Spec', 'Unit Cost', 'Ttl. Usage'];
    const ws = XLSX.utils.aoa_to_sheet([templateCols]);
    // Set column widths
    ws['!cols'] = templateCols.map(c => ({ wch: Math.max(c.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM Data');
    XLSX.writeFile(wb, 'BOM_Template.xlsx');
}

// ========================================
// Download Excel
// ========================================
function downloadExcel() {
    if (!rawComparisonResult) return;

    // Always use original unfiltered data (merged)
    const fullMerged = mergeIdenticalProducts(rawComparisonResult);
    const fullSummary = buildSummary(fullMerged);
    const { data, products } = fullSummary;

    // Sheet 1: Summary
    const sumData = data.map(r => {
        const obj = { 'Project': r.Project, 'MtlGroup': r.MtlGroup };
        for (const p of products) obj[p] = r[p] ?? 0;
        return obj;
    });
    const wsSummary = XLSX.utils.json_to_sheet(sumData);

    // Sheet 2: Detail
    const detailData = fullMerged.map(r => {
        let diffPricePct = null;
        if (r['Prior_Unit Cost'] !== null && r['Curr_Unit Cost'] !== null) {
            const prior = r['Prior_Unit Cost'] || 0;
            diffPricePct = prior === 0 ? (r['Curr_Unit Cost'] ? Infinity : 0)
                : ((r['Curr_Unit Cost'] - prior) / Math.abs(prior)) * 100;
            if (!isFinite(diffPricePct)) diffPricePct = null;
        }
        return {
            'Project': r.Project,
            'Product': r.Product,
            'MtlGroup': r.MtlGroup,
            'Material': r.Material,
            'Desc/Spec': r['Desc/Spec'],
            'Prior_Unit Cost': r['Prior_Unit Cost'],
            'Curr_Unit Cost': r['Curr_Unit Cost'],
            'DiffPrice%': diffPricePct,
            'Prior_Ttl. Usage': r['Prior_Ttl. Usage'],
            'Curr_Ttl. Usage': r['Curr_Ttl. Usage'],
            'AmtDiff': r.AmtDiff
        };
    });
    const wsDetail = XLSX.utils.json_to_sheet(detailData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');
    XLSX.writeFile(wb, 'BOM_Comparison.xlsx');
}
