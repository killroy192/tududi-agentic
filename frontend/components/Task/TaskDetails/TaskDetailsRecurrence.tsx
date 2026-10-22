import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import RecurrenceDisplay from '../RecurrenceDisplay';
import TaskRecurrenceSection from '../TaskForm/TaskRecurrenceSection';
import TaskDueDateSection from '../TaskForm/TaskDueDateSection';
import TaskDeferUntilSection from '../TaskForm/TaskDeferUntilSection';
import { Task, RecurrenceType } from '../../../entities/Task';
import {
    TaskIteration,
    updateTask,
    fetchTaskByUid,
    fetchTaskNextIterations,
} from '../../../utils/tasksService';
import {
    getTodayDateString,
    parseDateString,
    formatDateByCountry,
    formatDateTimeByCountry,
    getUserTimezone,
} from '../../../utils/dateUtils';
import { resolveUserLocale, getCountryFromTimezone } from '../../../utils/localeUtils';
import { useStore } from '../../../store/useStore';
import { useToast } from '../../Shared/ToastContext';

/* ------------------------------------------------------------------ */
/*  useTaskDetailsRecurrence hook                                     */
/* ------------------------------------------------------------------ */

interface RecurrenceArgs {
    task: Task | undefined;
    uid: string | undefined;
    markModified: () => void;
    bumpTimeline: () => void;
}

