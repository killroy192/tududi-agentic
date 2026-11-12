import React from 'react';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { Task } from '../../../entities/Task';
import TaskHeader, { TaskWithSubtasks } from '../TaskHeader';
import TaskItem from '../TaskItem';
import { updateTask } from '../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

jest.mock('../../../utils/dateUtils', () => ({
    parseDateString: (value: string) => new Date(`${value}T00:00:00`),
    getTodayDateString: () => '2026-11-11',
    getTomorrowDateString: () => '2026-11-12',
    getYesterdayDateString: () => '2026-11-10',
    isTaskOverdueInTodayPlan: () => false,
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue([]),
    toggleTaskCompletion: jest.fn(),
}));

const buildTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Row task',
    status: 'not_started',
    completed_at: null,
    size: null,
    access_level: 'rw',
    ...overrides,
});

const renderHeader = (
    props: Partial<React.ComponentProps<typeof TaskHeader>> = {}
) =>
    render(
        <TaskHeader task={buildTask()} onTaskClick={jest.fn()} {...props} />
    );

describe('TaskHeader size control', () => {
    beforeEach(() => {
        (updateTask as jest.Mock).mockReset();
    });

    it('shows the control in the desktop and mobile layouts', () => {
        renderHeader();

        const desktop = screen.getByTestId('task-size-slot-desktop');
        const mobile = screen.getByTestId('task-size-slot-mobile');

        expect(
            within(desktop).getByTestId('task-size-trigger')
        ).toHaveTextContent(/^Unset$/);
        expect(
            within(desktop).getByTestId('task-size-trigger').className
        ).toContain('text-xs');
        expect(
            within(mobile).getByTestId('task-size-trigger').className
        ).toContain('text-[11px]');
        expect(
            screen.queryByTestId('task-size-slot-kanban')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('task-size-slot-upcoming')
        ).not.toBeInTheDocument();
    });

    it('shows a compact control in the Kanban meta row', () => {
        renderHeader({ isKanbanView: true });

        const kanban = screen.getByTestId('task-size-slot-kanban');
        expect(
            within(kanban).getByTestId('task-size-trigger').className
        ).toContain('text-[11px]');
        expect(
            screen.queryByTestId('task-size-slot-desktop')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('task-size-slot-mobile')).toBeInTheDocument();
    });

    it('shows the control next to the name in the upcoming layout', () => {
        renderHeader({ isUpcomingView: true });

        const upcoming = screen.getByTestId('task-size-slot-upcoming');
        expect(
            within(upcoming).getByTestId('task-size-trigger')
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId('task-size-slot-desktop')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('task-size-slot-kanban')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('task-size-slot-mobile')).toBeInTheDocument();
    });

    it('renders no control when the task is a habit', () => {
        renderHeader({ task: buildTask({ habit_mode: true, size: 'L' }) });

        expect(
            screen.queryByTestId('task-size-trigger')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('task-size-readonly')
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId(/task-size-slot-/)).not.toBeInTheDocument();
    });

    it('does not call onTaskUpdate when the size changes', async () => {
        const onTaskUpdate = jest.fn();
        (updateTask as jest.Mock).mockResolvedValue({ size: 'S' });

        renderHeader({ onTaskUpdate });

        fireEvent.click(
            within(screen.getByTestId('task-size-slot-desktop')).getByTestId(
                'task-size-trigger'
            )
        );
        fireEvent.click(screen.getByTestId('task-size-option-S'));

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledWith('task-1', { size: 'S' });
        });
        expect(updateTask).toHaveBeenCalledTimes(1);
        expect(onTaskUpdate).not.toHaveBeenCalled();
    });

    it('does not show the control on compact subtask rows', async () => {
        const child: Task = {
            id: 2,
            uid: 'child-1',
            name: 'Compact child',
            status: 'not_started',
            completed_at: null,
            size: 'XL',
            access_level: 'rw',
        };

        render(
            <TaskWithSubtasks
                task={buildTask({ subtasks: [child] })}
                onTaskClick={jest.fn()}
            />
        );

        expect(await screen.findByText('Compact child')).toBeInTheDocument();
        expect(screen.getAllByTestId(/task-size-slot-/)).toHaveLength(2);
        expect(screen.getAllByTestId('task-size-trigger')).toHaveLength(2);
    });

    it('does not show the control in TaskItem compact subtask rows', async () => {
        const child: Task = {
            id: 2,
            uid: 'child-1',
            name: 'Compact child',
            status: 'not_started',
            completed_at: null,
            size: 'XL',
            access_level: 'rw',
        };

        render(
            <MemoryRouter
                future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                }}
            >
                <TaskItem
                    task={buildTask({ subtasks: [child] })}
                    onTaskUpdate={jest.fn()}
                    onTaskDelete={jest.fn()}
                    projects={[]}
                />
            </MemoryRouter>
        );

        fireEvent.click(screen.getAllByTitle('Show subtasks')[0]);

        expect(await screen.findByText('Compact child')).toBeInTheDocument();
        expect(screen.getAllByTestId(/task-size-slot-/)).toHaveLength(2);
    });
});
