// Configuration for BanBif.
export const banbifConfig = {
    id: 'banbif',
    name: 'BanBif',
    schema: [
        'FECHA OPER.', 'FECHA VALOR', 'DESCRIPCION',
        'OFICINA', 'CAN', 'N° OPER.', 'CARGO/ABONO',
        'ITF', 'SALDO CONTABLE'
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
    }
};
