// Configuration for BanBif.
export const banbifConfig = {
    id: 'banbif',
    name: 'BanBif',
    schema: [
        'FECHA OPER.', 'FECHA VALOR', 'DESCRIPCION',
        'CARGO', 'ABONO', 'SALDO CONTABLE'
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
        if (v.includes('DÉBITO') || v.includes('DEBITO')) return 'CARGO';
        if (v.includes('CRÉDITO') || v.includes('CREDITO')) return 'ABONO';
        if (v.includes('SALDO')) return 'SALDO CONTABLE';
        return v;
    }
};
