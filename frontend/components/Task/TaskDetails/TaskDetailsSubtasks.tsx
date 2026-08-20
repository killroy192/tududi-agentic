import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import { Task } from '../../../entities/Task';
import { fetchSubtasks, fetchTaskByUid, updateTask } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';
import { StoreState } from '../../../store/useStore';
import { replaceTaskInStore } from './taskDetailsMutations';

interface TaskDetailsSubtasksProps {
    task: Task;
    tasksStore: StoreState['tasksStore'];
    onTaskModified: () => void;
    onTimelineRefresh: () => void;
}

const TaskDetailsSubtasks: React.FC<TaskDetailsSubtasksProps> = ({
    task,
    tasksStore,
    onTaskModified,
    onTimelineRefresh,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const subtasks = task.subtasks || [];
    const [pendingSubtasks, setPendingSubtasks] = useState<Task[]>(subtasks);
    const [hasLoadedSubtasks, setHasLoadedSubtasks] = useState(false);
    const lastKnownSubtaskCount = useRef<number>(0);

    // Reset lazy-load bookkeeping whenever the viewed task changes.
    useEffect(() => {
        setHasLoadedSubtasks(false);
        lastKnownSubtaskCount.current = 0;
    }, [task.uid]);

    useEffect(() => {
        const loadSubtasks = async () => {
            if (!task.uid) {
                return;
            }

            const currentCount = task.subtasks?.length || 0;
            const subtasksDisappeared =
                lastKnownSubtaskCount.current > 0 && currentCount === 0;
            const needsInitialLoad = !hasLoadedSubtasks && currentCount === 0;

            if (needsInitialLoad || subtasksDisappeared) {
                try {
                    const fetchedSubtasks = await fetchSubtasks(task.uid);
                    setHasLoadedSubtasks(true);
                    lastKnownSubtaskCount.current = fetchedSubtasks.length;
                    replaceTaskInStore(tasksStore, task.uid, {
                        ...task,
                        subtasks: fetchedSubtasks,
                    });
                } catch (error) {
                    console.error('Error loading subtasks:', error);
                    setHasLoadedSubtasks(true);
                }
            } else if (currentCount > 0) {
                lastKnownSubtaskCount.current = currentCount;
            }
        };

        loadSubtasks();
        // task is intentionally omitted: only its uid/subtasks/length affect this effect,
        // and including it would cause loadSubtasks to run on every unrelated task update.
    }, [task.uid, task.subtasks, hasLoadedSubtasks]);

    useEffect(() => {
        setPendingSubtasks(subtasks);
    }, [subtasks]);

    const handleSaveSubtasks = async (subtasksToSave: Task[]) => {
        if (!task.uid) {
            return;
        }

        const hasChanges =
            subtasksToSave.length !== subtasks.length ||
            subtasksToSave.some(
                (ps, i) =>
                    !subtasks[i] ||
                    ps.name !== subtasks[i].name ||
                    ps.status !== subtasks[i].status ||
                    (ps as Task & { _isNew?: boolean })._isNew ||
                    (ps as Task & { _isEdited?: boolean })._isEdited ||
                    (ps as Task & { _statusChanged?: boolean })
                        ._statusChanged
            );

        if (!hasChanges) {
            return;
        }

        try {
            onTaskModified();
            await updateTask(task.uid, { subtasks: subtasksToSave });

            const updatedTask = await fetchTaskByUid(task.uid);
            lastKnownSubtaskCount.current = updatedTask.subtasks?.length || 0;
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            onTimelineRefresh();
        } catch (error) {
            console.error('Error updating subtasks:', error);
            showErrorToast(
                t('task.subtasksUpdateError', 'Failed to update subtasks')
            );
            setPendingSubtasks([...subtasks]);
        }
    };

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
            <TaskSubtasksSection
                parentTaskId={task.id!}
                subtasks={pendingSubtasks}
                onSubtasksChange={setPendingSubtasks}
                onSave={handleSaveSubtasks}
            />
        </div>
    );
};

export default TaskDetailsSubtasks;
