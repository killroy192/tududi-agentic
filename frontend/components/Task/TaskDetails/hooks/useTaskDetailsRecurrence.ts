import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../../entities/Task';
import {
    fetchTaskByUid,
    fetchTaskNextIterations,
    TaskIteration,
} from '../../../../utils/tasksService';
import { useToast } from '../../../Shared/ToastContext';
import {
    RecurrenceForm,
    RecurrenceFormChangeHandler,
} from '../TaskRecurrenceCard';
import { useTaskUpdate } from './useTaskUpdate';

const toRecurrenceForm = (task: Task | undefined): RecurrenceForm => ({
    recurrence_type: task?.recurrence_type || 'none',
    recurrence_interval: task?.recurrence_interval || 1,
    recurrence_end_date: task?.recurrence_end_date || '',
    recurrence_weekday: task?.recurrence_weekday ?? null,
    recurrence_weekdays: task?.recurrence_weekdays || [],
    recurrence_month_day: task?.recurrence_month_day ?? null,
    recurrence_week_of_month: task?.recurrence_week_of_month ?? null,
    completion_based: task?.completion_based || false,
});

const toRecurrencePayload = (form: RecurrenceForm): Partial<Task> => ({
    recurrence_type: form.recurrence_type,
    recurrence_interval: form.recurrence_interval || 1,
    recurrence_end_date: form.recurrence_end_date || null,
    recurrence_weekday:
        form.recurrence_type === 'weekly' ||
        form.recurrence_type === 'monthly_weekday'
            ? (form.recurrence_weekday ?? null)
            : null,
    recurrence_weekdays:
        form.recurrence_type === 'weekly'
            ? form.recurrence_weekdays || []
            : null,
    recurrence_month_day:
        form.recurrence_type === 'monthly'
            ? (form.recurrence_month_day ?? null)
            : null,
    recurrence_week_of_month:
        form.recurrence_type === 'monthly_weekday'
            ? (form.recurrence_week_of_month ?? null)
            : null,
    completion_based: form.completion_based,
});

interface UseTaskDetailsRecurrenceParams {
    task: Task | undefined;
    updateAndRefresh: ReturnType<typeof useTaskUpdate>['updateAndRefresh'];
    onMutated: () => void;
}

/**
 * Recurrence editor state, parent task and upcoming iterations. Lives in the page so the
 * edit form survives the Overview tab unmounting.
 */
export const useTaskDetailsRecurrence = ({
    task,
    updateAndRefresh,
    onMutated,
}: UseTaskDetailsRecurrenceParams) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [nextIterations, setNextIterations] = useState<TaskIteration[]>([]);
    const [loadingIterations, setLoadingIterations] = useState(false);
    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [loadingParent, setLoadingParent] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [recurrenceForm, setRecurrenceForm] = useState<RecurrenceForm>(() =>
        toRecurrenceForm(task)
    );

    useEffect(() => {
        setRecurrenceForm(toRecurrenceForm(task));
    }, [
        task?.recurrence_type,
        task?.recurrence_interval,
        task?.recurrence_end_date,
        task?.recurrence_weekday,
        task?.recurrence_weekdays,
        task?.recurrence_month_day,
        task?.recurrence_week_of_month,
        task?.completion_based,
    ]);

    useEffect(() => {
        const loadNextIterations = async () => {
            if (
                task?.id &&
                task.recurrence_type &&
                task.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);
                    const iterations = await fetchTaskNextIterations(task.uid!);
                    setNextIterations(iterations);
                } catch (error) {
                    console.error('Error loading next iterations:', error);
                    setNextIterations([]);
                } finally {
                    setLoadingIterations(false);
                }
            } else if (
                task?.recurring_parent_id &&
                parentTask?.uid &&
                parentTask.recurrence_type &&
                parentTask.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);

                    const iterations = await fetchTaskNextIterations(
                        parentTask.uid
                    );

                    setNextIterations(iterations);
                } catch (error) {
                    console.error(
                        'Error loading next iterations for child task:',
                        error
                    );
                    setNextIterations([]);
                } finally {
                    setLoadingIterations(false);
                }
            } else {
                setNextIterations([]);
            }
        };

        loadNextIterations();
    }, [
        task?.id,
        task?.recurrence_type,
        task?.due_date,
        task?.recurring_parent_id,
        parentTask?.id,
        parentTask?.recurrence_type,
    ]);

    useEffect(() => {
        const loadParentTask = async () => {
            if (task?.recurring_parent_uid) {
                try {
                    setLoadingParent(true);
                    const parent = await fetchTaskByUid(
                        task.recurring_parent_uid
                    );
                    setParentTask(parent);
                } catch (error) {
                    console.error('Error fetching parent task:', error);
                    setParentTask(null);
                } finally {
                    setLoadingParent(false);
                }
            }
        };

        loadParentTask();
    }, [task?.recurring_parent_uid]);

    const handleStartEdit = () => {
        setRecurrenceForm(toRecurrenceForm(task));
        setIsEditing(true);
    };

    const handleChange: RecurrenceFormChangeHandler = (field, value) => {
        setRecurrenceForm((prev) => {
            const updated = { ...prev, [field]: value };

            if (
                field === 'recurrence_type' &&
                value === 'monthly' &&
                !prev.recurrence_month_day
            ) {
                updated.recurrence_month_day = new Date().getDate();
            }

            return updated;
        });
    };

    const handleSave = async () => {
        if (!task?.uid) {
            setIsEditing(false);
            return;
        }

        try {
            await updateAndRefresh(
                task.uid,
                toRecurrencePayload(recurrenceForm),
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.recurrenceUpdated', 'Recurrence updated successfully')
            );
            setIsEditing(false);
            onMutated();
        } catch (error) {
            console.error('Error updating recurrence:', error);
            showErrorToast(
                t('task.recurrenceUpdateError', 'Failed to update recurrence')
            );
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setRecurrenceForm(toRecurrenceForm(task));
    };

    /** Re-reads upcoming iterations after a change outside this section (e.g. completion toggle). */
    const refreshRecurringSetup = useCallback(
        async (latestTask?: Task | null) => {
            if (!latestTask) {
                setNextIterations([]);
                return;
            }

            const isTemplateTask =
                latestTask.recurrence_type &&
                latestTask.recurrence_type !== 'none' &&
                !latestTask.recurring_parent_id;
            const canUseParentIterations =
                !!latestTask.recurring_parent_id &&
                !!parentTask?.id &&
                parentTask?.recurrence_type &&
                parentTask.recurrence_type !== 'none';

            if (!isTemplateTask && !canUseParentIterations) {
                setNextIterations([]);
                return;
            }

            try {
                setLoadingIterations(true);
                if (isTemplateTask) {
                    const iterations = await fetchTaskNextIterations(
                        latestTask.uid!
                    );
                    setNextIterations(iterations);
                } else if (canUseParentIterations && parentTask?.uid) {
                    const iterations = await fetchTaskNextIterations(
                        parentTask.uid
                    );
                    setNextIterations(iterations);
                }
            } catch (error) {
                console.error('Error refreshing recurring setup:', error);
                setNextIterations([]);
            } finally {
                setLoadingIterations(false);
            }
        },
        [parentTask?.id, parentTask?.recurrence_type]
    );

    return {
        parentTask,
        loadingParent,
        isEditing,
        recurrenceForm,
        loadingIterations,
        nextIterations,
        handleStartEdit,
        handleChange,
        handleSave,
        handleCancel,
        refreshRecurringSetup,
    };
};

export type TaskDetailsRecurrenceState = ReturnType<
    typeof useTaskDetailsRecurrence
>;
