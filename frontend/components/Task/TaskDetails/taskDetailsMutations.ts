import { Task } from '../../../entities/Task';
import { StoreState } from '../../../store/useStore';

/**
 * Replaces the task with the given uid in the tasks store, preserving the
 * behavior of the many near-identical findIndex + splice blocks that used
 * to be duplicated across TaskDetails.tsx mutation handlers.
 */
export function replaceTaskInStore(
    tasksStore: StoreState['tasksStore'],
    uid: string,
    updatedTask: Task
): void {
    const existingIndex = tasksStore.tasks.findIndex(
        (t: Task) => t.uid === uid
    );
    if (existingIndex >= 0) {
        const updatedTasks = [...tasksStore.tasks];
        updatedTasks[existingIndex] = updatedTask;
        tasksStore.setTasks(updatedTasks);
    }
}