export const useTaskDetailsRecurrence = ({
    task,
    uid,
    markModified,
    bumpTimeline,
}: RecurrenceArgs) => {
    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    // Recurrence form drafts
    const [isEditingRecurrence, setIsEditingRecurrence] = useState(false);
    const [recurrenceForm, setRecurrenceForm] = useState({
        recurrence_type: (task?.recurrence_type || 'none') as RecurrenceType,
        recurrence_interval: task?.recurrence_interval || 1,
        recurrence_end_date: task?.recurrence_end_date || '',
        recurrence_weekday: task?.recurrence_weekday ?? null,
        recurrence_weekdays: task?.recurrence_weekdays || [],
        recurrence_month_day: task?.recurrence_month_day ?? null,
        recurrence_week_of_month: task?.recurrence_week_of_month ?? null,
        completion_based: task?.completion_based || false,
    });

    // Due date drafts
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);
    const [editedDueDate, setEditedDueDate] = useState<string>(task?.due_date || '');

    // Defer until drafts
    const [isEditingDeferUntil, setIsEditingDeferUntil] = useState(false);
    const [editedDeferUntil, setEditedDeferUntil] = useState<string>(task?.defer_until || '');

    // Parent + iterations
    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [loadingParent, setLoadingParent] = useState(false);
    const [nextIterations, setNextIterations] = useState<TaskIteration[]>([]);
    const [loadingIterations, setLoadingIterations] = useState(false);

    // Sync due date from store
    useEffect(() => {
        setEditedDueDate(task?.due_date || '');
    }, [task?.due_date]);

    // Sync recurrence form from store
    useEffect(() => {
        setRecurrenceForm({
            recurrence_type: (task?.recurrence_type || 'none') as RecurrenceType,
            recurrence_interval: task?.recurrence_interval || 1,
            recurrence_end_date: task?.recurrence_end_date || '',
            recurrence_weekday: task?.recurrence_weekday ?? null,
            recurrence_weekdays: task?.recurrence_weekdays || [],
            recurrence_month_day: task?.recurrence_month_day ?? null,
            recurrence_week_of_month: task?.recurrence_week_of_month ?? null,
            completion_based: task?.completion_based || false,
        });
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

    // Load parent task
    useEffect(() => {
        const loadParentTask = async () => {
            if (task?.recurring_parent_uid) {
                try {
                    setLoadingParent(true);
                    const parent = await fetchTaskByUid(task.recurring_parent_uid);
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

    // Load iterations
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
                    const iterations = await fetchTaskNextIterations(parentTask.uid);
                    setNextIterations(iterations);
                } catch (error) {
                    console.error('Error loading next iterations for child task:', error);
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
                    const iterations = await fetchTaskNextIterations(latestTask.uid!);
                    setNextIterations(iterations);
                } else if (canUseParentIterations && parentTask?.uid) {
                    const iterations = await fetchTaskNextIterations(parentTask.uid);
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

    /* -- Recurrence handlers -- */

    const handleStartRecurrenceEdit = useCallback(() => {
        setRecurrenceForm({
            recurrence_type: (task?.recurrence_type || 'none') as RecurrenceType,
            recurrence_interval: task?.recurrence_interval || 1,
            recurrence_end_date: task?.recurrence_end_date || '',
            recurrence_weekday: task?.recurrence_weekday ?? null,
            recurrence_weekdays: task?.recurrence_weekdays || [],
            recurrence_month_day: task?.recurrence_month_day ?? null,
            recurrence_week_of_month: task?.recurrence_week_of_month ?? null,
            completion_based: task?.completion_based || false,
        });
        setIsEditingRecurrence(true);
    }, [task]);

    const handleRecurrenceChange = useCallback((field: string, value: unknown) => {
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
    }, []);

    const handleSaveRecurrence = useCallback(async () => {
        if (!task?.uid) {
            setIsEditingRecurrence(false);
            return;
        }

        try {
            markModified();
            const recurrencePayload: Partial<Task> = {
                recurrence_type: recurrenceForm.recurrence_type,
                recurrence_interval: recurrenceForm.recurrence_interval || 1,
                recurrence_end_date: recurrenceForm.recurrence_end_date || null,
                recurrence_weekday:
                    recurrenceForm.recurrence_type === 'weekly' ||
                    recurrenceForm.recurrence_type === 'monthly_weekday'
                        ? recurrenceForm.recurrence_weekday ?? null
                        : null,
                recurrence_weekdays:
                    recurrenceForm.recurrence_type === 'weekly'
                        ? recurrenceForm.recurrence_weekdays || []
                        : null,
                recurrence_month_day:
                    recurrenceForm.recurrence_type === 'monthly'
                        ? recurrenceForm.recurrence_month_day ?? null
                        : null,
                recurrence_week_of_month:
                    recurrenceForm.recurrence_type === 'monthly_weekday'
                        ? recurrenceForm.recurrence_week_of_month ?? null
                        : null,
                completion_based: recurrenceForm.completion_based,
            };

            await updateTask(task.uid, recurrencePayload);

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const store = useStore.getState();
                const existingIndex = store.tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...store.tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    store.tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(t('task.recurrenceUpdated', 'Recurrence updated successfully'));
            setIsEditingRecurrence(false);
            bumpTimeline();
        } catch (error) {
            console.error('Error updating recurrence:', error);
            showErrorToast(t('task.recurrenceUpdateError', 'Failed to update recurrence'));
            setIsEditingRecurrence(false);
        }
    }, [task?.uid, uid, recurrenceForm, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]);

    const handleCancelRecurrenceEdit = useCallback(() => {
        setIsEditingRecurrence(false);
        setRecurrenceForm({
            recurrence_type: (task?.recurrence_type || 'none') as RecurrenceType,
            recurrence_interval: task?.recurrence_interval || 1,
            recurrence_end_date: task?.recurrence_end_date || '',
            recurrence_weekday: task?.recurrence_weekday ?? null,
            recurrence_weekdays: task?.recurrence_weekdays || [],
            recurrence_month_day: task?.recurrence_month_day ?? null,
            recurrence_week_of_month: task?.recurrence_week_of_month ?? null,
            completion_based: task?.completion_based || false,
        });
    }, [task]);

    /* -- Due date handlers -- */

    const handleStartDueDateEdit = useCallback(() => {
        setEditedDueDate(task?.due_date || '');
        setIsEditingDueDate(true);
    }, [task?.due_date]);

    const handleSaveDueDate = useCallback(async () => {
        if (!task?.uid) {
            setIsEditingDueDate(false);
            setEditedDueDate(task?.due_date || '');
            return;
        }

        if ((editedDueDate || '') === (task.due_date || '')) {
            setIsEditingDueDate(false);
            return;
        }

        if (task.defer_until && editedDueDate) {
            const deferDate = new Date(task.defer_until);
            const dueDate = new Date(editedDueDate);

            if (!isNaN(deferDate.getTime()) && !isNaN(dueDate.getTime())) {
                const dueDateEndOfDay = new Date(dueDate);
                dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
                if (deferDate > dueDateEndOfDay) {
                    showErrorToast(
                        t(
                            'task.dueDateBeforeDeferError',
                            'Due date cannot be before the defer until date'
                        )
                    );
                    return;
                }
            }
        }

        if (editedDueDate) {
            const todayStr = getTodayDateString();
            const dueDateStr = editedDueDate.split('T')[0];

            if (dueDateStr < todayStr) {
                showErrorToast(
                    t(
                        'task.dueDateInPastWarning',
                        'Warning: You are setting a due date in the past'
                    )
                );
            }
        }

        try {
            markModified();
            await updateTask(task.uid, { due_date: editedDueDate || null });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const store = useStore.getState();
                const existingIndex = store.tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...store.tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    store.tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(t('task.dueDateUpdated', 'Due date updated successfully'));
            setIsEditingDueDate(false);
            bumpTimeline();
        } catch (error) {
            console.error('Error updating due date:', error);
            showErrorToast(t('task.dueDateUpdateError', 'Failed to update due date'));
            setEditedDueDate(task.due_date || '');
            setIsEditingDueDate(false);
        }
    }, [task?.uid, task?.due_date, task?.defer_until, editedDueDate, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]);

    const handleCancelDueDateEdit = useCallback(() => {
        setIsEditingDueDate(false);
        setEditedDueDate(task?.due_date || '');
    }, [task?.due_date]);

    /* -- Defer until handlers -- */

    const handleStartDeferUntilEdit = useCallback(() => {
        setEditedDeferUntil(task?.defer_until || '');
        setIsEditingDeferUntil(true);
    }, [task?.defer_until]);

    const handleSaveDeferUntil = useCallback(async () => {
        if (!task?.uid) {
            setIsEditingDeferUntil(false);
            setEditedDeferUntil(task?.defer_until || '');
            return;
        }

        if ((editedDeferUntil || '') === (task.defer_until || '')) {
            setIsEditingDeferUntil(false);
            return;
        }

        if (editedDeferUntil && task.due_date) {
            const deferDate = new Date(editedDeferUntil);
            const dueDate = new Date(task.due_date);

            if (!isNaN(deferDate.getTime()) && !isNaN(dueDate.getTime())) {
                if (!task.recurring_parent_id) {
                    const dueDateEndOfDay = new Date(dueDate);
                    dueDateEndOfDay.setUTCHours(23, 59, 59, 999);
                    if (deferDate > dueDateEndOfDay) {
                        showErrorToast(
                            t(
                                'task.deferAfterDueError',
                                'Defer until date cannot be after the due date'
                            )
                        );
                        return;
                    }
                }
            }
        }

        try {
            markModified();
            await updateTask(task.uid, { defer_until: editedDeferUntil || null });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const store = useStore.getState();
                const existingIndex = store.tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...store.tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    store.tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(t('task.deferUntilUpdated', 'Defer until successfully updated'));
            setIsEditingDeferUntil(false);
            bumpTimeline();
        } catch (error: unknown) {
            console.error('Error updating defer until:', error);
            const err = error as { message?: string };
            showErrorToast(
                err?.message ||
                    t('task.deferUntilUpdateError', 'Failed to update defer until')
            );
            setEditedDeferUntil(task?.defer_until || '');
            setIsEditingDeferUntil(false);
        }
    }, [task?.uid, task?.defer_until, task?.due_date, task?.recurring_parent_id, editedDeferUntil, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]);

    const handleCancelDeferUntilEdit = useCallback(() => {
        setIsEditingDeferUntil(false);
        setEditedDeferUntil(task?.defer_until || '');
    }, [task?.defer_until]);

    return {
        // Recurrence
        isEditingRecurrence,
        recurrenceForm,
        handleStartRecurrenceEdit,
        handleRecurrenceChange,
        handleSaveRecurrence,
        handleCancelRecurrenceEdit,
        parentTask,
        loadingParent,
        nextIterations,
        loadingIterations,
        refreshRecurringSetup,
        // Due date
        isEditingDueDate,
        editedDueDate,
        setEditedDueDate,
        handleStartDueDateEdit,
        handleSaveDueDate,
        handleCancelDueDateEdit,
        // Defer until
        isEditingDeferUntil,
        editedDeferUntil,
        setEditedDeferUntil,
        handleStartDeferUntilEdit,
        handleSaveDeferUntil,
        handleCancelDeferUntilEdit,
    };
};

/* ------------------------------------------------------------------ */
/*  TaskRecurringInstanceInfo (local helper)                          */
/* ------------------------------------------------------------------ */

interface TaskRecurringInstanceInfoProps {
    task: Task;
    parentTask: Task | null;
    loadingParent: boolean;
}

const TaskRecurringInstanceInfo: React.FC<TaskRecurringInstanceInfoProps> = ({
    task,
    parentTask,
    loadingParent,
}) => {
    const { t } = useTranslation();

    if (!task.recurring_parent_id) {
        return null;
    }

    return (
        <div className="mb-6 p-4 rounded-lg shadow-sm bg-purple-50 dark:bg-purple-900/20">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t(
                        'task.instanceOf',
                        'This is an instance of a recurring task'
                    )}
                </p>
                {loadingParent && (
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('common.loading', 'Loading parent task...')}
                        </span>
                    </div>
                )}
                {parentTask && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>{t('task.parentTask', 'Parent Task')}:</strong>{' '}
                        <Link
                            to={`/task/${parentTask.uid}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
                        >
                            {parentTask.name}
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsRecurrenceSection                                      */
/* ------------------------------------------------------------------ */

interface TaskDetailsRecurrenceSectionProps {
    task: Task;
    parentTask: Task | null;
    loadingParent: boolean;
    isEditing: boolean;
    recurrenceForm: {
        recurrence_type: RecurrenceType;
        recurrence_interval: number;
        recurrence_end_date: string | null;
        recurrence_weekday: number | null;
        recurrence_weekdays: number[] | null;
        recurrence_month_day: number | null;
        recurrence_week_of_month: number | null;
        completion_based: boolean;
    };
    onStartEdit: () => void;
    onChange: (field: string, value: unknown) => void;
    onSave: () => void;
    onCancel: () => void;
    loadingIterations: boolean;
    nextIterations: TaskIteration[];
    canEdit: boolean;
}

export const TaskDetailsRecurrenceSection: React.FC<TaskDetailsRecurrenceSectionProps> = ({
    task,
    parentTask,
    loadingParent,
    isEditing,
    recurrenceForm,
    onStartEdit,
    onChange,
    onSave,
    onCancel,
    loadingIterations,
    nextIterations,
    canEdit,
}) => {
    const { t, i18n } = useTranslation();
    const displayLocale = useMemo(
        () => resolveUserLocale(i18n.language),
        [i18n.language]
    );

    const formatDateWithDayName = (dateString: string) => {
        const date = parseDateString(dateString);
        if (!date) {
            return {
                dayName: '',
                formattedDate: dateString,
                fullText: dateString,
                isToday: false,
            };
        }

        const today = getTodayDateString();
        const isToday = dateString === today;

        const dayName = date.toLocaleDateString(displayLocale, {
            weekday: 'long',
        });
        const formattedDate = date.toLocaleDateString(displayLocale, {
            day: 'numeric',
            month: 'long',
        });

        return {
            dayName,
            formattedDate,
            fullText: `${dayName}, ${formattedDate}`,
            isToday,
        };
    };

    const renderNextIterations = () => {
        if (loadingIterations) {
            return (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </span>
                </div>
            );
        }

        if (nextIterations.length === 0) {
            return (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                        'task.noUpcomingOccurrences',
                        'No upcoming occurrences.'
                    )}
                </div>
            );
        }

        return (
            <ul className="space-y-1 list-none">
                {nextIterations.map((iteration, index) => {
                    const dateInfo = formatDateWithDayName(iteration.date);
                    return (
                        <li
                            key={index}
                            className={`text-sm ${
                                dateInfo.isToday
                                    ? 'font-semibold text-blue-600 dark:text-blue-400'
                                    : 'text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            - {dateInfo.fullText}
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div>
            <div
                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 space-y-4 ${
                    canEdit && !isEditing ? 'cursor-pointer' : ''
                }`}
                onClick={canEdit && !isEditing ? onStartEdit : undefined}
                role={canEdit && !isEditing ? 'button' : undefined}
                tabIndex={canEdit && !isEditing ? 0 : -1}
                onKeyDown={(e) => {
                    if (canEdit && !isEditing && e.key === 'Enter') {
                        e.preventDefault();
                        onStartEdit();
                    }
                }}
            >
                <TaskRecurringInstanceInfo
                    task={task}
                    parentTask={parentTask}
                    loadingParent={loadingParent}
                />

                {isEditing && canEdit ? (
                    <div className="space-y-4">
                        <TaskRecurrenceSection
                            recurrenceType={recurrenceForm.recurrence_type}
                            recurrenceInterval={
                                recurrenceForm.recurrence_interval
                            }
                            recurrenceEndDate={
                                recurrenceForm.recurrence_end_date || undefined
                            }
                            recurrenceWeekday={
                                recurrenceForm.recurrence_weekday ?? undefined
                            }
                            recurrenceWeekdays={
                                recurrenceForm.recurrence_weekdays || []
                            }
                            recurrenceMonthDay={
                                recurrenceForm.recurrence_month_day ?? undefined
                            }
                            recurrenceWeekOfMonth={
                                recurrenceForm.recurrence_week_of_month ??
                                undefined
                            }
                            completionBased={recurrenceForm.completion_based}
                            onChange={onChange}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={onSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {(task.recurrence_type &&
                            task.recurrence_type !== 'none') ||
                        (parentTask?.recurrence_type &&
                            parentTask.recurrence_type !== 'none') ? (
                            <div className="mb-4">
                                <RecurrenceDisplay
                                    recurrenceType={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_type
                                            ? parentTask.recurrence_type
                                            : task.recurrence_type
                                    }
                                    recurrenceInterval={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_interval
                                            ? parentTask.recurrence_interval
                                            : task.recurrence_interval
                                    }
                                    recurrenceWeekdays={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_weekdays
                                            ? parentTask.recurrence_weekdays
                                            : task.recurrence_weekdays
                                    }
                                    recurrenceEndDate={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_end_date
                                            ? parentTask.recurrence_end_date
                                            : task.recurrence_end_date
                                    }
                                    recurrenceMonthDay={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_month_day
                                            ? parentTask.recurrence_month_day
                                            : task.recurrence_month_day
                                    }
                                    recurrenceWeekOfMonth={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_week_of_month
                                            ? parentTask.recurrence_week_of_month
                                            : task.recurrence_week_of_month
                                    }
                                    recurrenceWeekday={
                                        task.recurring_parent_id &&
                                        parentTask?.recurrence_weekday
                                            ? parentTask.recurrence_weekday
                                            : task.recurrence_weekday
                                    }
                                    completionBased={
                                        task.recurring_parent_id &&
                                        parentTask?.completion_based
                                            ? parentTask.completion_based
                                            : task.completion_based
                                    }
                                />
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                {t(
                                    'task.notRecurring',
                                    'Add recurrence details'
                                )}
                            </div>
                        )}

                        {((task.recurrence_type &&
                            task.recurrence_type !== 'none') ||
                            (task.recurring_parent_id &&
                                parentTask?.recurrence_type &&
                                parentTask.recurrence_type !== 'none')) && (
                            <div>
                                <div className="mb-3">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {task.recurring_parent_id
                                            ? t(
                                                  'task.nextOccurrencesAfterThis',
                                                  'Next Occurrences After This'
                                              )
                                            : t(
                                                  'task.nextOccurrences',
                                                  'Next Occurrences'
                                              )}
                                        {!loadingIterations &&
                                            nextIterations.length > 0 &&
                                            nextIterations.some(
                                                (iter) =>
                                                    formatDateWithDayName(
                                                        iter.date
                                                    ).isToday
                                            ) && (
                                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                                    (
                                                    {t(
                                                        'task.includingToday',
                                                        'including today'
                                                    )}
                                                    )
                                                </span>
                                            )}
                                    </span>
                                </div>
                                {renderNextIterations()}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsScheduleSection (due + defer)                          */
/* ------------------------------------------------------------------ */

interface TaskDetailsScheduleSectionProps {
    task: Task;
    isEditingDueDate: boolean;
    editedDueDate: string;
    onChangeDueDate: (value: string) => void;
    onStartDueDateEdit: () => void;
    onSaveDueDate: () => void;
    onCancelDueDateEdit: () => void;
    isEditingDeferUntil: boolean;
    editedDeferUntil: string;
    onChangeDeferUntil: (value: string) => void;
    onStartDeferUntilEdit: () => void;
    onSaveDeferUntil: () => void;
    onCancelDeferUntilEdit: () => void;
}

export const TaskDetailsScheduleSection: React.FC<TaskDetailsScheduleSectionProps> = ({
    task,
    isEditingDueDate,
    editedDueDate,
    onChangeDueDate,
    onStartDueDateEdit,
    onSaveDueDate,
    onCancelDueDateEdit,
    isEditingDeferUntil,
    editedDeferUntil,
    onChangeDeferUntil,
    onStartDeferUntilEdit,
    onSaveDeferUntil,
    onCancelDeferUntilEdit,
}) => {
    const { t } = useTranslation();

    const getDueDateDisplay = (dueDate: string) => {
        const date = parseDateString(dueDate);
        if (!date) return null;

        const timezone = getUserTimezone();
        const country = getCountryFromTimezone(timezone);
        const formattedDate = formatDateByCountry(date, country);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        const diffDays = Math.round(
            (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let relativeText = '';
        if (diffDays === 0) {
            relativeText = t('dateIndicators.today', 'today');
        } else if (diffDays === 1) {
            relativeText = t('dateIndicators.tomorrow', 'tomorrow');
        } else if (diffDays === -1) {
            relativeText = t('dateIndicators.yesterday', 'yesterday');
        } else if (diffDays > 0) {
            relativeText = t('task.inDays', 'in {{count}} days', { count: diffDays });
        } else {
            relativeText = t('task.daysAgo', '{{count}} days ago', { count: Math.abs(diffDays) });
        }

        return { formattedDate, relativeText };
    };

    const getDeferUntilDisplay = (deferUntil: string) => {
        const date = new Date(deferUntil);
        if (Number.isNaN(date.getTime())) return null;

        const timezone = getUserTimezone();
        const country = getCountryFromTimezone(timezone);

        const isDateOnly =
            date.getUTCHours() === 0 &&
            date.getUTCMinutes() === 0 &&
            date.getUTCSeconds() === 0 &&
            date.getUTCMilliseconds() === 0;

        let formattedDateTime: string;
        let relativeText = '';

        if (isDateOnly) {
            formattedDateTime = formatDateByCountry(date, country);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(date);
            target.setUTCHours(0, 0, 0, 0);
            const diffDays = Math.round(
                (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDays === 0) {
                relativeText = t('dateIndicators.today', 'today');
            } else if (diffDays === 1) {
                relativeText = t('dateIndicators.tomorrow', 'tomorrow');
            } else if (diffDays === -1) {
                relativeText = t('dateIndicators.yesterday', 'yesterday');
            } else if (diffDays > 0) {
                relativeText = t('task.inDays', 'in {{count}} days', { count: diffDays });
            } else {
                relativeText = t('task.daysAgo', '{{count}} days ago', { count: Math.abs(diffDays) });
            }
        } else {
            formattedDateTime = formatDateTimeByCountry(date, country);

            const now = new Date();
            const diffMs = date.getTime() - now.getTime();
            const diffMins = Math.round(diffMs / (1000 * 60));
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

            if (diffMins < 0) {
                if (diffDays < -1) {
                    relativeText = t('task.daysAgo', '{{count}} days ago', { count: Math.abs(diffDays) });
                } else if (diffHours < -1) {
                    relativeText = t('task.hoursAgo', '{{count}} hours ago', { count: Math.abs(diffHours) });
                } else {
                    relativeText = t('task.minutesAgo', '{{count}} minutes ago', { count: Math.abs(diffMins) });
                }
            } else if (diffMins < 60) {
                relativeText = t('task.inMinutes', 'in {{count}} minutes', { count: diffMins });
            } else if (diffHours < 24) {
                relativeText = t('task.inHours', 'in {{count}} hours', { count: diffHours });
            } else {
                relativeText = t('task.inDays', 'in {{count}} days', { count: diffDays });
            }
        }

        const isPast = date.getTime() < new Date().getTime();
        return { formattedDateTime, relativeText, isPast };
    };

    return (
        <>
            {/* Due Date */}
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('task.dueDate', 'Due Date')}
                </h4>
                <div
                    className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors ${
                        task.due_date &&
                        (() => {
                            const dueDate = parseDateString(task.due_date);
                            if (!dueDate) return false;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            dueDate.setHours(0, 0, 0, 0);
                            const isCompleted =
                                task.status === 'done' ||
                                task.status === 2 ||
                                task.status === 'archived' ||
                                task.status === 3 ||
                                task.completed_at;
                            return dueDate < today && !isCompleted;
                        })()
                            ? 'border-red-500 dark:border-red-400'
                            : ''
                    }`}
                >
                    {isEditingDueDate ? (
                        <div className="space-y-3">
                            <TaskDueDateSection
                                value={editedDueDate}
                                onChange={onChangeDueDate}
                                placeholder={t(
                                    'forms.task.dueDatePlaceholder',
                                    'Select due date'
                                )}
                            />
                            <div className="flex justify-end space-x-2">
                                <button
                                    onClick={onSaveDueDate}
                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                >
                                    {t('common.save', 'Save')}
                                </button>
                                <button
                                    onClick={onCancelDueDateEdit}
                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onStartDueDateEdit}
                            className="flex w-full items-center justify-between text-left"
                        >
                            {task.due_date ? (
                                (() => {
                                    const display = getDueDateDisplay(task.due_date);
                                    if (!display) return null;
                                    const dueDate = parseDateString(task.due_date);
                                    if (!dueDate) return null;
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    dueDate.setHours(0, 0, 0, 0);
                                    const isCompleted =
                                        task.status === 'done' ||
                                        task.status === 2 ||
                                        task.status === 'archived' ||
                                        task.status === 3 ||
                                        task.completed_at;
                                    const overdue = dueDate < today && !isCompleted;

                                    return (
                                        <div
                                            className={`flex items-center justify-between w-full ${
                                                overdue
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-gray-900 dark:text-gray-100'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                <CalendarIcon
                                                    className={`h-4 w-4 flex-shrink-0 ${
                                                        overdue
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                                />
                                                <span className="text-sm font-medium">
                                                    {display.formattedDate}
                                                </span>
                                                <span
                                                    className={`text-sm italic ${
                                                        overdue
                                                            ? 'text-red-500 dark:text-red-400 font-medium'
                                                            : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                                >
                                                    ({display.relativeText})
                                                </span>
                                            </div>
                                            {overdue && (
                                                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 ml-2" />
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    {t('task.noDueDate', 'No due date')}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Defer Until */}
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('task.deferUntil', 'Defer Until')}
                </h4>
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors">
                    {isEditingDeferUntil ? (
                        <div className="space-y-3">
                            <TaskDeferUntilSection
                                value={editedDeferUntil}
                                onChange={onChangeDeferUntil}
                                placeholder={t(
                                    'forms.task.deferUntilPlaceholder',
                                    'Select defer until date and time'
                                )}
                            />
                            <div className="flex justify-end space-x-2">
                                <button
                                    onClick={onSaveDeferUntil}
                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                >
                                    {t('common.save', 'Save')}
                                </button>
                                <button
                                    onClick={onCancelDeferUntilEdit}
                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onStartDeferUntilEdit}
                            className="flex w-full items-center justify-between text-left"
                        >
                            {task.defer_until ? (
                                (() => {
                                    const display = getDeferUntilDisplay(task.defer_until);
                                    if (!display) return null;

                                    return (
                                        <div className="flex items-center space-x-2 flex-1 min-w-0 text-gray-900 dark:text-gray-100">
                                            <ClockIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                                            <span className="text-sm font-medium">
                                                {display.formattedDateTime}
                                            </span>
                                            <span className="text-sm italic text-gray-500 dark:text-gray-400">
                                                ({display.relativeText})
                                            </span>
                                        </div>
                                    );
                                })()
                            ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    {t('task.noDeferUntil', 'No defer until')}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default TaskDetailsRecurrenceSection;
