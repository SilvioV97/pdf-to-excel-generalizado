import * as pdfjsLib from 'pdfjs-dist';

// Load the worker from the local node_modules instead of depending on unpkg
// Using new URL + import.meta.url is the standard Vite way to securely bundle workers
const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractPdfData(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pagesData = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        const items = textContent.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            y: viewport.height - item.transform[5],
            width: item.width,
            height: item.height
        }));
        pagesData.push({ pageNumber: i, items });
    }
    return pagesData;
}

function groupIntoRows(items, tolerance = 6) {
    const sorted = [...items].filter(i => i.text.trim() !== '').sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = [];
    let currentRow = [];
    let lastY = null;
    for (const item of sorted) {
        if (lastY === null || Math.abs(item.y - lastY) <= tolerance) {
            currentRow.push(item);
        } else {
            rows.push({ y: lastY, items: currentRow.sort((a, b) => a.x - b.x) });
            currentRow = [item];
        }
        lastY = item.y;
    }
    if (currentRow.length > 0) rows.push({ y: lastY, items: currentRow.sort((a, b) => a.x - b.x) });
    return rows;
}

const DATE_REGEX = /^\d{2}[\/\-]\d{2}([\/\-]\d{2,4})?$/;

function isHeaderRowStrict(rowItems, bankConfig) {
    const texts = rowItems.map(i => i.text.toLowerCase());
    const matches = bankConfig.headerDetectionRegexes.filter(sig =>
        texts.some(t => t.includes(sig))
    ).length;
    return matches >= bankConfig.minHeadersRequired && rowItems.length >= 5;
}

function processPageRows(rows, getSlot, finalHeaders, bankConfig) {
    const dataRows = [];
    let insideTable = false;
    const descIdx = finalHeaders.indexOf('DESCRIPCION');
    const saldoIdx = finalHeaders.indexOf('SALDO CONTABLE');

    for (const row of rows) {
        const rowItems = row.items;

        // SPLIT items that contain 2+ spaces (merged columns)
        const splittedItems = [];
        rowItems.forEach(item => {
            if (item.text.includes('  ')) {
                const parts = item.text.split(/  +/);
                let offX = 0;
                parts.forEach(p => {
                    splittedItems.push({ text: p, x: item.x + offX, width: 0 });
                    offX += p.length * 6; // heuristic increment
                });
            } else {
                splittedItems.push(item);
            }
        });

        const texts = splittedItems.map(i => i.text.toLowerCase());

        // Dynamic Footer checking
        const rawText = rowItems.map(i => i.text).join(' ').toLowerCase();

        // Check for bank-specific hard stops to prevent garbage extraction
        if (bankConfig.footerKeywords.some(kw => rawText.includes(kw))) {
            break;
        }

        if (isHeaderRowStrict(rowItems, bankConfig)) { insideTable = true; continue; }
        if (!insideTable) continue;

        if (texts.some(t => t.includes('página') || t.includes('estado de cuenta'))) continue;
        if (texts.length < 2 && !texts.some(t => t.includes('saldo'))) continue;

        if (texts.some(t => t.includes('saldo anterior') || t.includes('saldo ant'))) {
            const mappedRow = new Array(finalHeaders.length).fill('');
            for (const item of splittedItems) {
                const t = item.text.trim();
                if (/^-?[\d,\.]+$/.test(t) && t.includes('.') && saldoIdx >= 0) mappedRow[saldoIdx] = t;
                else if (descIdx >= 0) mappedRow[descIdx] = (mappedRow[descIdx] + ' ' + t).trim();
            }
            dataRows.push(mappedRow);
            continue;
        }

        const mappedRow = new Array(finalHeaders.length).fill('');
        let datesFoundInRow = 0;
        for (const item of splittedItems) {
            const slot = getSlot(item, datesFoundInRow);
            if (DATE_REGEX.test(item.text.trim())) datesFoundInRow++;

            mappedRow[slot] = (mappedRow[slot] + ' ' + item.text).trim();
        }
        if (mappedRow.some(c => c !== '')) {
            const fechaOperIdx = finalHeaders.indexOf('FECHA OPER.');
            const fechaValorIdx = finalHeaders.indexOf('FECHA VALOR');

            let hasDate = false;
            if (fechaOperIdx >= 0 && DATE_REGEX.test(mappedRow[fechaOperIdx])) hasDate = true;
            if (fechaValorIdx >= 0 && DATE_REGEX.test(mappedRow[fechaValorIdx])) hasDate = true;

            // Heuristic: If there is no date, this is a continuation of the previous operation's description.
            // We concatenate all text found in this row and merge it into the previous row's DESCRIPCION.
            if (!hasDate && dataRows.length > 0) {
                const prevRow = dataRows[dataRows.length - 1];
                const continuationText = mappedRow.filter(c => c !== '').join(' ').trim();
                if (descIdx >= 0 && continuationText) {
                    prevRow[descIdx] = prevRow[descIdx] ? `${prevRow[descIdx]} ${continuationText}` : continuationText;
                }
            } else {
                dataRows.push(mappedRow);
            }
        }
    }
    return dataRows;
}

