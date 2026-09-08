import React from 'react';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import SizeControl from '../SizeControl';

const mockUpdateTask = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('../../../utils/tasksService', () => ({
    updateTask: (...args: unknown[]) => mockUpdateTask(...args),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: mockShowErrorToast,
        showSuccessToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallbackOrOptions?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
            if (typeof fallbackOrOptions === 'string') {
                if (options?.value !== undefined) {
                    return fallbackOrOptions.replace('{{value}}', String(options.value));
                }
                return fallbackOrOptions;
            }
            return key;
        },
    }),
}));

describe('SizeControl', () => {
    beforeEach(() => {
        mockUpdateTask.mockReset();
        mockShowErrorToast.mockReset();
    });

    it('optimistically shows the new value before the request settles (AC-6)', async () => {
        let resolveUpdate: (value: unknown) => void = () => undefined;
        mockUpdateTask.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveUpdate = resolve;
                })
        );

        render(<SizeControl taskUid="task-1" size={1} variant="chip" />);

        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'L' }));

        expect(screen.getByTestId('task-size-control')).toHaveTextContent('L');

        await act(async () => {
            resolveUpdate({ size: 3 });
        });
    });

    it('does not request when re-selecting the current size (AC-11)', async () => {
        render(<SizeControl taskUid="task-1" size={2} variant="chip" />);

        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'M' }));

        expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('sends only the size field (AC-8)', async () => {
        mockUpdateTask.mockResolvedValue({ size: 4 });
        render(<SizeControl taskUid="task-1" size={null} variant="chip" />);

        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'XL' }));

        await waitFor(() => {
            expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { size: 4 });
        });
    });

    it('reverts and shows a network error toast on failure (AC-7)', async () => {
        mockUpdateTask.mockRejectedValue(new Error('Server error'));
        render(<SizeControl taskUid="task-1" size={1} variant="chip" />);

        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'M' }));

        await waitFor(() => {
            expect(screen.getByTestId('task-size-control')).toHaveTextContent(
                'S'
            );
        });
        expect(mockShowErrorToast).toHaveBeenCalled();
    });

    it('reverts and shows a permission toast on Forbidden (AC-7)', async () => {
        mockUpdateTask.mockRejectedValue(new Error('Forbidden'));
        render(<SizeControl taskUid="task-1" size={1} variant="chip" />);

        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'L' }));

        await waitFor(() => {
            expect(screen.getByTestId('task-size-control')).toHaveTextContent(
                'S'
            );
        });
        expect(mockShowErrorToast).toHaveBeenCalledWith('Forbidden');
    });

    it('keeps the last selection when responses arrive out of order (AC-21)', async () => {
        const resolvers: Array<(value: unknown) => void> = [];
        mockUpdateTask.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvers.push(resolve);
                })
        );

        render(<SizeControl taskUid="task-1" size={null} variant="chip" />);

        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'S' }));
        fireEvent.click(screen.getByTestId('task-size-control'));
        fireEvent.click(screen.getByRole('option', { name: 'XL' }));

        expect(resolvers).toHaveLength(2);

        await act(async () => {
            resolvers[1]({ size: 4 });
            resolvers[0]({ size: 1 });
        });

        expect(screen.getByTestId('task-size-control')).toHaveTextContent('XL');
    });

    it('renders unset for an invalid size without throwing (AC-22)', () => {
        render(<SizeControl taskUid="task-1" size={99 as any} variant="chip" />);
        expect(screen.getByTestId('task-size-control')).toBeInTheDocument();
        expect(screen.getByTestId('task-size-control')).toHaveAttribute(
            'aria-label',
            expect.stringContaining('None')
        );
    });

    it('stops Enter/Space from bubbling to a parent row button (AC-23)', () => {
        const onNavigate = jest.fn();
        render(
            <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        onNavigate();
                    }
                }}
            >
                <SizeControl taskUid="task-1" size={1} variant="chip" />
            </div>
        );

        const control = screen.getByTestId('task-size-control');
        control.focus();
        fireEvent.keyDown(control, { key: 'Enter' });
        expect(onNavigate).not.toHaveBeenCalled();
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        fireEvent.keyDown(control, { key: ' ' });
        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('uses logical end positioning utilities (AC-26)', () => {
        render(<SizeControl taskUid="task-1" size={1} variant="chip" />);
        fireEvent.click(screen.getByTestId('task-size-control'));
        const listbox = screen.getByRole('listbox');
        expect(listbox.className).toContain('end-0');
        expect(listbox.className).not.toMatch(/\b(left|right)-/);
    });
});
