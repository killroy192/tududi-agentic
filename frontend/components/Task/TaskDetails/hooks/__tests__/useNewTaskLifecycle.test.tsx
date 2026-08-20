import { renderHook } from '@testing-library/react';
import { useNewTaskLifecycle } from '../useNewTaskLifecycle';
import { useStore } from '../../../../../store/useStore';
import { deleteTask } from '../../../../../utils/tasksService';
import { Task } from '../../../../../entities/Task';

jest.mock('../../../../../utils/tasksService', () => ({
    deleteTask: jest.fn().mockResolvedValue(undefined),
}));

const buildTask = (uid: string): Task => ({
    id: 1,
    uid,
    name: 'A task',
    status: 'not_started',
    completed_at: null,
});

describe('useNewTaskLifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useStore.getState().tasksStore.setTasks([buildTask('task-1')]);
    });

    it('clears the isNew navigation state on mount', () => {
        const navigate = jest.fn();

        renderHook(() =>
            useNewTaskLifecycle({
                uid: 'task-1',
                isNewTask: true,
                navigate,
                pathname: '/task/task-1',
            })
        );

        expect(navigate).toHaveBeenCalledWith('/task/task-1', {
            replace: true,
            state: {},
        });
    });

    it('does not touch navigation state for an existing task', () => {
        const navigate = jest.fn();

        renderHook(() =>
            useNewTaskLifecycle({
                uid: 'task-1',
                isNewTask: false,
                navigate,
                pathname: '/task/task-1',
            })
        );

        expect(navigate).not.toHaveBeenCalled();
    });

    it('deletes an abandoned new task on unmount when it was never modified', () => {
        const { unmount } = renderHook(() =>
            useNewTaskLifecycle({
                uid: 'task-1',
                isNewTask: true,
                navigate: jest.fn(),
                pathname: '/task/task-1',
            })
        );

        unmount();

        expect(deleteTask).toHaveBeenCalledWith('task-1');
        expect(
            useStore
                .getState()
                .tasksStore.tasks.find((t) => t.uid === 'task-1')
        ).toBeUndefined();
    });

    it('does not delete the task on unmount once it has been modified', () => {
        const { result, unmount } = renderHook(() =>
            useNewTaskLifecycle({
                uid: 'task-1',
                isNewTask: true,
                navigate: jest.fn(),
                pathname: '/task/task-1',
            })
        );

        result.current.taskModifiedRef.current = true;
        unmount();

        expect(deleteTask).not.toHaveBeenCalled();
        expect(
            useStore
                .getState()
                .tasksStore.tasks.find((t) => t.uid === 'task-1')
        ).toBeDefined();
    });
});
