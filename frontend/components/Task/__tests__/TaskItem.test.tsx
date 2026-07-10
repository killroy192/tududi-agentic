import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TaskItem from '../TaskItem';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en', t: (key: string) => key },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/tasks', search: '' }),
}));

const showSuccessToast = jest.fn();
const showErrorToast = jest.fn();
const showUndoToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast,
        showErrorToast,
        showUndoToast,
    }),
}));

const mockDuplicateTask = jest.fn();
jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: jest.fn(),
    updateTask: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue([]),
    duplicateTask: (...args: unknown[]) => mockDuplicateTask(...args),
}));

const baseTask: Task = {
    id: 1,
    uid: 'task-uid-1',
    name: 'Sample task',
    status: 'not_started',
    completed_at: null,
};

const renderTaskItem = (
    overrides: Partial<Task> = {},
    props: Partial<React.ComponentProps<typeof TaskItem>> = {}
) => {
    const task = { ...baseTask, ...overrides };
    return render(
        <MemoryRouter>
            <TaskItem
                task={task}
                onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                onTaskDelete={jest.fn()}
                projects={[]}
                {...props}
            />
        </MemoryRouter>
    );
};

describe('TaskItem - duplication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows a success toast after successful duplication (AC-5)', async () => {
        const duplicatedTask: Task = {
            ...baseTask,
            id: 2,
            uid: 'task-uid-2',
            name: 'Sample task (copy)',
        };
        mockDuplicateTask.mockResolvedValueOnce(duplicatedTask);
        const onTaskDuplicated = jest.fn();

        renderTaskItem({}, { onTaskDuplicated });

        const duplicateButton = screen.getAllByTitle('Duplicate task')[0];
        fireEvent.click(duplicateButton);

        await waitFor(() => {
            expect(mockDuplicateTask).toHaveBeenCalledWith('task-uid-1');
        });
        await waitFor(() => {
            expect(showSuccessToast).toHaveBeenCalledWith(
                'Task duplicated successfully'
            );
        });
        expect(showErrorToast).not.toHaveBeenCalled();
        expect(onTaskDuplicated).toHaveBeenCalledWith(duplicatedTask);
    });

    it('shows an error toast when duplication fails (AC-9)', async () => {
        mockDuplicateTask.mockRejectedValueOnce(new Error('boom'));
        const onTaskDuplicated = jest.fn();

        renderTaskItem({}, { onTaskDuplicated });

        const duplicateButton = screen.getAllByTitle('Duplicate task')[0];
        fireEvent.click(duplicateButton);

        await waitFor(() => {
            expect(mockDuplicateTask).toHaveBeenCalledWith('task-uid-1');
        });
        await waitFor(() => {
            expect(showErrorToast).toHaveBeenCalledWith(
                'Failed to duplicate task'
            );
        });
        expect(showSuccessToast).not.toHaveBeenCalled();
        expect(onTaskDuplicated).not.toHaveBeenCalled();
    });

    it('does not render the duplicate button for habit tasks (AC-3)', () => {
        renderTaskItem({ habit_mode: true });

        expect(screen.queryAllByTitle('Duplicate task')).toHaveLength(0);
    });

    it('guards against rapid repeated clicks firing multiple requests (F7)', async () => {
        let resolveDuplicate: (task: Task) => void;
        mockDuplicateTask.mockImplementationOnce(
            () =>
                new Promise<Task>((resolve) => {
                    resolveDuplicate = resolve;
                })
        );

        renderTaskItem();

        const duplicateButton = screen.getAllByTitle('Duplicate task')[0];
        fireEvent.click(duplicateButton);
        fireEvent.click(duplicateButton);
        fireEvent.click(duplicateButton);

        expect(mockDuplicateTask).toHaveBeenCalledTimes(1);

        resolveDuplicate!({ ...baseTask, id: 2, uid: 'task-uid-2' });
        await waitFor(() => {
            expect(showSuccessToast).toHaveBeenCalled();
        });
    });
});
