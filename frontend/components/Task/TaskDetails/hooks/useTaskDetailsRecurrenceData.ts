import { useEffect, useState } from 'react';
import { Task, RecurrenceType } from '../../../../entities/Task';
import {
    fetchTaskByUid,
    fetchTaskNextIterations,
    TaskIteration,
} from '../../../../utils/tasksService';

export const useTaskDetailsRecurrenceData = (task: Task | undefined) => {
    const [nextIterations, setNextIterations] = useState<TaskIteration[]>([]);
    const [loadingIterations, setLoadingIterations] = useState(false);
    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [loadingParent, setLoadingParent] = useState(false);

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
            } else {
                setParentTask(null);
            }
        };

        loadParentTask();
    }, [task?.recurring_parent_uid]);

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
        task?.uid,
        task?.recurrence_type,
        task?.due_date,
        task?.recurring_parent_id,
        parentTask?.id,
        parentTask?.uid,
        parentTask?.recurrence_type,
    ]);

    return {
        nextIterations,
        setNextIterations,
        loadingIterations,
        setLoadingIterations,
        parentTask,
        loadingParent,
    };
};

export type RecurrenceFormState = {
    recurrence_type: RecurrenceType;
    recurrence_interval: number;
    recurrence_end_date: string;
    recurrence_weekday: number | null;
    recurrence_weekdays: number[];
    recurrence_month_day: number | null;
    recurrence_week_of_month: number | null;
    completion_based: boolean;
};

export const buildRecurrenceFormFromTask = (
    task: Task | undefined
): RecurrenceFormState => ({
    recurrence_type: task?.recurrence_type || 'none',
    recurrence_interval: task?.recurrence_interval || 1,
    recurrence_end_date: task?.recurrence_end_date || '',
    recurrence_weekday: task?.recurrence_weekday ?? null,
    recurrence_weekdays: task?.recurrence_weekdays || [],
    recurrence_month_day: task?.recurrence_month_day ?? null,
    recurrence_week_of_month: task?.recurrence_week_of_month ?? null,
    completion_based: task?.completion_based || false,
});
