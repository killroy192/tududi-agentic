import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TaskItem from '../TaskItem';
import { Task } from '../../../entities/Task';
import { mergeSavedTaskSize, persistTaskSize } from '../../../utils/taskSize';
import { useStore } from '../../../store/useStore';
import { ToastProvider } from '../../Shared/ToastContext';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

jest.mock('../../../utils/taskSize', () => {
    const actual = jest.requireActual('../../../utils/taskSize');
    return {
        ...actual,
        persistTaskSize: jest.fn(),
    };
});

const persistTaskSizeMock = persistTaskSize as jest.MockedFunction<
    typeof persistTaskSize
>;

const ownerTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Write the note',
    status: 'not_started',
    priority: 'low',
    completed_at: null,
    size: null,
    user_uid: 'owner-1',
    ...overrides,
});

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
};

const renderTask = (task: Task, onSizeSaved?: (uid: string, size: Task['size']) => void) =>
    render(
        <MemoryRouter initialEntries={['/today']}>
            <ToastProvider>
                <LocationProbe />
                <Routes>
                    <Route
                        path="*"
                        element={
                            <TaskItem
                                task={task}
                                projects={[]}
                                onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                                onTaskDelete={jest.fn()}
                                onSizeSaved={onSizeSaved}
                            />
                        }
                    />
                </Routes>
            </ToastProvider>
        </MemoryRouter>
    );

describe('TaskItem size', () => {
    beforeEach(() => {
        localStorage.setItem(
            'currentUser',
            JSON.stringify({ uid: 'owner-1' })
        );
        useStore.getState().tasksStore.setTasks([]);
        persistTaskSizeMock.mockReset();
    });

    it('shows a size control on the shared row', () => {
        renderTask(ownerTask());

        expect(screen.getAllByTestId('size-dropdown').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: 'Size' })[0]).toHaveTextContent(
            'Unset'
        );
    });

    it('does not follow the row click when the owner opens the menu', () => {
        renderTask(ownerTask());

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);

        expect(screen.getByTestId('location')).toHaveTextContent('/today');
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('keeps a completed task editable for its owner', () => {
        renderTask(
            ownerTask({
                status: 'done',
                completed_at: '2026-01-01T00:00:00.000Z',
            })
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);

        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('shows the label and does not open the menu for a non-owner', () => {
        localStorage.setItem(
            'currentUser',
            JSON.stringify({ uid: 'someone-else' })
        );
        renderTask(ownerTask({ size: 'L' }));

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Size' })[0]).toHaveTextContent(
            'L'
        );
    });

    it('sends only the chosen size, toasts once, and shows the returned label', async () => {
        persistTaskSizeMock.mockResolvedValue('M');
        useStore.getState().tasksStore.setTasks([ownerTask()]);

        const SavedRow = () => {
            const [task, setTask] = useState(ownerTask());
            return (
                <TaskItem
                    task={task}
                    projects={[]}
                    onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                    onTaskDelete={jest.fn()}
                    onSizeSaved={(uid, size) =>
                        setTask((current) => mergeSavedTaskSize([current], uid, size)[0])
                    }
                />
            );
        };

        render(
            <MemoryRouter initialEntries={['/today']}>
                <ToastProvider>
                    <SavedRow />
                </ToastProvider>
            </MemoryRouter>
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);
        fireEvent.click(screen.getByTestId('size-option-M'));

        await waitFor(() => {
            expect(screen.getAllByText('Size updated successfully')).toHaveLength(1);
        });
        expect(screen.queryByText('Failed to update size')).not.toBeInTheDocument();
        expect(persistTaskSizeMock).toHaveBeenCalledTimes(1);
        expect(persistTaskSizeMock).toHaveBeenCalledWith('task-1', 'M');
        expect(useStore.getState().tasksStore.tasks[0].size).toBe('M');
        expect(
            screen.getAllByRole('button', { name: 'Size' }).every((button) =>
                button.textContent?.includes('M')
            )
        ).toBe(true);
    });

    it.each([
        ['network', new Error('Network request failed')],
        ['HTTP 500', new Error('There was a problem updating the task.')],
        ['HTTP 400', new Error('The size is invalid')],
    ])(
        'keeps the last label and shows only the error toast on %s',
        async (_label, error) => {
            persistTaskSizeMock.mockRejectedValue(error);
            renderTask(ownerTask({ size: 'S' }));

            fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);
            fireEvent.click(screen.getByTestId('size-option-XL'));

            await waitFor(() => {
                expect(screen.getAllByText('Failed to update size')).toHaveLength(1);
            });
            expect(
                screen.queryByText('Size updated successfully')
            ).not.toBeInTheDocument();
            expect(
                screen.getAllByRole('button', { name: 'Size' }).every((button) =>
                    button.textContent?.includes('S')
                )
            ).toBe(true);
        }
    );

    it('gives an expanded subtask its own size control and saves that subtask', async () => {
        persistTaskSizeMock.mockResolvedValue('L');
        renderTask(
            ownerTask({
                subtasks: [
                    {
                        id: 9,
                        uid: 'child-1',
                        name: 'Child step',
                        status: 'not_started',
                        completed_at: null,
                        size: null,
                        user_uid: 'owner-1',
                    },
                ],
            })
        );

        fireEvent.click(
            screen.getAllByRole('button', { name: 'Show subtasks' })[0]
        );

        const childRow = screen.getByText('Child step').closest('div');
        expect(childRow).not.toBeNull();
        const childButton = within(childRow!.parentElement as HTMLElement).getByRole(
            'button',
            { name: 'Size' }
        );
        fireEvent.click(childButton);
        fireEvent.click(screen.getByTestId('size-option-L'));

        await waitFor(() => {
            expect(persistTaskSizeMock).toHaveBeenCalledWith('child-1', 'L');
        });
        expect(screen.getAllByText('Size updated successfully')).toHaveLength(1);
    });
});

