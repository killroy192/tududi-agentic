import { Task } from '../../../entities/Task';
import { fetchTaskByUid } from '../../../utils/tasksService';
import { useStore } from '../../../store/useStore';

/** Refetch task and replace it in the store by index (title/content/project/due/defer/recurrence). */
export const refetchAndSetTask = async (uid: string): Promise<Task> => {
    const updatedTask = await fetchTaskByUid(uid);
    const { tasksStore } = useStore.getState();
    const existingIndex = tasksStore.tasks.findIndex((t) => t.uid === uid);
    if (existingIndex >= 0) {
        const updatedTasks = [...tasksStore.tasks];
        updatedTasks[existingIndex] = updatedTask;
        tasksStore.setTasks(updatedTasks);
    }
    return updatedTask;
};

/** Refetch task and replace, preserving subtasks when the response omits them (tags). */
export const refetchAndSetTaskPreservingSubtasks = async (
    uid: string,
    previousSubtasks: Task[] | undefined
): Promise<Task> => {
    const updatedTask = await fetchTaskByUid(uid);
    const { tasksStore } = useStore.getState();
    const existingIndex = tasksStore.tasks.findIndex((t) => t.uid === uid);
    if (existingIndex >= 0) {
        const updatedTasks = [...tasksStore.tasks];
        updatedTasks[existingIndex] = {
            ...updatedTask,
            subtasks: updatedTask.subtasks || previousSubtasks || [],
        };
        tasksStore.setTasks(updatedTasks);
    }
    return updatedTask;
};

/** Refetch task and update via updateTaskInStore (area/assignee/priority/size). */
export const refetchAndUpdateTaskInStore = async (
    uid: string
): Promise<Task> => {
    const updatedTask = await fetchTaskByUid(uid);
    useStore.getState().tasksStore.updateTaskInStore(updatedTask);
    return updatedTask;
};
