import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../../entities/Task';
import { fetchSubtasks } from '../../../../utils/tasksService';
import { useStore } from '../../../../store/useStore';
import { useToast } from '../../../Shared/ToastContext';
import { useTaskUpdate } from './useTaskUpdate';

/** A subtask as edited in the card, carrying the change flags `TaskSubtasksSection` sets. */
export type SubtaskDraft = Task & {
    _isNew?: boolean;
    _isEdited?: boolean;
    _statusChanged?: boolean;
};

// Stable fallback: a fresh [] per render would retrigger the pendingSubtasks sync forever
const NO_SUBTASKS: Task[] = [];

const hasSubtaskChanges = (drafts: SubtaskDraft[], saved: Task[]) =>
    drafts.length !== saved.length ||
    drafts.some(
        (draft, i) =>
            !saved[i] ||
            draft.name !== saved[i].name ||
            draft.status !== saved[i].status ||
            draft._isNew ||
            draft._isEdited ||
            draft._statusChanged
    );

interface UseTaskDetailsSubtasksParams {
    uid: string | undefined;
    task: Task | undefined;
    updateAndRefresh: ReturnType<typeof useTaskUpdate>['updateAndRefresh'];
    writeTask: ReturnType<typeof useTaskUpdate>['writeTask'];
    onMutated: () => void;
}

/**
 * Loads subtasks lazily and holds unsaved edits. Lives in the page so pending edits
 * survive the Overview tab unmounting.
 */
export const useTaskDetailsSubtasks = ({
    uid,
    task,
    updateAndRefresh,
    writeTask,
    onMutated,
}: UseTaskDetailsSubtasksParams) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const tasksStore = useStore((state) => state.tasksStore);
    const subtasks = task?.subtasks || NO_SUBTASKS;
    const [pendingSubtasks, setPendingSubtasks] = useState<Task[]>([]);
    const [hasLoadedSubtasks, setHasLoadedSubtasks] = useState(false);
    const lastKnownSubtaskCount = useRef<number>(0);

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
                    writeTask(
                        { ...task, subtasks: fetchedSubtasks },
                        'replaceAtIndex',
                        task.uid
                    );
                } catch (error) {
                    console.error('Error loading subtasks:', error);
                    setHasLoadedSubtasks(true);
                }
            } else if (currentCount > 0) {
                lastKnownSubtaskCount.current = currentCount;
            }
        };

        loadSubtasks();
    }, [task?.uid, task?.subtasks, hasLoadedSubtasks, tasksStore]);

    useEffect(() => {
        setPendingSubtasks(subtasks);
    }, [subtasks]);

    const handleSaveSubtasks = async (subtasksToSave: SubtaskDraft[]) => {
        if (!task?.uid) {
            return;
        }

        if (!hasSubtaskChanges(subtasksToSave, subtasks)) {
            return;
        }

        try {
            const refreshedTask = await updateAndRefresh(
                task.uid,
                { subtasks: subtasksToSave },
                { write: 'replaceAtIndex' }
            );
            if (refreshedTask) {
                lastKnownSubtaskCount.current =
                    refreshedTask.subtasks?.length || 0;
            }

            onMutated();
        } catch (error) {
            console.error('Error updating subtasks:', error);
            showErrorToast(
                t('task.subtasksUpdateError', 'Failed to update subtasks')
            );
            setPendingSubtasks([...subtasks]);
        }
    };

    return {
        pendingSubtasks,
        setPendingSubtasks,
        handleSaveSubtasks,
    };
};

export type TaskDetailsSubtasksState = ReturnType<
    typeof useTaskDetailsSubtasks
>;
