import { Task, TaskSize } from '../entities/Task';
import { updateTask } from './tasksService';

type SizeRecord = {
    uid?: string;
    size?: TaskSize;
    subtasks?: SizeRecord[];
};

const mergeSavedTaskSizeOnRecord = <T extends SizeRecord>(
    task: T,
    uid: string,
    size: TaskSize
): T => {
    const subtasks = task.subtasks
        ? task.subtasks.map((subtask) =>
              mergeSavedTaskSizeOnRecord(subtask, uid, size)
          )
        : task.subtasks;

    if (task.uid !== uid) {
        if (subtasks === task.subtasks) {
            return task;
        }
        return { ...task, subtasks };
    }

    return { ...task, size, subtasks };
};

export const mergeSavedTaskSize = <T extends SizeRecord>(
    tasks: T[],
    uid: string,
    size: TaskSize
): T[] => tasks.map((task) => mergeSavedTaskSizeOnRecord(task, uid, size));

export const mergeSavedTaskSizeInGroups = (
    grouped: Record<string, Task[]> | null,
    uid: string,
    size: TaskSize
): Record<string, Task[]> | null => {
    if (!grouped) {
        return grouped;
    }

    return Object.fromEntries(
        Object.entries(grouped).map(([key, tasks]) => [
            key,
            mergeSavedTaskSize(tasks, uid, size),
        ])
    );
};

export const omitTaskSize = <T extends { size?: TaskSize }>(
    task: T
): Omit<T, 'size'> => {
    const payload = { ...task };
    delete payload.size;
    return payload;
};

export const persistTaskSize = async (
    uid: string,
    size: TaskSize
): Promise<TaskSize> => {
    const updated = await updateTask(uid, { size }, { includeSize: true });
    return updated.size ?? null;
};

export const isTaskSizeOwner = (
    task: { user_uid?: string | null },
    currentUserUid?: string | null
): boolean => Boolean(currentUserUid && task.user_uid === currentUserUid);
