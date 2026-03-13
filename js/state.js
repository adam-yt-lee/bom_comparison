// ========================================
// State
// ========================================
let currentData = null;
let priorData = null;
let currentFile = null;  // File object (lazy load)
let priorFile = null;    // File object (lazy load)
let rawComparisonResult = null;  // unmerged join result
let comparisonResult = null;     // after mergeIdenticalProducts
let summaryResult = null;
let currentLang = 'zh'; //zh en
let detailFilter = { product: null, mtlGroup: null };
let selectedProject = 'all';
let thresholdPct = 3; // %
let thresholdAmt = 0.01; // $
