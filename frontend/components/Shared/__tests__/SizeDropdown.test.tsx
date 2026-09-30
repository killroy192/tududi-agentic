import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SizeDropdown from '../SizeDropdown';
import SizeBadge from '../SizeBadge';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback,
    }),
}));

describe('SizeDropdown', () => {
    it('exposes an accessible name that includes the current value', () => {
        render(<SizeDropdown value="M" onChange={jest.fn()} />);

        const trigger = screen.getByRole('button', { name: 'Size: M' });
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows "None" when the size is unset', () => {
        render(<SizeDropdown value={null} onChange={jest.fn()} />);

        expect(
            screen.getByRole('button', { name: 'Size: None' })
        ).toBeInTheDocument();
    });

    it('lists None, S, M, L and XL and reports the chosen size', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value={null} onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size: None' }));

        const options = screen.getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual([
            'None',
            'S',
            'M',
            'L',
            'XL',
        ]);

        fireEvent.click(screen.getByTestId('size-option-l'));

        expect(onChange).toHaveBeenCalledWith('L');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('reports null when "None" is chosen', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value="S" onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size: S' }));
        fireEvent.click(screen.getByTestId('size-option-none'));

        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('does not call onChange when re-selecting the current value', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value="S" onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size: S' }));
        fireEvent.click(screen.getByTestId('size-option-s'));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('is operable with the keyboard', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value={null} onChange={onChange} />);

        const trigger = screen.getByRole('button', { name: 'Size: None' });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });

        const noneOption = screen.getByTestId('size-option-none');
        expect(noneOption).toHaveFocus();

        fireEvent.keyDown(noneOption, { key: 'ArrowDown' });
        const smallOption = screen.getByTestId('size-option-s');
        expect(smallOption).toHaveFocus();

        fireEvent.keyDown(smallOption, { key: 'Enter' });
        expect(onChange).toHaveBeenCalledWith('S');
        expect(trigger).toHaveFocus();
    });

    it('closes on Escape without changing the value', () => {
        const onChange = jest.fn();
        render(<SizeDropdown value="XL" onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size: XL' }));
        fireEvent.keyDown(screen.getByTestId('size-option-xl'), {
            key: 'Escape',
        });

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not let clicks bubble to a surrounding row', () => {
        const onRowClick = jest.fn();
        render(
            <div onClick={onRowClick}>
                <SizeDropdown value={null} onChange={jest.fn()} />
            </div>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Size: None' }));
        fireEvent.click(screen.getByTestId('size-option-m'));

        expect(onRowClick).not.toHaveBeenCalled();
    });

    it('renders a read-only label instead of a control when disabled', () => {
        render(<SizeDropdown value="L" onChange={jest.fn()} disabled />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        const label = screen.getByTestId('size-dropdown-readonly');
        expect(label).toHaveTextContent('L');
        expect(label).toHaveAttribute('aria-disabled', 'true');
    });
});

describe('SizeBadge', () => {
    it('renders nothing when the size is unset', () => {
        const { container } = render(<SizeBadge size={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing for an unknown value', () => {
        const { container } = render(<SizeBadge size={'huge' as any} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the label with an accessible name when set', () => {
        render(<SizeBadge size="XL" />);

        const badge = screen.getByTestId('size-badge');
        expect(badge).toHaveTextContent('XL');
        expect(badge).toHaveAttribute('aria-label', 'Size: XL');
    });
});
