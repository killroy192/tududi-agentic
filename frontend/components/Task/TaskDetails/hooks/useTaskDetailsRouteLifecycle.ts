import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../../../entities/Task';
import { deleteTask } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';

export const shouldDeleteAbandonedNewTask = (
    isNewTask: boolean,
    wasModified: boolean
): boolean => isNewTask && !wasModified;

/**
 * Clears isNew navigation state and deletes abandoned new tasks on unmount.
 */
export const useTaskDetailsRouteLifecycle = (
    uid: string | undefined,
    isNewTask: boolean,
    pathname: string
) => {
    const navigate = useNavigate();
    const isNewTaskRef = useRef(isNewTask);
    const taskModifiedRef = useRef(false);

    isNewTaskRef.current = isNewTask;

    useEffect(() => {
        if (isNewTask) {
            navigate(pathname, { replace: true, state: {} });
        }
    }, [isNewTask, navigate, pathname]);

    useEffect(() => {
        const taskUid = uid;
        return () => {
            if (
                shouldDeleteAbandonedNewTask(
                    isNewTaskRef.current,
                    taskModifiedRef.current
                ) &&
                taskUid
            ) {
                deleteTask(taskUid).catch((err) =>
                    console.error('Error cleaning up abandoned new task:', err)
                );
                const store = useStore.getState();
                store.tasksStore.setTasks(
                    store.tasksStore.tasks.filter((t: Task) => t.uid !== taskUid)
                );
            }
        };
    }, [uid]);

    const markTaskModified = () => {
        taskModifiedRef.current = true;
    };

    return { taskModifiedRef, markTaskModified };
};
