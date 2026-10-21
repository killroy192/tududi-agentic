import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SizeDropdown from '../SizeDropdown';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

describe('SizeDropdown', () => {
    it('shows the current closed label', () => {
        const { rerender } = render(
            <SizeDropdown value={null} canEdit onChange={jest.fn()} />
        );

        expect(screen.getByRole('button', { name: 'Size' })).toHaveTextContent(
            'Unset'
        );

        rerender(<SizeDropdown value="M" canEdit onChange={jest.fn()} />);

        expect(screen.getByRole('button', { name: 'Size' })).toHaveTextContent(
            'M'
        );
    });

    it('lists Unset, S, M, L, and XL in that order', () => {
        render(<SizeDropdown value={null} canEdit onChange={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size' }));

        expect(
            screen.getAllByRole('option').map((option) => option.textContent)
        ).toEqual(['Unset', 'S', 'M', 'L', 'XL']);
    });

    it('reports null when the owner chooses Unset', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value="M" canEdit onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size' }));
        fireEvent.click(screen.getByTestId('size-option-unset'));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('does not open the menu for someone who cannot edit', () => {
        const onChange = jest.fn();
        const onRowClick = jest.fn();
        render(
            <div onClick={onRowClick}>
                <SizeDropdown value="S" canEdit={false} onChange={onChange} />
            </div>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Size' }));

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
        expect(onRowClick).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Size' })).toHaveTextContent(
            'S'
        );
    });
});
