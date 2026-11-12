import { useEffect, useRef } from 'react';
import { deleteTask } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';

/**
 * Deletes a just-created task when the user leaves it (uid change or unmount) without modifying it.
 * Returns the "modified" flag: every mutation must set it to `true` before its first await.
 */
export const useAbandonedTaskCleanup = (
    uid: string | undefined,
    isNewTask: boolean
) => {
    const isNewTaskRef = useRef(isNewTask);
    const taskModifiedRef = useRef(false);

    useEffect(() => {
        const taskUid = uid;
        return () => {
            if (isNewTaskRef.current && !taskModifiedRef.current && taskUid) {
                deleteTask(taskUid).catch((err) =>
                    console.error('Error cleaning up abandoned new task:', err)
                );
                const store = useStore.getState();
                store.tasksStore.setTasks(
                    store.tasksStore.tasks.filter((t) => t.uid !== taskUid)
                );
            }
        };
    }, [uid]);

    return taskModifiedRef;
};
