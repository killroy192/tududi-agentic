import { useEffect, useState } from 'react';
import { Task } from '../../../../entities/Task';
import { fetchTaskByUid } from '../../../../utils/tasksService';
import { StoreState } from '../../../../store/useStore';

/**
 * Fetches the task by uid into the tasks store if it isn't already present
 * (e.g. after a hard refresh landing directly on a task detail page).
 */
export function useTaskDetailsLoader(
    uid: string | undefined,
    task: Task | undefined,
    tasksStore: StoreState['tasksStore']
) {
    const [loading, setLoading] = useState(!task);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTaskData = async () => {
            if (!uid) {
                setError('No task uid provided');
                setLoading(false);
                return;
            }

            if (!task) {
                try {
                    setLoading(true);
                    const fetchedTask = await fetchTaskByUid(uid);
                    tasksStore.setTasks([...tasksStore.tasks, fetchedTask]);
                } catch (fetchError) {
                    setError('Task not found');
                    console.error('Error fetching task:', fetchError);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchTaskData();
    }, [uid, task, tasksStore]);

    return { loading, error };
}
