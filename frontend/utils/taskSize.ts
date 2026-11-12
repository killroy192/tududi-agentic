import { Task, TaskSize } from '../entities/Task';

export interface TaskSizePatch {
    uid: string;
    size: TaskSize | null;
}

/**
 * Whether the viewer may open the size menu for this task.
 * Missing `access_level` falls back to editable; the server's 403 stays authoritative.
 */
export const isTaskSizeEditable = (task: Task): boolean => {
    if (task.is_virtual_occurrence) return false;
    return task.access_level !== 'ro';
};

/**
 * Returns a new list where every task (including nested subtasks) with the patch uid carries the new size.
 * Tasks that do not match keep their identity.
 */
export const applyTaskSizeUpdate = <T extends Task>(
    tasks: T[],
    patch: TaskSizePatch
): T[] =>
    tasks.map((task) => {
        const subtasks = task.subtasks
            ? applyTaskSizeUpdate(task.subtasks, patch)
            : task.subtasks;
        const isMatch = task.uid === patch.uid && !task.is_virtual_occurrence;
        if (!isMatch && subtasks === task.subtasks) return task;
        return {
            ...task,
            ...(isMatch ? { size: patch.size } : {}),
            subtasks,
        };
    });

/**
 * Drops `size` and viewer-scoped fields from a full-task PATCH body so a stale copy cannot overwrite a saved size.
 * Size is only written by the dedicated size control.
 */
export const omitTaskSize = <T extends Partial<Task>>(
    task: T
): Omit<T, 'size' | 'access_level'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { size, access_level, ...rest } = task;
    return rest;
};

/**
 * Merges a size patch into every list of a section map
 * (upcoming day groups, Today sections, and the same shape).
 * A list with no matching task keeps its identity. The map keeps its identity when nothing changes.
 */
export const applyTaskSizeUpdateToGroups = <T extends Task>(
    groups: Record<string, T[]>,
    patch: TaskSizePatch
): Record<string, T[]> => {
    let changed = false;
    const next: Record<string, T[]> = {};

    for (const key of Object.keys(groups)) {
        const list = groups[key];
        const updated = applyTaskSizeUpdate(list, patch);
        const unchanged =
            updated.length === list.length &&
            updated.every((task, index) => task === list[index]);
        next[key] = unchanged ? list : updated;
        if (!unchanged) changed = true;
    }

    return changed ? next : groups;
};

/**
 * True when the body is the dedicated size control's partial `{ size }` write.
 * Every other update drops `size` so a stale full-task copy cannot overwrite it.
 */
export const isDedicatedSizeWrite = (taskData: Partial<Task>): boolean =>
    Object.keys(taskData).length === 1 &&
    Object.prototype.hasOwnProperty.call(taskData, 'size');
