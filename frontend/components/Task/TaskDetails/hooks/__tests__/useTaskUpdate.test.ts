import { act, renderHook } from '@testing-library/react';
import { Task } from '../../../../../entities/Task';
import { useStore } from '../../../../../store/useStore';
import { fetchTaskByUid, updateTask } from '../../../../../utils/tasksService';
import { replaceTaskAtIndex, useTaskUpdate } from '../useTaskUpdate';

jest.mock('../../../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
    fetchTaskByUid: jest.fn(),
}));

const mockedUpdateTask = updateTask as jest.Mock;
const mockedFetchTaskByUid = fetchTaskByUid as jest.Mock;

const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Task',
    status: 0,
    completed_at: null,
    ...overrides,
});

const initialState = useStore.getState();
let setTasks: jest.Mock;
let updateTaskInStore: jest.Mock;

const seed = (tasks: Task[]) => {
    useStore.setState(initialState, true);
    const { tasksStore } = useStore.getState();
    setTasks = jest.fn(tasksStore.setTasks);
    updateTaskInStore = jest.fn(tasksStore.updateTaskInStore);
    useStore.setState({
        tasksStore: { ...tasksStore, tasks, setTasks, updateTaskInStore },
    });
};

const renderUpdater = ({ uid }: { uid?: string } = { uid: 'task-1' }) => {
    const taskModifiedRef = { current: false };
    const { result } = renderHook(() =>
        useTaskUpdate({ uid, taskModifiedRef })
    );
    return { result, taskModifiedRef };
};

beforeEach(() => {
    mockedUpdateTask.mockReset().mockResolvedValue({});
    mockedFetchTaskByUid.mockReset();
    seed([makeTask({ id: 9, uid: 'other' }), makeTask()]);
});

describe('replaceTaskAtIndex', () => {
    it('replaces the matching task in a copy', () => {
        const tasks = [makeTask({ uid: 'a' }), makeTask({ uid: 'b' })];
        const replacement = makeTask({ uid: 'b', name: 'New' });

        const next = replaceTaskAtIndex(tasks, 'b', replacement);

        expect(next).toEqual([tasks[0], replacement]);
        expect(next).not.toBe(tasks);
    });

    it('returns null when nothing matches', () => {
        expect(replaceTaskAtIndex([makeTask()], 'missing', makeTask())).toBe(
            null
        );
    });
});

describe('useTaskUpdate', () => {
    it('marks the task modified before the first await', async () => {
        const { result, taskModifiedRef } = renderUpdater();
        mockedUpdateTask.mockImplementation(async () => {
            expect(taskModifiedRef.current).toBe(true);
            return {};
        });
        mockedFetchTaskByUid.mockResolvedValue(makeTask());

        await act(() =>
            result.current.updateAndRefresh(
                'task-1',
                { name: 'x' },
                {
                    write: 'replaceAtIndex',
                }
            )
        );

        expect(mockedUpdateTask).toHaveBeenCalledWith('task-1', {
            name: 'x',
        });
    });

    it('marks the task modified even when the update fails', async () => {
        const { result, taskModifiedRef } = renderUpdater();
        mockedUpdateTask.mockRejectedValue(new Error('nope'));

        await expect(
            result.current.updateAndRefresh(
                'task-1',
                {},
                {
                    write: 'replaceAtIndex',
                }
            )
        ).rejects.toThrow('nope');
        expect(taskModifiedRef.current).toBe(true);
    });

    it('replaces at index with the refetched task', async () => {
        const refreshed = makeTask({ name: 'Refreshed' });
        mockedFetchTaskByUid.mockResolvedValue(refreshed);
        const { result } = renderUpdater();

        let returned: Task | undefined;
        await act(async () => {
            returned = await result.current.updateAndRefresh(
                'task-1',
                {},
                { write: 'replaceAtIndex' }
            );
        });

        expect(returned).toBe(refreshed);
        expect(setTasks).toHaveBeenCalledTimes(1);
        expect(updateTaskInStore).not.toHaveBeenCalled();
        expect(useStore.getState().tasksStore.tasks[1]).toBe(refreshed);
    });

    it('merges by id with updateTaskInStore', async () => {
        const refreshed = makeTask({ name: 'Refreshed' });
        mockedFetchTaskByUid.mockResolvedValue(refreshed);
        const { result } = renderUpdater();

        await act(() =>
            result.current.updateAndRefresh(
                'task-1',
                {},
                {
                    write: 'mergeById',
                }
            )
        );

        expect(updateTaskInStore).toHaveBeenCalledWith(refreshed);
        expect(setTasks).not.toHaveBeenCalled();
    });

    it('keeps fallback subtasks when the refetched task has none', async () => {
        const subtasks = [makeTask({ id: 50, uid: 'sub' })];
        mockedFetchTaskByUid.mockResolvedValue(makeTask({ name: 'R' }));
        const { result } = renderUpdater();

        await act(() =>
            result.current.updateAndRefresh(
                'task-1',
                {},
                {
                    write: 'replaceAtIndex',
                    subtasksFallbackFrom: makeTask({ subtasks }),
                }
            )
        );

        expect(useStore.getState().tasksStore.tasks[1].subtasks).toBe(subtasks);
    });

    it('does nothing to the store when the task is not in it', async () => {
        seed([makeTask({ id: 9, uid: 'other' })]);
        mockedFetchTaskByUid.mockResolvedValue(makeTask());
        const { result } = renderUpdater();

        await act(() =>
            result.current.updateAndRefresh(
                'task-1',
                {},
                {
                    write: 'replaceAtIndex',
                }
            )
        );

        expect(setTasks).not.toHaveBeenCalled();
    });

    it('skips the refetch without a route uid unless told otherwise', async () => {
        const { result } = renderUpdater({});

        await act(() =>
            result.current.updateAndRefresh(
                'task-1',
                {},
                {
                    write: 'mergeById',
                }
            )
        );
        expect(mockedFetchTaskByUid).not.toHaveBeenCalled();

        mockedFetchTaskByUid.mockResolvedValue(makeTask());
        await act(() =>
            result.current.updateAndRefresh(
                'task-1',
                {},
                {
                    write: 'mergeById',
                    skipUidGuard: true,
                }
            )
        );
        expect(mockedFetchTaskByUid).toHaveBeenCalledWith(undefined);
    });

    it('writeTask replaces by an explicit uid', () => {
        const { result } = renderUpdater();
        const replacement = makeTask({ id: 9, uid: 'other', name: 'Other' });

        act(() => {
            result.current.writeTask(replacement, 'replaceAtIndex', 'other');
        });

        expect(useStore.getState().tasksStore.tasks[0]).toBe(replacement);
    });
});
