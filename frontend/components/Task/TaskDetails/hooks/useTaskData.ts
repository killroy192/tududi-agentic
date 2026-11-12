import { useEffect, useState } from 'react';
import { fetchTaskByUid } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';

/** Reads the task from the store, fetching and appending it when it isn't there yet. */
export const useTaskData = (uid: string | undefined) => {
    const tasksStore = useStore((state) => state.tasksStore);
    const task = useStore((state) =>
        state.tasksStore.tasks.find((t) => t.uid === uid)
    );
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

    return { task, loading, error };
};
