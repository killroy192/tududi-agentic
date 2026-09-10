import { useEffect, useRef, useState } from 'react';
import { Task } from '../../../../entities/Task';
import {
    fetchTaskByUid,
    fetchSubtasks,
} from '../../../../utils/tasksService';
import { fetchAttachments } from '../../../../utils/attachmentsService';
import { useStore } from '../../../../store/useStore';

export const useTaskDetailsLoad = (uid: string | undefined) => {
    const tasksStore = useStore((state) => state.tasksStore);
    const task = useStore((state) =>
        state.tasksStore.tasks.find((t: Task) => t.uid === uid)
    );

    // Keep a stable reference when missing — `|| []` in a render path would
    // create a new array every render and infinite-loop the pending sync effect.
    const subtasks = task?.subtasks;

    const [loading, setLoading] = useState(!task);
    const [error, setError] = useState<string | null>(null);
    const [attachmentCount, setAttachmentCount] = useState(0);
    const [hasLoadedSubtasks, setHasLoadedSubtasks] = useState(false);
    const [pendingSubtasks, setPendingSubtasks] = useState<Task[]>([]);
    const lastKnownSubtaskCount = useRef<number>(0);

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
                    const currentTasks = useStore.getState().tasksStore.tasks;
                    useStore.getState().tasksStore.setTasks([
                        ...currentTasks,
                        fetchedTask,
                    ]);
                } catch (fetchError) {
                    setError('Task not found');
                    console.error('Error fetching task:', fetchError);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchTaskData();
    }, [uid, task]);

    useEffect(() => {
        const loadAttachmentCount = async () => {
            if (task?.uid) {
                try {
                    const attachments = await fetchAttachments(task.uid);
                    setAttachmentCount(attachments.length);
                } catch (loadError) {
                    console.error('Error loading attachment count:', loadError);
                }
            }
        };

        loadAttachmentCount();
    }, [task?.uid]);

    useEffect(() => {
        setHasLoadedSubtasks(false);
        lastKnownSubtaskCount.current = 0;
    }, [uid]);

    useEffect(() => {
        const loadSubtasks = async () => {
            if (!task?.uid) {
                return;
            }

            const currentCount = task?.subtasks?.length || 0;
            const subtasksDisappeared =
                lastKnownSubtaskCount.current > 0 && currentCount === 0;
            const needsInitialLoad = !hasLoadedSubtasks && currentCount === 0;

            if (needsInitialLoad || subtasksDisappeared) {
                try {
                    const fetchedSubtasks = await fetchSubtasks(task.uid);
                    setHasLoadedSubtasks(true);
                    lastKnownSubtaskCount.current = fetchedSubtasks.length;

                    const store = useStore.getState().tasksStore;
                    const existingIndex = store.tasks.findIndex(
                        (t: Task) => t.uid === task.uid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...store.tasks];
                        updatedTasks[existingIndex] = {
                            ...task,
                            subtasks: fetchedSubtasks,
                        };
                        store.setTasks(updatedTasks);
                    }
                } catch (loadError) {
                    console.error('Error loading subtasks:', loadError);
                    setHasLoadedSubtasks(true);
                }
            } else if (currentCount > 0) {
                lastKnownSubtaskCount.current = currentCount;
            }
        };

        loadSubtasks();
    }, [task?.uid, task?.subtasks, hasLoadedSubtasks, task]);

    useEffect(() => {
        setPendingSubtasks(subtasks || []);
    }, [subtasks]);

    return {
        task,
        tasksStore,
        subtasks: subtasks || [],
        loading,
        error,
        attachmentCount,
        setAttachmentCount,
        hasLoadedSubtasks,
        setHasLoadedSubtasks,
        pendingSubtasks,
        setPendingSubtasks,
        lastKnownSubtaskCount,
    };
};
