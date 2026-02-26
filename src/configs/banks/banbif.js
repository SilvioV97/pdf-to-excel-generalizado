// Configuration for BanBif.
export const banbifConfig = {
    id: 'banbif',
    name: 'BanBif',
    // Schema must include our temporary columns so `PdfProcessor.js` tracks them
    schema: [
        'FECHA OPER.', 'FECHA VALOR', 'DESCRIPCION',
        'CARGO/ABONO_NEGATIVE', 'CARGO/ABONO_POSITIVE', 'SALDO CONTABLE'
    ],
    footerKeywords: [
        'saldo anterior',
        'total cargos',
        'por favor examine este estado de cuenta'
    ],
    headerDetectionRegexes: ['fecha', 'descrip', 'débito', 'crédito', 'saldo', 'debito', 'credito'],
    minHeadersRequired: 4,

    normalizeHeader: (lbl) => {
        const v = lbl.toUpperCase().replace(/\s+/g, ' ').trim();
        if (v === 'FECHA') return 'FECHA OPER.';
        if (v.includes('FECHA') && v.includes('VALOR')) return 'FECHA VALOR';
        if (v.includes('DESCRIP') || v.includes('CONCEPTO')) return 'DESCRIPCION';

        // Map both Débito and Crédito to the unified 'CARGO/ABONO' column
        // We track their original positions using x coordinates to determine the sign later
        if (v.includes('DÉBITO') || v.includes('DEBITO')) return 'CARGO/ABONO_NEGATIVE';
        if (v.includes('CRÉDITO') || v.includes('CREDITO')) return 'CARGO/ABONO_POSITIVE';

        if (v.includes('SALDO')) return 'SALDO CONTABLE';
        return v;
    },

    transformOutput: (headers, dataRows, context) => {
        const UNIVERSAL_SCHEMA = [
            'FECHA OPER.', 'FECHA VALOR', 'DESCRIPCION',
            'OFICINA', 'CAN', 'N° OPER.', 'CARGO/ABONO',
            'ITF', 'SALDO CONTABLE'
        ];

        const negIdx = headers.indexOf('CARGO/ABONO_NEGATIVE');
        const posIdx = headers.indexOf('CARGO/ABONO_POSITIVE');

        // Target index in universal schema
        const targetCargoIdx = UNIVERSAL_SCHEMA.indexOf('CARGO/ABONO');

        const transformedRows = [];

        // Let's create a helper to cleanly parse numbers
        const parseNum = (str) => {
            if (!str) return null;
            const clean = str.replace(/,/g, '').replace(/\s/g, '');
            const num = parseFloat(clean);
            return isNaN(num) ? null : num;
        };

        const formatNum = (num) => {
            if (num === null) return '';
            // Basic format back to string with 2 decimals
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        for (let i = 0; i < dataRows.length; i++) {
            const originalRow = dataRows[i];
            const newRow = new Array(UNIVERSAL_SCHEMA.length).fill('');

            // Copy over mapped columns
            headers.forEach((h, hIdx) => {
                let cellVal = originalRow[hIdx] || '';

                if (h === 'CARGO/ABONO_NEGATIVE' || h === 'CARGO/ABONO_POSITIVE') {
                    // Handled below
                    return;
                }

                const targetIdx = UNIVERSAL_SCHEMA.indexOf(h);
                if (targetIdx !== -1) {
                    newRow[targetIdx] = cellVal;
                }
            });

            // Handle the Cargo/Abono merge
            let negVal = negIdx >= 0 ? parseNum(originalRow[negIdx]) : null;
            let posVal = posIdx >= 0 ? parseNum(originalRow[posIdx]) : null;

            let finalCargoAbono = '';
            let rawNumericCargoAbono = 0; // For math

            if (negVal !== null) {
                finalCargoAbono = `-${formatNum(Math.abs(negVal))}`;
                rawNumericCargoAbono = -Math.abs(negVal);
            } else if (posVal !== null) {
                finalCargoAbono = formatNum(Math.abs(posVal));
                rawNumericCargoAbono = Math.abs(posVal);
            }

            newRow[targetCargoIdx] = finalCargoAbono;
            transformedRows.push(newRow);
        }

        // Feature: Inject "SALDO ANTERIOR" mathematically if this is the very first table
        if (context?.isFirstTable && transformedRows.length > 0) {
            const firstRow = transformedRows[0];
            const saldoIdx = UNIVERSAL_SCHEMA.indexOf('SALDO CONTABLE');
            const descIdx = UNIVERSAL_SCHEMA.indexOf('DESCRIPCION');

            const firstSaldo = parseNum(firstRow[saldoIdx]);

            // Recompute cargo from the first row since we just baked it above
            const firstCargoStr = firstRow[targetCargoIdx];
            const firstCargoNum = parseNum(firstCargoStr);

            if (firstSaldo !== null && firstCargoNum !== null) {
                // Math: CurrentBalance = PrevBalance + CargoAbono
                // Thus: PrevBalance = CurrentBalance - CargoAbono
                const prevBalance = firstSaldo - firstCargoNum;

                const saldoAnteriorRow = new Array(UNIVERSAL_SCHEMA.length).fill('');
                saldoAnteriorRow[descIdx] = 'SALDO ANTERIOR';
                saldoAnteriorRow[saldoIdx] = formatNum(prevBalance);

                transformedRows.unshift(saldoAnteriorRow);
            }
        }

        return {
            transformedHeaders: UNIVERSAL_SCHEMA,
            transformedRows: transformedRows
        };
    }
};
