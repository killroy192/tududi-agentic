import { renderHook, waitFor, act } from '@testing-library/react';
import { useTaskDetailsRouteLifecycle } from '../useTaskDetailsRouteLifecycle';
import { useTaskDetailsLoad } from '../useTaskDetailsLoad';

const mockNavigate = jest.fn();
const mockDeleteTask = jest.fn().mockResolvedValue(undefined);
const mockFetchTaskByUid = jest.fn();
const mockFetchSubtasks = jest.fn();
const mockFetchAttachments = jest.fn().mockResolvedValue([]);

jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

jest.mock('../../../../../utils/tasksService', () => ({
    deleteTask: (...args: unknown[]) => mockDeleteTask(...args),
    fetchTaskByUid: (...args: unknown[]) => mockFetchTaskByUid(...args),
    fetchSubtasks: (...args: unknown[]) => mockFetchSubtasks(...args),
}));

jest.mock('../../../../../utils/attachmentsService', () => ({
    fetchAttachments: (...args: unknown[]) => mockFetchAttachments(...args),
}));

jest.mock('../../../../../store/useStore', () => {
    // Jest mock factories cannot use outer-scope imports; require is required here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    const listeners = new Set<() => void>();
    let tasks: Array<Record<string, unknown>> = [];

    const notify = () => {
        listeners.forEach((listener) => listener());
    };

    const tasksStore = {
        get tasks() {
            return tasks;
        },
        setTasks: jest.fn((next: Array<Record<string, unknown>>) => {
            tasks = next;
            notify();
        }),
        updateTaskInStore: jest.fn((updatedTask: Record<string, unknown>) => {
            tasks = tasks.map((t) =>
                t.id === updatedTask.id || t.uid === updatedTask.uid
                    ? { ...t, ...updatedTask }
                    : t
            );
            notify();
        }),
        __reset(next: Array<Record<string, unknown>> = []) {
            tasks = next;
            notify();
        },
    };

    const getState = () => ({ tasksStore });

    const useStore = (selector: (state: { tasksStore: typeof tasksStore }) => unknown) =>
        React.useSyncExternalStore(
            (onStoreChange: () => void) => {
                listeners.add(onStoreChange);
                return () => listeners.delete(onStoreChange);
            },
            () => selector(getState())
        );

    return {
        useStore: Object.assign(useStore, { getState }),
        __tasksStore: tasksStore,
    };
});

const { __tasksStore: tasksStore } = jest.requireMock(
    '../../../../../store/useStore'
);

describe('useTaskDetailsRouteLifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        tasksStore.__reset([{ uid: 'new-1', id: 1, name: 'Untitled' }]);
    });

    it('clears isNew navigation state via replace', () => {
        renderHook(() =>
            useTaskDetailsRouteLifecycle('new-1', true, '/task/new-1')
        );

        expect(mockNavigate).toHaveBeenCalledWith('/task/new-1', {
            replace: true,
            state: {},
        });
    });

    it('deletes abandoned new task on unmount when unmodified', () => {
        const { unmount } = renderHook(() =>
            useTaskDetailsRouteLifecycle('new-1', true, '/task/new-1')
        );

        unmount();

        expect(mockDeleteTask).toHaveBeenCalledWith('new-1');
        expect(tasksStore.setTasks).toHaveBeenCalledWith([]);
    });

    it('does not delete when markTaskModified was called', () => {
        const { result, unmount } = renderHook(() =>
            useTaskDetailsRouteLifecycle('new-1', true, '/task/new-1')
        );

        act(() => {
            result.current.markTaskModified();
        });
        unmount();

        expect(mockDeleteTask).not.toHaveBeenCalled();
    });
});

describe('useTaskDetailsLoad', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        tasksStore.__reset([]);
        mockFetchTaskByUid.mockResolvedValue({
            uid: 'task-1',
            id: 1,
            name: 'Loaded',
            status: 'not_started',
            completed_at: null,
            subtasks: [],
        });
        mockFetchSubtasks.mockResolvedValue([
            {
                uid: 'sub-1',
                id: 2,
                name: 'Child',
                status: 'not_started',
                completed_at: null,
            },
        ]);
        mockFetchAttachments.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    });

    it('fetches task by uid when missing from store', async () => {
        const { result } = renderHook(() => useTaskDetailsLoad('task-1'));

        await waitFor(() => {
            expect(mockFetchTaskByUid).toHaveBeenCalledWith('task-1');
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.task?.name).toBe('Loaded');
        });
    });

    it('hydrates subtasks into the store and mirrors pendingSubtasks', async () => {
        tasksStore.__reset([
            {
                uid: 'task-1',
                id: 1,
                name: 'Loaded',
                status: 'not_started',
                completed_at: null,
                subtasks: [],
            },
        ]);

        const { result } = renderHook(() => useTaskDetailsLoad('task-1'));

        await waitFor(() => {
            expect(mockFetchSubtasks).toHaveBeenCalledWith('task-1');
        });

        await waitFor(() => {
            expect(result.current.pendingSubtasks.length).toBe(1);
        });

        expect(result.current.pendingSubtasks[0].name).toBe('Child');
        await waitFor(() => {
            expect(result.current.attachmentCount).toBe(2);
        });
    });
});
