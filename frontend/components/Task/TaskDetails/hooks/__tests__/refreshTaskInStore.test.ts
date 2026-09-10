import {
    refreshTaskInStore,
    applyTaskUpdateAndRefresh,
} from '../refreshTaskInStore';
import { shouldDeleteAbandonedNewTask } from '../useTaskDetailsRouteLifecycle';

jest.mock('../../../../../utils/tasksService', () => ({
    fetchTaskByUid: jest.fn(),
}));

jest.mock('../../../../../store/useStore', () => {
    const tasksStore = {
        tasks: [] as Array<{ uid?: string; id?: number; name: string }>,
        updateTaskInStore: jest.fn((updatedTask) => {
            const idx = tasksStore.tasks.findIndex(
                (t) => t.id === updatedTask.id || t.uid === updatedTask.uid
            );
            if (idx >= 0) {
                tasksStore.tasks[idx] = {
                    ...tasksStore.tasks[idx],
                    ...updatedTask,
                };
            }
        }),
        setTasks: jest.fn((tasks) => {
            tasksStore.tasks = tasks;
        }),
    };
    return {
        useStore: Object.assign(
            jest.fn(),
            {
                getState: () => ({ tasksStore }),
            }
        ),
        __tasksStore: tasksStore,
    };
});

const { fetchTaskByUid } = jest.requireMock(
    '../../../../../utils/tasksService'
);
const { __tasksStore: tasksStore } = jest.requireMock(
    '../../../../../store/useStore'
);

describe('shouldDeleteAbandonedNewTask', () => {
    it('returns true for unmodified new tasks', () => {
        expect(shouldDeleteAbandonedNewTask(true, false)).toBe(true);
    });

    it('returns false when the new task was modified', () => {
        expect(shouldDeleteAbandonedNewTask(true, true)).toBe(false);
    });

    it('returns false for existing tasks', () => {
        expect(shouldDeleteAbandonedNewTask(false, false)).toBe(false);
    });
});

describe('refreshTaskInStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        tasksStore.tasks = [{ uid: 'task-1', id: 1, name: 'Old' }];
        (fetchTaskByUid as jest.Mock).mockResolvedValue({
            uid: 'task-1',
            id: 1,
            name: 'Fresh',
            tags: [{ name: 'alpha' }],
        });
    });

    it('fetches by uid and updates the store', async () => {
        const result = await refreshTaskInStore('task-1');

        expect(fetchTaskByUid).toHaveBeenCalledWith('task-1');
        expect(tasksStore.updateTaskInStore).toHaveBeenCalled();
        expect(result.name).toBe('Fresh');
        expect(tasksStore.tasks[0].name).toBe('Fresh');
    });

    it('applies merge options onto the fetched task', async () => {
        await refreshTaskInStore('task-1', {
            merge: { subtasks: [{ name: 'child', status: 'not_started', completed_at: null }] },
        });

        expect(tasksStore.updateTaskInStore).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Fresh',
                subtasks: [expect.objectContaining({ name: 'child' })],
            })
        );
    });
});

describe('applyTaskUpdateAndRefresh', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        tasksStore.tasks = [{ uid: 'task-1', id: 1, name: 'Old' }];
        (fetchTaskByUid as jest.Mock).mockResolvedValue({
            uid: 'task-1',
            id: 1,
            name: 'After update',
        });
    });

    it('marks modified, runs update, refreshes store, and bumps timeline', async () => {
        const markModified = jest.fn();
        const bumpTimeline = jest.fn();
        const updateFn = jest.fn().mockResolvedValue(undefined);

        await applyTaskUpdateAndRefresh('task-1', updateFn, {
            markModified,
            bumpTimeline,
        });

        expect(markModified).toHaveBeenCalled();
        expect(updateFn).toHaveBeenCalled();
        expect(fetchTaskByUid).toHaveBeenCalledWith('task-1');
        expect(bumpTimeline).toHaveBeenCalled();
        expect(tasksStore.tasks[0].name).toBe('After update');
    });
});
