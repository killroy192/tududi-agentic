import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Task, TaskSize } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import TaskSizeControl from '../TaskSizeControl';
import { updateTask } from '../../../utils/tasksService';

const mockT = jest.fn((key: string, fallback?: string) => fallback ?? key);
const mockShowErrorToast = jest.fn();

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => mockT(key, fallback),
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast: mockShowErrorToast }),
}));

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
}));

const buildTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Ship size',
    status: 'not_started',
    completed_at: null,
    size: null,
    ...overrides,
});

const optionLabels = () =>
    screen
        .getAllByRole('menuitemradio')
        .map((option) =>
            (option.textContent ?? '').replace(/\s+/g, ' ').trim()
        );

describe('TaskSizeControl', () => {
    beforeEach(() => {
        mockT.mockImplementation(
            (key: string, fallback?: string) => fallback ?? key
        );
        mockShowErrorToast.mockReset();
        (updateTask as jest.Mock).mockReset();
        useStore.setState((state) => ({
            tasksStore: {
                ...state.tasksStore,
                tasks: [buildTask()],
                lastSizeUpdate: null,
            },
        }));
    });

    it('shows the Unset label when size is null', () => {
        render(<TaskSizeControl task={buildTask({ size: null })} />);

        expect(screen.getByTestId('task-size-trigger')).toHaveTextContent(
            /^Unset$/
        );
    });

    it.each(['S', 'M', 'L', 'XL'] as const)(
        'shows the literal letter %s',
        (size: TaskSize) => {
            render(<TaskSizeControl task={buildTask({ size })} />);

            expect(screen.getByTestId('task-size-trigger')).toHaveTextContent(
                new RegExp(`^${size}$`)
            );
        }
    );

    it.each([
        ['rw', 'rw'],
        ['admin', 'admin'],
        ['missing', undefined],
    ] as const)(
        'opens Unset, S, M, L, XL in that order for %s access',
        (_label, accessLevel) => {
            render(
                <TaskSizeControl
                    task={buildTask(
                        accessLevel === undefined
                            ? {}
                            : { access_level: accessLevel }
                    )}
                />
            );

            fireEvent.click(screen.getByTestId('task-size-trigger'));

            expect(optionLabels()).toEqual(['Unset', 'S', 'M', 'L', 'XL']);
        }
    );

    it('renders plain text with no menu for read-only access', () => {
        render(
            <TaskSizeControl
                task={buildTask({ access_level: 'ro', size: 'S' })}
            />
        );

        expect(screen.getByTestId('task-size-readonly')).toHaveTextContent(
            /^S$/
        );
        expect(screen.getByTestId('task-size-readonly')).toHaveAttribute(
            'aria-label',
            'Size: S'
        );
        expect(
            screen.queryByTestId('task-size-trigger')
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('task-size-readonly'));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('renders plain text with no menu for a virtual occurrence', () => {
        render(
            <TaskSizeControl
                task={buildTask({
                    access_level: 'admin',
                    is_virtual_occurrence: true,
                    size: null,
                })}
            />
        );

        expect(screen.getByTestId('task-size-readonly')).toHaveTextContent(
            /^Unset$/
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('renders nothing for a habit', () => {
        const { container } = render(
            <TaskSizeControl
                task={buildTask({ habit_mode: true, size: 'L' })}
            />
        );

        expect(container).toBeEmptyDOMElement();
        expect(
            screen.queryByTestId('task-size-trigger')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('task-size-readonly')
        ).not.toBeInTheDocument();
    });

    it('sends no request when the current value is chosen', () => {
        render(<TaskSizeControl task={buildTask({ size: 'M' })} />);

        fireEvent.click(screen.getByTestId('task-size-trigger'));
        fireEvent.click(screen.getByTestId('task-size-option-M'));

        expect(updateTask).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(useStore.getState().tasksStore.lastSizeUpdate).toBeNull();
    });

    it('saves the chosen size and publishes it', async () => {
        const onSaved = jest.fn();
        (updateTask as jest.Mock).mockResolvedValue({ size: 'M' });

        render(<TaskSizeControl task={buildTask()} onSaved={onSaved} />);

        fireEvent.click(screen.getByTestId('task-size-trigger'));
        fireEvent.click(screen.getByTestId('task-size-option-M'));

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledTimes(1);
        });
        expect(updateTask).toHaveBeenCalledWith('task-1', { size: 'M' });
        expect(onSaved).toHaveBeenCalledWith('M');
        expect(useStore.getState().tasksStore.lastSizeUpdate).toEqual({
            uid: 'task-1',
            size: 'M',
            seq: 1,
        });
        expect(useStore.getState().tasksStore.tasks[0].size).toBe('M');
        expect(screen.getByTestId('task-size-trigger')).toHaveTextContent(
            /^M$/
        );
    });

    it('clears the size when Unset is chosen', async () => {
        (updateTask as jest.Mock).mockResolvedValue({ size: null });

        render(<TaskSizeControl task={buildTask({ size: 'S' })} />);

        fireEvent.click(screen.getByTestId('task-size-trigger'));
        fireEvent.click(screen.getByTestId('task-size-option-unset'));

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledWith('task-1', { size: null });
        });
        expect(screen.getByTestId('task-size-trigger')).toHaveTextContent(
            /^Unset$/
        );
    });

    it('reverts and shows the provided error when the save fails', async () => {
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        (updateTask as jest.Mock).mockRejectedValue(new Error('offline'));

        render(
            <TaskSizeControl
                task={buildTask({ size: 'L' })}
                errorMessage="Could not save size"
            />
        );

        fireEvent.click(screen.getByTestId('task-size-trigger'));
        fireEvent.click(screen.getByTestId('task-size-option-S'));

        await waitFor(() => {
            expect(mockShowErrorToast).toHaveBeenCalledWith(
                'Could not save size'
            );
        });
        expect(screen.getByTestId('task-size-trigger')).toHaveTextContent(
            /^L$/
        );
        expect(useStore.getState().tasksStore.lastSizeUpdate).toBeNull();
        errorSpy.mockRestore();
    });

    it('has an aria-label and closes the menu on Escape', () => {
        render(<TaskSizeControl task={buildTask({ size: null })} />);

        const trigger = screen.getByTestId('task-size-trigger');
        expect(trigger).toHaveAttribute('aria-label', 'Size: Unset');
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        fireEvent.keyDown(trigger, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();

        fireEvent.click(trigger);
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows the translated Unset label and leaves the letters unchanged', () => {
        mockT.mockImplementation((key: string, fallback?: string) =>
            key === 'task.size.unset' ? 'Non défini' : (fallback ?? key)
        );

        render(<TaskSizeControl task={buildTask({ size: null })} />);

        expect(screen.getByTestId('task-size-trigger')).toHaveTextContent(
            /^Non défini$/
        );
        expect(screen.getByTestId('task-size-trigger')).toHaveAttribute(
            'aria-label',
            'Size: Non défini'
        );

        fireEvent.click(screen.getByTestId('task-size-trigger'));
        expect(optionLabels()).toEqual(['Non défini', 'S', 'M', 'L', 'XL']);
    });
});
