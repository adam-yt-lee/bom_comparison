// ========================================
// BOM Processing (mirrors M code logic)
// ========================================
function processBOM(rawData, prefix) {
    // prefix: 'Curr' or 'Old'
    const qtyField = prefix + '_Qty';
    const priceField = prefix + '_Price';

    // Rename Price(USD) -> Unit Cost if needed
    const rows = rawData.map(row => {
        const r = { ...row };
        if (r['Price(USD)'] !== undefined && r['Unit Cost'] === undefined) {
            r['Unit Cost'] = r['Price(USD)'];
        }
        if (!r['Project']) r['Project'] = 'Project';
        return r;
    });

    // Filter dummy (Unit Cost = 0 or null)
    const filtered = rows.filter(r => {
        const uc = parseFloat(r['Unit Cost']);
        return uc && uc !== 0;
    });

    // Group by Compare_Key
    const groups = {};
    for (const row of filtered) {
        const key = String(row['Project'] || '') + '|' + String(row['Product'] || '') + '|' + String(row['Material'] || '');
        if (!groups[key]) {
            groups[key] = {
                Compare_Key: key,
                Project: row['Project'] || '',
                Product: row['Product'] || '',
                MtlGroup: row['MtlGroup'] || '',
                Material: row['Material'] || '',
                'Desc/Spec': row['Desc/Spec'] || '',
                _qty: [],
                _price: []
            };
        }
        groups[key]._qty.push(parseFloat(row['Ttl. Usage']) || 0);
        groups[key]._price.push(parseFloat(row['Unit Cost']) || 0);
    }

    // Aggregate
    const result = Object.values(groups).map(g => {
        const obj = {
            Compare_Key: g.Compare_Key,
            Project: g.Project,
            Product: g.Product,
            MtlGroup: g.MtlGroup,
            Material: g.Material,
            'Desc/Spec': g['Desc/Spec'],
        };
        obj[qtyField] = g._qty.reduce((a, b) => a + b, 0);
        obj[priceField] = g._price.reduce((a, b) => a + b, 0) / g._price.length;
        return obj;
    });

    return result;
}

function fullOuterJoin(currentBOM, priorBOM) {
    const currentMap = {};
    for (const row of currentBOM) currentMap[row.Compare_Key] = row;

    const priorMap = {};
    for (const row of priorBOM) priorMap[row.Compare_Key] = row;

    const allKeys = new Set([...Object.keys(currentMap), ...Object.keys(priorMap)]);
    const joined = [];

    for (const key of allKeys) {
        const curr = currentMap[key] || null;
        const prior = priorMap[key] || null;

        const currPrice = curr ? (curr.Curr_Price ?? 0) : null;
        const oldPrice = prior ? (prior.Old_Price ?? 0) : null;
        const currQty = curr ? (curr.Curr_Qty ?? 0) : 0;
        const oldQty = prior ? (prior.Old_Qty ?? 0) : 0;

        // Filter: Key mismatch OR price/qty difference
        if (!curr || !prior || currPrice !== oldPrice || currQty !== oldQty) {
            const currMtlGroup = curr ? curr.MtlGroup : null;
            const priorMtlGroup = prior ? prior.MtlGroup : null;
            let finalMtlGroup;
            if (!priorMtlGroup) finalMtlGroup = currMtlGroup;
            else if (!currMtlGroup) finalMtlGroup = priorMtlGroup;
            else if (priorMtlGroup === currMtlGroup) finalMtlGroup = currMtlGroup;
            else finalMtlGroup = String(priorMtlGroup) + '/' + String(currMtlGroup);

            joined.push({
                Project: (curr?.Project) ?? (prior?.Project) ?? '',
                Product: (curr?.Product) ?? (prior?.Product) ?? '',
                MtlGroup: finalMtlGroup || '',
                Material: (curr?.Material) ?? (prior?.Material) ?? '',
                'Desc/Spec': (curr?.['Desc/Spec']) ?? (prior?.['Desc/Spec']) ?? '',
                'Prior_Unit Cost': oldPrice,
                'Curr_Unit Cost': currPrice,
                'Prior_Ttl. Usage': oldQty,
                'Curr_Ttl. Usage': currQty,
                AmtDiff: ((currPrice ?? 0) * currQty) - ((oldPrice ?? 0) * oldQty),
                _isNew: !prior,
                _isRemoved: !curr,
            });
        }
    }

    // Sort by MtlGroup, Material
    joined.sort((a, b) => {
        const mg = String(a.MtlGroup).localeCompare(String(b.MtlGroup));
        if (mg !== 0) return mg;
        return String(a.Material).localeCompare(String(b.Material));
    });

    return joined;
}

function buildSummary(comparison) {
    const groups = {};
    for (const row of comparison) {
        const key = row.Project + '|' + row.Product + '|' + row.MtlGroup;
        if (!groups[key]) {
            groups[key] = {
                Project: row.Project,
                Product: row.Product,
                MtlGroup: row.MtlGroup,
                AmtDiff: 0
            };
        }
        groups[key].AmtDiff += row.AmtDiff;
    }

    // Pivot by Product
    const products = [...new Set(Object.values(groups).map(g => String(g.Product)))].sort();
    const mtlGroups = {};

    for (const g of Object.values(groups)) {
        const mk = g.Project + '|' + g.MtlGroup;
        if (!mtlGroups[mk]) {
            mtlGroups[mk] = { Project: g.Project, MtlGroup: g.MtlGroup };
        }
        mtlGroups[mk][g.Product] = (mtlGroups[mk][g.Product] || 0) + g.AmtDiff;
    }

    const result = Object.values(mtlGroups).sort((a, b) =>
        String(a.MtlGroup).localeCompare(String(b.MtlGroup))
    );

    return { data: result, products };
}

// Merge products only when ALL their rows (summary & details) are completely identical
function mergeIdenticalProducts(rows) {
    // Group rows by Project + Product
    const productRows = {};
    for (const r of rows) {
        const key = r.Project + '||' + String(r.Product);
        if (!productRows[key]) productRows[key] = { project: r.Project, product: String(r.Product), rows: [] };
        productRows[key].rows.push(r);
    }

    // Create fingerprint for each product: sorted list of all detail rows (everything except Product)
    for (const entry of Object.values(productRows)) {
        entry.fingerprint = entry.rows.map(r =>
            [r.MtlGroup, r.Material, r['Desc/Spec'],
             r['Prior_Unit Cost'], r['Curr_Unit Cost'],
             r['Prior_Ttl. Usage'], r['Curr_Ttl. Usage']].join('|')
        ).sort().join('\n');
    }

    // Group products with identical fingerprints within same project
    const fpGroups = {};
    for (const entry of Object.values(productRows)) {
        const fpKey = entry.project + '|||' + entry.fingerprint;
        if (!fpGroups[fpKey]) fpGroups[fpKey] = [];
        fpGroups[fpKey].push(entry);
    }

    // Build result: for each fingerprint group, take rows from first product with merged Product name
    const result = [];
    for (const group of Object.values(fpGroups)) {
        const mergedName = group.map(e => e.product).sort().join('\n');
        for (const r of group[0].rows) {
            result.push({ ...r, Product: mergedName });
        }
    }

    // Re-sort by MtlGroup, Material
    result.sort((a, b) => {
        const mg = String(a.MtlGroup).localeCompare(String(b.MtlGroup));
        if (mg !== 0) return mg;
        return String(a.Material).localeCompare(String(b.Material));
    });

    return result;
}
