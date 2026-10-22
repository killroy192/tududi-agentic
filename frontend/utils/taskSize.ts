import { Task, TaskSize } from '../entities/Task';
import { updateTask } from './tasksService';

export const applySizeByUid = (
    tasks: Task[],
    uid: string,
    size: TaskSize | null
): Task[] =>
    tasks.map((task) => {
        const nextSubtasks = task.subtasks
            ? applySizeByUid(task.subtasks, uid, size)
            : task.subtasks;
        const subtasksChanged = Boolean(
            task.subtasks &&
                nextSubtasks &&
                (nextSubtasks.length !== task.subtasks.length ||
                    nextSubtasks.some(
                        (subtask, index) => subtask !== task.subtasks?.[index]
                    ))
        );

        if (task.uid === uid) {
            return subtasksChanged
                ? { ...task, size, subtasks: nextSubtasks }
                : { ...task, size };
        }

        if (subtasksChanged) {
            return { ...task, subtasks: nextSubtasks };
        }

        return task;
    });

export const saveTaskSize = async (
    uid: string,
    size: TaskSize | null
): Promise<TaskSize | null> => {
    const updated = await updateTask(uid, { size });
    return updated.size ?? null;
};
