import { banbifConfig } from './banbif';
import { bbvaConfig } from './bbva';

describe('Bank Configurations', () => {
    describe('BanBif Config', () => {
        it('normalizes headers correctly', () => {
            expect(banbifConfig.normalizeHeader('Fecha')).toBe('FECHA OPER.');
            expect(banbifConfig.normalizeHeader('FECHA VALOR')).toBe('FECHA VALOR');
            expect(banbifConfig.normalizeHeader('DESCRIPCION')).toBe('DESCRIPCION');
            expect(banbifConfig.normalizeHeader('DÉBITO')).toBe('CARGO/ABONO_NEGATIVE');
            expect(banbifConfig.normalizeHeader('CRÉDITO')).toBe('CARGO/ABONO_POSITIVE');
            expect(banbifConfig.normalizeHeader('SALDO')).toBe('SALDO CONTABLE');
        });
    });

    describe('BBVA Config', () => {
        it('normalizes headers correctly', () => {
            expect(bbvaConfig.normalizeHeader('FECHA VALOR')).toBe('FECHA VALOR');
            expect(bbvaConfig.normalizeHeader('FECHA F. OPER')).toBe('FECHA OPER.');
            expect(bbvaConfig.normalizeHeader('CONCEPTO')).toBe('DESCRIPCION');
            expect(bbvaConfig.normalizeHeader('OFICINA')).toBe('OFICINA');
            expect(bbvaConfig.normalizeHeader('CARGO')).toBe('CARGO/ABONO');
            expect(bbvaConfig.normalizeHeader('SALDO')).toBe('SALDO CONTABLE');
        });
    });
});
