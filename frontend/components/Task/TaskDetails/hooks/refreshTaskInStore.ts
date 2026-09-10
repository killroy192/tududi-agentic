import { Task } from '../../../../entities/Task';
import { fetchTaskByUid } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';

export type RefreshTaskOptions = {
    /** When set, merge these fields onto the fetched task before writing to the store. */
    merge?: Partial<Task>;
};

/**
 * Fetches the latest task by uid and writes it into the Zustand tasks store.
 * Prefers updateTaskInStore; falls back to setTasks when the task is not yet present.
 */
export const refreshTaskInStore = async (
    uid: string,
    options?: RefreshTaskOptions
): Promise<Task> => {
    const updatedTask = await fetchTaskByUid(uid);
    const taskToStore: Task = options?.merge
        ? { ...updatedTask, ...options.merge }
        : updatedTask;

    const { tasksStore } = useStore.getState();
    const exists = tasksStore.tasks.some(
        (t) => t.uid === uid || (taskToStore.id != null && t.id === taskToStore.id)
    );

    if (exists) {
        tasksStore.updateTaskInStore(taskToStore);
    } else {
        tasksStore.setTasks([...tasksStore.tasks, taskToStore]);
    }

    return taskToStore;
};

export type ApplyTaskUpdateOptions = {
    markModified?: () => void;
    onSuccess?: (updatedTask: Task) => void;
    bumpTimeline?: () => void;
};

/**
 * Shared post-mutation ritual: mark modified → apply update → refresh store → optional callbacks.
 */
export const applyTaskUpdateAndRefresh = async (
    uid: string,
    updateFn: () => Promise<unknown>,
    options?: ApplyTaskUpdateOptions & RefreshTaskOptions
): Promise<Task> => {
    options?.markModified?.();
    await updateFn();
    const updatedTask = await refreshTaskInStore(uid, {
        merge: options?.merge,
    });
    options?.onSuccess?.(updatedTask);
    options?.bumpTimeline?.();
    return updatedTask;
};
