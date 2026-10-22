import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SizeDropdown from '../SizeDropdown';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

describe('SizeDropdown', () => {
    it('shows Unset when the size is empty and M when the size is M', () => {
        const { rerender } = render(
            <SizeDropdown value={null} isOwner onChange={jest.fn()} />
        );

        expect(screen.getByTestId('size-dropdown')).toHaveTextContent('Unset');

        rerender(
            <SizeDropdown value={undefined} isOwner onChange={jest.fn()} />
        );
        expect(screen.getByTestId('size-dropdown')).toHaveTextContent('Unset');

        rerender(<SizeDropdown value="M" isOwner onChange={jest.fn()} />);
        expect(screen.getByTestId('size-dropdown')).toHaveTextContent('M');
    });

    it('opens Unset, S, M, L, XL in that order for the owner', () => {
        render(<SizeDropdown value={null} isOwner onChange={jest.fn()} />);

        fireEvent.click(screen.getByTestId('size-dropdown'));

        const labels = [
            'size-option-unset',
            'size-option-S',
            'size-option-M',
            'size-option-L',
            'size-option-XL',
        ].map((testId) => screen.getByTestId(testId).textContent);

        expect(labels).toEqual(['Unset', 'S', 'M', 'L', 'XL']);
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByTestId('size-dropdown')).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    it('reports null for Unset and M for the M option', () => {
        const onChange = jest.fn();
        const { rerender } = render(
            <SizeDropdown value="S" isOwner onChange={onChange} />
        );

        fireEvent.click(screen.getByTestId('size-dropdown'));
        fireEvent.click(screen.getByTestId('size-option-unset'));

        expect(onChange).toHaveBeenCalledWith(null);
        expect(
            screen.queryByTestId('size-option-unset')
        ).not.toBeInTheDocument();

        rerender(<SizeDropdown value="S" isOwner onChange={onChange} />);
        fireEvent.click(screen.getByTestId('size-dropdown'));
        fireEvent.click(screen.getByTestId('size-option-M'));

        expect(onChange).toHaveBeenCalledWith('M');
    });

    it('does not open or change the size for a non-owner', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value="S" isOwner={false} onChange={onChange} />);

        const button = screen.getByTestId('size-dropdown');
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveTextContent('S');

        fireEvent.click(button);
        fireEvent.keyDown(button, { key: 'Enter' });
        fireEvent.keyDown(button, { key: ' ' });

        expect(screen.queryByTestId('size-option-M')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });
});
