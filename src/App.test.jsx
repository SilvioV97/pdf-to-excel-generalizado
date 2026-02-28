import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
    it('renders header and default state correctly', () => {
        render(<App />);
        expect(screen.getByText('PDF to Excel')).toBeInTheDocument();
        expect(screen.getByText('Extracción Inteligente de Estados de Cuenta')).toBeInTheDocument();
        expect(screen.getByText('Cargar Estado de Cuenta')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('changes selected bank', () => {
        render(<App />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'banbif' } });
        expect(select.value).toBe('banbif');
    });
});
