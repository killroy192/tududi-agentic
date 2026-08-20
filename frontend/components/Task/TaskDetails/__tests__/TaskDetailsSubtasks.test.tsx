import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskDetailsSubtasks from '../TaskDetailsSubtasks';
import { Task } from '../../../../entities/Task';
import { StoreState } from '../../../../store/useStore';
import { fetchSubtasks } from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));

jest.mock('../../../../utils/tasksService', () => ({
    fetchSubtasks: jest.fn(),
    fetchTaskByUid: jest.fn(),
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
    name: 'A task',
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

describe('TaskDetailsSubtasks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lazily fetches subtasks when the task has none loaded yet', async () => {
        const task = buildTask({ subtasks: [] });
        const fetched = [buildTask({ id: 2, uid: 'sub-1', name: 'Sub 1' })];
        (fetchSubtasks as jest.Mock).mockResolvedValue(fetched);
        const tasksStore = buildTasksStore(task);

        render(<TaskDetailsSubtasks task={task} tasksStore={tasksStore} onTaskModified={jest.fn()} onTimelineRefresh={jest.fn()} />);

        await waitFor(() => expect(fetchSubtasks).toHaveBeenCalledWith('task-1'));
        expect(tasksStore.setTasks).toHaveBeenCalledWith([
            { ...task, subtasks: fetched },
        ]);
    });

    it('does not fetch again once subtasks are already loaded from the store', () => {
        const task = buildTask({
            subtasks: [buildTask({ id: 2, uid: 'sub-1', name: 'Sub 1' })],
        });
        const tasksStore = buildTasksStore(task);

        render(<TaskDetailsSubtasks task={task} tasksStore={tasksStore} onTaskModified={jest.fn()} onTimelineRefresh={jest.fn()} />);

        expect(fetchSubtasks).not.toHaveBeenCalled();
    });
});
