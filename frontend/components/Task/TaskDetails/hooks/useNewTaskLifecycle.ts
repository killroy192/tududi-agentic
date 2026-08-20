import { useEffect, useRef } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { Task } from '../../../../entities/Task';
import { deleteTask } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';

interface UseNewTaskLifecycleParams {
    uid: string | undefined;
    isNewTask: boolean;
    navigate: NavigateFunction;
    pathname: string;
}

/**
 * Owns the "new task" lifecycle concerns that previously lived directly in
 * TaskDetails.tsx: clearing the one-shot `isNew` nav state, and deleting the
 * task on unmount if the user navigated away without making any changes.
 */
export function useNewTaskLifecycle({
    uid,
    isNewTask,
    navigate,
    pathname,
}: UseNewTaskLifecycleParams) {
    const isNewTaskRef = useRef(isNewTask);
    const taskModifiedRef = useRef(false);

    // Clear navigation state so refresh/back doesn't re-trigger edit mode
    useEffect(() => {
        if (isNewTask) {
            navigate(pathname, { replace: true, state: {} });
        }
    }, [isNewTask, navigate, pathname]);

    // Clean up abandoned new tasks: if user navigates away without modifying anything, delete the task
    useEffect(() => {
        const taskUid = uid;
        return () => {
            if (isNewTaskRef.current && !taskModifiedRef.current && taskUid) {
                deleteTask(taskUid).catch((err) =>
                    console.error('Error cleaning up abandoned new task:', err)
                );
                const store = useStore.getState();
                store.tasksStore.setTasks(
                    store.tasksStore.tasks.filter(
                        (t: Task) => t.uid !== taskUid
                    )
                );
            }
        };
    }, [uid]);

    return { isNewTaskRef, taskModifiedRef };
}
