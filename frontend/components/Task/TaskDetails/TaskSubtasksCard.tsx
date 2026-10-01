import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import { Task } from '../../../entities/Task';
import {
    fetchSubtasks,
    fetchTaskByUid,
    updateTask,
} from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';
import { useStore, StoreState } from '../../../store/useStore';
import { useTaskDetailsPageContext } from './TaskDetailsPageContext';

const EMPTY_SUBTASKS: Task[] = [];

type SubtaskWithTransientFlags = Task & {
    _isNew?: boolean;
    _isEdited?: boolean;
    _statusChanged?: boolean;
};

interface TaskSubtasksCardProps {
    task: Task;
}

const TaskSubtasksCard: React.FC<TaskSubtasksCardProps> = ({ task }) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const { markModified, bumpTimeline } = useTaskDetailsPageContext();
    const tasksStore = useStore((s: StoreState) => s.tasksStore);

    const subtasks = task.subtasks ?? EMPTY_SUBTASKS;
    const [pendingSubtasks, setPendingSubtasks] = useState<Task[]>(subtasks);
    const [hasLoadedSubtasks, setHasLoadedSubtasks] = useState(false);
    const lastKnownSubtaskCount = useRef(0);

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

                    const existingIndex = tasksStore.tasks.findIndex(
                        (t) => t.uid === task.uid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...tasksStore.tasks];
                        updatedTasks[existingIndex] = {
                            ...task,
                            subtasks: fetchedSubtasks,
                        };
                        tasksStore.setTasks(updatedTasks);
                    }
                } catch (error) {
                    console.error('Error loading subtasks:', error);
                    setHasLoadedSubtasks(true);
                }
            } else if (currentCount > 0) {
                lastKnownSubtaskCount.current = currentCount;
            }
        };

        loadSubtasks();
    }, [task.uid, task.subtasks, hasLoadedSubtasks, tasksStore, task]);

    useEffect(() => {
        setPendingSubtasks((prev) => {
            if (
                prev.length === subtasks.length &&
                prev.every((item, index) => item === subtasks[index])
            ) {
                return prev;
            }
            return subtasks;
        });
    }, [subtasks]);

    const handleSaveSubtasks = async (subtasksToSave: Task[]) => {
        if (!task.uid) {
            return;
        }

        const flagged = subtasksToSave as SubtaskWithTransientFlags[];

        const hasChanges =
            subtasksToSave.length !== subtasks.length ||
            flagged.some(
                (ps, i) =>
                    !subtasks[i] ||
                    ps.name !== subtasks[i].name ||
                    ps.status !== subtasks[i].status ||
                    ps._isNew ||
                    ps._isEdited ||
                    ps._statusChanged
            );

        if (!hasChanges) {
            return;
        }

        try {
            markModified();
            await updateTask(task.uid, { subtasks: subtasksToSave });

            const updatedTask = await fetchTaskByUid(task.uid);
            lastKnownSubtaskCount.current =
                updatedTask.subtasks?.length || 0;
            const existingIndex = tasksStore.tasks.findIndex(
                (t) => t.uid === task.uid
            );
            if (existingIndex >= 0) {
                const updatedTasks = [...tasksStore.tasks];
                updatedTasks[existingIndex] = updatedTask;
                tasksStore.setTasks(updatedTasks);
            }

            bumpTimeline();
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

export default TaskSubtasksCard;