describe('virtual upcoming rows', () => {
    beforeEach(() => {
        localStorage.setItem(
            'currentUser',
            JSON.stringify({ uid: 'owner-1' })
        );
        persistTaskSizeMock.mockReset();
    });

    it('updates every open row of the series and keeps each due date', async () => {
        const formatDueDate = (dueDate: string) =>
            new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        const firstDate = '2099-01-15';
        const secondDate = '2099-06-20';
        const rows: Array<Task & { is_virtual_occurrence: boolean }> = [
            {
                ...ownerTask(),
                due_date: firstDate,
                is_virtual_occurrence: true,
            },
            {
                ...ownerTask(),
                due_date: secondDate,
                is_virtual_occurrence: true,
            },
        ];
        useStore.getState().tasksStore.setTasks(rows);
        persistTaskSizeMock.mockResolvedValue('M');

        const VirtualList = () => {
            const [tasks, setTasks] = useState(rows);
            return (
                <>
                    {tasks.map((task) => (
                        <TaskItem
                            key={task.due_date}
                            task={task}
                            projects={[]}
                            onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                            onTaskDelete={jest.fn()}
                            onSizeSaved={(uid, size) =>
                                setTasks((current) =>
                                    mergeSavedTaskSize(current, uid, size)
                                )
                            }
                        />
                    ))}
                </>
            );
        };

        render(
            <MemoryRouter>
                <ToastProvider>
                    <VirtualList />
                </ToastProvider>
            </MemoryRouter>
        );

        expect(screen.getAllByText(formatDueDate(firstDate)).length).toBeGreaterThan(0);
        expect(screen.getAllByText(formatDueDate(secondDate)).length).toBeGreaterThan(0);

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);
        fireEvent.click(screen.getByTestId('size-option-M'));

        await waitFor(() => {
            expect(screen.getAllByText('Size updated successfully')).toHaveLength(1);
        });
        expect(
            screen.getAllByRole('button', { name: 'Size' }).every((button) =>
                button.textContent?.includes('M')
            )
        ).toBe(true);
        expect(screen.getAllByText(formatDueDate(firstDate)).length).toBeGreaterThan(0);
        expect(screen.getAllByText(formatDueDate(secondDate)).length).toBeGreaterThan(0);

        const stored = useStore.getState().tasksStore.tasks as Array<
            Task & { is_virtual_occurrence?: boolean }
        >;
        expect(stored.map((task) => task.size)).toEqual(['M', 'M']);
        expect(stored.map((task) => task.due_date)).toEqual([firstDate, secondDate]);
        expect(stored.every((task) => task.is_virtual_occurrence)).toBe(true);
    });
});
