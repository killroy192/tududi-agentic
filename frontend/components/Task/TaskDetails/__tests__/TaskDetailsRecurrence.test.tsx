import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskDetailsRecurrence from '../TaskDetailsRecurrence';
import { Task } from '../../../../entities/Task';
import { StoreState } from '../../../../store/useStore';
import {
    fetchTaskNextIterations,
    fetchTaskByUid,
} from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback,
        i18n: { language: 'en' },
    }),
    // TaskRecurrenceSection transitively imports frontend/i18n.ts, which calls
    // i18n.use(initReactI18next) at module load time; provide a valid stub
    // plugin so that call doesn't throw.
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('../../../../utils/tasksService', () => ({
    fetchTaskByUid: jest.fn(),
    fetchTaskNextIterations: jest.fn(),
    updateTask: jest.fn(),
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

const buildTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'A recurring task',
    status: 'not_started',
    completed_at: null,
    ...overrides,
});

function buildTasksStore(task: Task): StoreState['tasksStore'] {
    return {
        tasks: [task],
        isLoading: false,
        isError: false,
        setTasks: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        loadTasks: jest.fn(),
        createTask: jest.fn(),
        updateTask: jest.fn(),
        deleteTask: jest.fn(),
        toggleTaskCompletion: jest.fn(),
        loadTaskById: jest.fn(),
        loadTaskByUid: jest.fn(),
        loadSubtasks: jest.fn(),
        addTask: jest.fn(),
        removeTask: jest.fn(),
        updateTaskInStore: jest.fn(),
    };
}

describe('TaskDetailsRecurrence', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches next iterations for a recurring template task', async () => {
        const task = buildTask({ recurrence_type: 'daily', recurrence_interval: 1 });
        (fetchTaskNextIterations as jest.Mock).mockResolvedValue([
            { date: '2026-08-21' },
            { date: '2026-08-22' },
        ]);

        render(
            <TaskDetailsRecurrence
                task={task}
                tasksStore={buildTasksStore(task)}
                onTaskModified={jest.fn()}
                onTimelineRefresh={jest.fn()}
            />
        );

        await waitFor(() =>
            expect(fetchTaskNextIterations).toHaveBeenCalledWith('task-1')
        );
        await waitFor(() =>
            expect(
                screen.queryByText('No upcoming occurrences.')
            ).not.toBeInTheDocument()
        );
    });

    it('shows no upcoming occurrences for a non-recurring task without fetching', () => {
        const task = buildTask();

        render(
            <TaskDetailsRecurrence
                task={task}
                tasksStore={buildTasksStore(task)}
                onTaskModified={jest.fn()}
                onTimelineRefresh={jest.fn()}
            />
        );

        expect(fetchTaskNextIterations).not.toHaveBeenCalled();
        expect(fetchTaskByUid).not.toHaveBeenCalled();
        expect(screen.getByText('Add recurrence details')).toBeInTheDocument();
    });
});
