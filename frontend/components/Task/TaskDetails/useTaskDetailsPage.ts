import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Task } from '../../../entities/Task';
import { deleteTask, fetchTaskByUid } from '../../../utils/tasksService';
import { useStore, StoreState } from '../../../store/useStore';

export interface UseTaskDetailsPageResult {
    uid: string | undefined;
    task: Task | undefined;
    loading: boolean;
    error: string | null;
    isNewTask: boolean;
    markModified: () => void;
}

/**
 * Owns route load, new-task navigation cleanup, and abandoned-task deletion.
 * Effects live here so TaskDetails.tsx itself has no useEffect.
 */
export const useTaskDetailsPage = (): UseTaskDetailsPageResult => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const isNewTask = location.state?.isNew === true;
    const isNewTaskRef = useRef(isNewTask);
    const taskModifiedRef = useRef(false);

    const task = useStore((state: StoreState) =>
        state.tasksStore.tasks.find((t: Task) => t.uid === uid)
    );
    const [loading, setLoading] = useState(!task);
    const [error, setError] = useState<string | null>(null);

    const markModified = useCallback(() => {
        taskModifiedRef.current = true;
    }, []);

    // Clear navigation state so refresh/back doesn't re-trigger edit mode
    useEffect(() => {
        if (isNewTask) {
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [isNewTask, navigate, location.pathname]);

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
                    store.tasksStore.tasks.filter((t: Task) => t.uid !== taskUid)
                );
            }
        };
    }, [uid]);

    useEffect(() => {
        const fetchTaskData = async () => {
            if (!uid) {
                setError('No task uid provided');
                setLoading(false);
                return;
            }

            const existing = useStore
                .getState()
                .tasksStore.tasks.find((t: Task) => t.uid === uid);

            if (!existing) {
                try {
                    setLoading(true);
                    const fetchedTask = await fetchTaskByUid(uid);
                    const { tasksStore } = useStore.getState();
                    tasksStore.setTasks([...tasksStore.tasks, fetchedTask]);
                } catch (fetchError) {
                    setError('Task not found');
                    console.error('Error fetching task:', fetchError);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        fetchTaskData();
    }, [uid]);

    return {
        uid,
        task,
        loading,
        error,
        isNewTask,
        markModified,
    };
};
