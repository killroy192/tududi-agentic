import { renderHook, waitFor } from '@testing-library/react';
import { useTaskDetailsLoader } from '../useTaskDetailsLoader';
import { useStore } from '../../../../../store/useStore';
import { fetchTaskByUid } from '../../../../../utils/tasksService';
import { Task } from '../../../../../entities/Task';

jest.mock('../../../../../utils/tasksService', () => ({
    fetchTaskByUid: jest.fn(),
}));

const buildTask = (uid: string): Task => ({
    id: 1,
    uid,
    name: 'A task',
    status: 'not_started',
    completed_at: null,
});

describe('useTaskDetailsLoader', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useStore.getState().tasksStore.setTasks([]);
    });

    it('fetches the task and adds it to the store when missing', async () => {
        const fetched = buildTask('task-1');
        (fetchTaskByUid as jest.Mock).mockResolvedValue(fetched);
        const tasksStore = useStore.getState().tasksStore;

        const { result } = renderHook(() =>
            useTaskDetailsLoader('task-1', undefined, tasksStore)
        );

        expect(result.current.loading).toBe(true);

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(fetchTaskByUid).toHaveBeenCalledWith('task-1');
        expect(result.current.error).toBeNull();
        expect(
            useStore
                .getState()
                .tasksStore.tasks.find((t) => t.uid === 'task-1')
        ).toEqual(fetched);
    });

    it('does not fetch when the task is already present', () => {
        const existing = buildTask('task-1');
        const tasksStore = useStore.getState().tasksStore;

        const { result } = renderHook(() =>
            useTaskDetailsLoader('task-1', existing, tasksStore)
        );

        expect(fetchTaskByUid).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
    });

    it('sets an error when the task cannot be found', async () => {
        (fetchTaskByUid as jest.Mock).mockRejectedValue(new Error('404'));
        const tasksStore = useStore.getState().tasksStore;

        const { result } = renderHook(() =>
            useTaskDetailsLoader('missing-uid', undefined, tasksStore)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe('Task not found');
    });

    it('sets an error when no uid is provided', () => {
        const tasksStore = useStore.getState().tasksStore;

        const { result } = renderHook(() =>
            useTaskDetailsLoader(undefined, undefined, tasksStore)
        );

        expect(result.current.error).toBe('No task uid provided');
        expect(result.current.loading).toBe(false);
    });
});
