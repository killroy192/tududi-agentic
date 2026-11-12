import { MutableRefObject } from 'react';
import { Task } from '../../../../entities/Task';
import { fetchTaskByUid, updateTask } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';

/**
 * How a refreshed task is written back to the store.
 * - `replaceAtIndex`: swap the task in the `tasks` array captured at render; no-op if absent.
 * - `mergeById`: `tasksStore.updateTaskInStore`, which merges by id and keeps existing subtasks.
 */
export type TaskStoreWrite = 'replaceAtIndex' | 'mergeById';

export interface TaskUpdateOptions {
    write: TaskStoreWrite;
    /** Keep this task's subtasks when the refetched task has none. */
    subtasksFallbackFrom?: Task;
    /** Refetch even when the route has no uid. */
    skipUidGuard?: boolean;
}

/** Returns a copy of `tasks` with the task matching `uid` replaced, or `null` if none matches. */
export const replaceTaskAtIndex = (
    tasks: Task[],
    uid: string,
    task: Task
): Task[] | null => {
    const index = tasks.findIndex((item) => item.uid === uid);
    if (index < 0) {
        return null;
    }
    const nextTasks = [...tasks];
    nextTasks[index] = task;
    return nextTasks;
};

interface UseTaskUpdateParams {
    uid: string | undefined;
    taskModifiedRef: MutableRefObject<boolean>;
}

/**
 * Shared "update the task, refetch it, write it to the store" sequence for the task details page.
 * Marks the task as modified before the first await so abandoned-task cleanup never deletes it.
 */
export const useTaskUpdate = ({
    uid,
    taskModifiedRef,
}: UseTaskUpdateParams) => {
    const tasksStore = useStore((state) => state.tasksStore);

    const writeTask = (
        task: Task,
        write: TaskStoreWrite,
        matchUid: string | undefined = uid
    ) => {
        if (write === 'mergeById') {
            tasksStore.updateTaskInStore(task);
            return;
        }
        if (!matchUid) {
            return;
        }
        const nextTasks = replaceTaskAtIndex(tasksStore.tasks, matchUid, task);
        if (nextTasks) {
            tasksStore.setTasks(nextTasks);
        }
    };

    /** Resolves with the refetched task, or `undefined` when there is no route uid. */
    const updateAndRefresh = async (
        taskUid: string,
        payload: Partial<Task>,
        { write, subtasksFallbackFrom, skipUidGuard }: TaskUpdateOptions
    ): Promise<Task | undefined> => {
        taskModifiedRef.current = true;
        await updateTask(taskUid, payload);

        if (!uid && !skipUidGuard) {
            return undefined;
        }

        const refreshedTask = await fetchTaskByUid(uid as string);
        const taskToStore = subtasksFallbackFrom
            ? {
                  ...refreshedTask,
                  subtasks:
                      refreshedTask.subtasks ||
                      subtasksFallbackFrom.subtasks ||
                      [],
              }
            : refreshedTask;
        writeTask(taskToStore, write);
        return refreshedTask;
    };

    return { updateAndRefresh, writeTask };
};
