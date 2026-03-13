// ========================================
// i18n
// ========================================
const i18n = {
    en: {
        title: 'BOM Comparison Tool',
        subtitle: 'Upload Current & Prior BOM files to compare differences',
        currentBom: 'Current BOM',
        priorBom: 'Prior BOM',
        uploadHint: 'Click or drag .xlsx file here',
        compare: 'Compare',
        downloadAll: 'Download (.xlsx)',
        downloadTemplate: 'Template (.xlsx)',
        detailTitle: 'All Changes (Detail)',
        summaryTitle: 'Summary by MtlGroup',
        processing: 'Processing comparison...',
        done: 'Comparison complete!',
        errorSheet: 'Cannot find "BOM Data" sheet in the file.',
        totalChanges: 'Total Changes',
        totalAmtDiff: 'Total AmtDiff',
        newItems: 'New Items',
        removedItems: 'Removed Items',
        products: 'Products',
        detailHint: 'Click a value in the summary table to view details',
        secQtyDiff: 'Quantity Difference',
        secPriceDiff: 'Price Difference',
        secBothDiff: 'Price & Quantity Difference',
        thresholdShow: 'Show only',
    },
    zh: {
        title: 'BOM 比對工具',
        subtitle: '上傳 Current 與 Prior BOM 檔案進行差異比較',
        currentBom: '本期 BOM (Current)',
        priorBom: '前期 BOM (Prior)',
        uploadHint: '點擊或拖曳 .xlsx 檔案至此',
        compare: '開始比對',
        downloadAll: '下載 (.xlsx)',
        downloadTemplate: '範本 (.xlsx)',
        detailTitle: '所有變動明細',
        summaryTitle: 'MtlGroup 彙總',
        processing: '比對處理中...',
        done: '比對完成！',
        errorSheet: '檔案中找不到 "BOM Data" 工作表。',
        totalChanges: '變動項目數',
        totalAmtDiff: '金額差異合計',
        newItems: '新增項目',
        removedItems: '移除項目',
        products: '產品數',
        detailHint: '點擊彙總表的數值以查看明細',
        secQtyDiff: '數量差異',
        secPriceDiff: '價格差異',
        secBothDiff: '價格與數量差異',
        thresholdShow: '僅顯示',
    }
};

function t(key) { return i18n[currentLang][key] || key; }

function toggleLanguageGroup() {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    setLang(newLang);
    updateLangButtons();
}

function updateLangButtons() {
    document.getElementById('langZH').classList.toggle('active', currentLang === 'zh');
    document.getElementById('langEN').classList.toggle('active', currentLang === 'en');
}

function setLang(lang) {
    currentLang = lang;
    document.getElementById('title').textContent = t('title');
    document.getElementById('subtitle').textContent = t('subtitle');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    // Re-render tables if results exist
    if (rawComparisonResult) {
        summaryResult = buildSummary(getFilteredComparison());
        renderStats();
        renderSummaryTable();
    }
}
