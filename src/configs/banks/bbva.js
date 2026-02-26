export const bbvaConfig = {
    id: 'bbva',
    name: 'BBVA',
    schema: [
        'FECHA OPER.', 'FECHA VALOR', 'DESCRIPCION',
        'OFICINA', 'CAN', 'N° OPER.', 'CARGO/ABONO',
        'ITF', 'SALDO CONTABLE'
    ],
    // Known strings that indicate the end of data tables
    footerKeywords: [
        'codigo cuenta interbancaria',
        'rogamos verifique',
        'totales por itf'
    ],
    // Strict table detection requirements
    headerDetectionRegexes: ['fecha', 'descr', 'saldo', 'cargo', 'oficina'],
    minHeadersRequired: 3,

    // Normalization logic specific to BBVA phrasing
    normalizeHeader: (lbl) => {
        const v = lbl.toUpperCase().replace(/\s+/g, ' ').trim();
        if (v.includes('FECHA') && v.includes('VALOR')) return 'FECHA VALOR';
        if (v.includes('FECHA') && (v.includes('OPER') || v.includes('F.'))) return 'FECHA OPER.';
        if (v === 'VALOR') return 'FECHA VALOR';
        if (v === 'OPER.' || v === 'OPER') return 'FECHA OPER.';
        if (v.includes('FECHA')) return 'FECHA OPER.';
        if (v.includes('DESCRIP') || v.includes('CONCEPTO')) return 'DESCRIPCION';
        if (v.includes('OFICINA')) return 'OFICINA';
        if (v.includes('CAN')) return 'CAN';
        if ((v.includes('N°') || v.includes('NRO') || v.includes('NUM')) && (v.includes('OPER') || v.includes('OP'))) return 'N° OPER.';
        if (v.includes('CARGO') || v.includes('ABONO')) return 'CARGO/ABONO';
        if (v.includes('ITF')) return 'ITF';
        if (v.includes('SALDO') || v.includes('CONTABLE')) return 'SALDO CONTABLE';
        return v;
    }
};