export function detectTables(pagesData, bankConfig) {
    if (!bankConfig) throw new Error("A valid bankConfig must be provided to detectTables");
    const { schema, normalizeHeader } = bankConfig;

    const xMap = {};
    for (const page of pagesData) {
        const rows = groupIntoRows(page.items);
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
            if (!isHeaderRowStrict(rows[i].items, bankConfig)) continue;
            const r1 = rows[i].items;
            const r2 = rows[i + 1]?.items || [];
            r1.forEach(item => {
                const center = item.x + item.width / 2;
                const cont = r2.find(ni => Math.abs((ni.x + ni.width / 2) - center) < 35);
                let label = normalizeHeader(cont ? `${item.text} ${cont.text}` : item.text);
                if (!schema.includes(label)) label = normalizeHeader(item.text);

                if (schema.includes(label)) {
                    if (!xMap[label]) xMap[label] = [];
                    xMap[label].push(item.x);
                }
            });
            r2.forEach(item => {
                const label = normalizeHeader(item.text);
                if (schema.includes(label) && !xMap[label]?.some(x => Math.abs(x - item.x) < 20)) {
                    if (!xMap[label]) xMap[label] = [];
                    xMap[label].push(item.x);
                }
            });
        }
    }

    const anchorMap = {};
    const finalHeaders = [];
    schema.forEach(h => {
        if (xMap[h]) {
            // Use median for robustness against outliers
            const sortedXs = xMap[h].sort((a, b) => a - b);
            anchorMap[h] = sortedXs[Math.floor(sortedXs.length / 2)];
            finalHeaders.push(h);
        }
    });

    finalHeaders.sort((a, b) => anchorMap[a] - anchorMap[b]);

    if (finalHeaders.length < 5) return [];

    const boundaries = [];
    for (let i = 0; i < finalHeaders.length - 1; i++) {
        const mid = (anchorMap[finalHeaders[i]] + anchorMap[finalHeaders[i + 1]]) / 2;
        const isDateCol = finalHeaders[i].includes('FECHA');
        if (isDateCol) {
            // Use the smaller of a fixed 48px window or the midpoint to prevented overshooting
            boundaries.push(Math.min(anchorMap[finalHeaders[i]] + 48, mid));
        } else {
            boundaries.push(mid);
        }
    }

    const getSlot = (item, datesFoundInRow) => {
        const text = item.text.trim();
        const isDateLike = DATE_REGEX.test(text);

        // Pattern-based override for dates:
        // The first date found in a row should ideally go to slot 0, the second to slot 1.
        if (isDateLike) {
            console.log(`Date Found! datesFoundInRow=${datesFoundInRow}, fh[0]=${finalHeaders[0]}, fh[1]=${finalHeaders[1]}`);
            if (datesFoundInRow === 0 && finalHeaders[0].includes('FECHA')) return 0;
            if (datesFoundInRow === 1 && finalHeaders[1].includes('FECHA')) return 1;
        }

        // Initial coordinate slot
        let slot = 0;
        while (slot < boundaries.length && item.x >= boundaries[slot]) slot++;

        // Heuristic: If it's NOT a date but mapped to a date slot, move it to DESCRIPCION (slot 2)
        // unless it's the very first column (FECHA OPER.) and we have no other place for it.
        const descIdx = finalHeaders.indexOf('DESCRIPCION');
        if (!isDateLike && slot < 2 && descIdx !== -1) {
            return descIdx;
        }

        return Math.min(slot, finalHeaders.length - 1);
    };

    const tables = [];
    for (const page of pagesData) {
        const rows = groupIntoRows(page.items);
        const dataRows = processPageRows(rows, getSlot, finalHeaders, bankConfig);
        if (dataRows.length > 0) {
            if (bankConfig.transformOutput) {
                const { transformedHeaders, transformedRows } = bankConfig.transformOutput(finalHeaders, dataRows, { isFirstTable: tables.length === 0 });
                tables.push({ page: page.pageNumber, rows: [transformedHeaders, ...transformedRows] });
            } else {
                tables.push({ page: page.pageNumber, rows: [finalHeaders, ...dataRows] });
            }
        }
    }
    return tables;
}
