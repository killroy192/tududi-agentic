import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import RecurrenceDisplay from '../RecurrenceDisplay';
import TaskRecurrenceSection from '../TaskForm/TaskRecurrenceSection';
import TaskRecurringInstanceInfo from './TaskRecurringInstanceInfo';
import { Task, RecurrenceType } from '../../../entities/Task';
import {
    fetchTaskByUid,
    fetchTaskNextIterations,
    TaskIteration,
    updateTask,
} from '../../../utils/tasksService';
import { getTodayDateString, parseDateString } from '../../../utils/dateUtils';
import { resolveUserLocale } from '../../../utils/localeUtils';
import { useToast } from '../../Shared/ToastContext';
import { StoreState } from '../../../store/useStore';
import { replaceTaskInStore } from './taskDetailsMutations';

interface RecurrenceFormState {
    recurrence_type: RecurrenceType;
    recurrence_interval: number;
    recurrence_end_date: string | null;
    recurrence_weekday: number | null;
    recurrence_weekdays: number[] | null;
    recurrence_month_day: number | null;
    recurrence_week_of_month: number | null;
    completion_based: boolean;
}

function buildRecurrenceForm(task: Task): RecurrenceFormState {
    return {
        recurrence_type: task.recurrence_type || 'none',
        recurrence_interval: task.recurrence_interval || 1,
        recurrence_end_date: task.recurrence_end_date || '',
        recurrence_weekday: task.recurrence_weekday ?? null,
        recurrence_weekdays: task.recurrence_weekdays || [],
        recurrence_month_day: task.recurrence_month_day ?? null,
        recurrence_week_of_month: task.recurrence_week_of_month ?? null,
        completion_based: task.completion_based || false,
    };
}

export interface TaskDetailsRecurrenceHandle {
    refreshAfterCompletionToggle: (latestTask?: Task | null) => Promise<void>;
}

interface TaskDetailsRecurrenceProps {
    task: Task;
    tasksStore: StoreState['tasksStore'];
    onTaskModified: () => void;
    onTimelineRefresh: () => void;
}

const TaskDetailsRecurrence = forwardRef<
    TaskDetailsRecurrenceHandle,
    TaskDetailsRecurrenceProps
>(({ task, tasksStore, onTaskModified, onTimelineRefresh }, ref) => {
    const { t, i18n } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const displayLocale = useMemo(
        () => resolveUserLocale(i18n.language),
        [i18n.language]
    );

    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [loadingParent, setLoadingParent] = useState(false);
    const [nextIterations, setNextIterations] = useState<TaskIteration[]>([]);
    const [loadingIterations, setLoadingIterations] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [recurrenceForm, setRecurrenceForm] = useState<RecurrenceFormState>(
        () => buildRecurrenceForm(task)
    );

    const canEdit = !task.recurring_parent_id;

    useEffect(() => {
        setRecurrenceForm(buildRecurrenceForm(task));
    }, [
        task.recurrence_type,
        task.recurrence_interval,
        task.recurrence_end_date,
        task.recurrence_weekday,
        task.recurrence_weekdays,
        task.recurrence_month_day,
        task.recurrence_week_of_month,
        task.completion_based,
    ]);

    useEffect(() => {
        const loadParentTask = async () => {
            if (task.recurring_parent_uid) {
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
    }, [task.recurring_parent_uid]);

    useEffect(() => {
        const loadNextIterations = async () => {
            if (
                task.id &&
                task.recurrence_type &&
                task.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);
                    const iterations = await fetchTaskNextIterations(
                        task.uid!
                    );
                    setNextIterations(iterations);
                } catch (error) {
                    console.error('Error loading next iterations:', error);
                    setNextIterations([]);
                } finally {
                    setLoadingIterations(false);
                }
            } else if (
                task.recurring_parent_id &&
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
        task.id,
        task.recurrence_type,
        task.due_date,
        task.recurring_parent_id,
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

    useImperativeHandle(ref, () => ({
        refreshAfterCompletionToggle: refreshRecurringSetup,
    }));

    const handleStartEdit = () => {
        setRecurrenceForm(buildRecurrenceForm(task));
        setIsEditing(true);
    };

    const handleChange = (field: string, value: unknown) => {
        setRecurrenceForm((prev) => {
            const updated = { ...prev, [field]: value } as RecurrenceFormState;

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
        if (!task.uid) {
            setIsEditing(false);
            return;
        }

        try {
            onTaskModified();
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

            const updatedTask = await fetchTaskByUid(task.uid);
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            showSuccessToast(
                t('task.recurrenceUpdated', 'Recurrence updated successfully')
            );
            setIsEditing(false);
            onTimelineRefresh();
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
        setRecurrenceForm(buildRecurrenceForm(task));
    };

    const formatDateWithDayName = (dateString: string) => {
        // Parse date string as local midnight to avoid timezone shifts
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
                onClick={canEdit && !isEditing ? handleStartEdit : undefined}
                role={canEdit && !isEditing ? 'button' : undefined}
                tabIndex={canEdit && !isEditing ? 0 : -1}
                onKeyDown={(e) => {
                    if (canEdit && !isEditing && e.key === 'Enter') {
                        e.preventDefault();
                        handleStartEdit();
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
                            onChange={handleChange}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={handleCancel}
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
});

TaskDetailsRecurrence.displayName = 'TaskDetailsRecurrence';

export default TaskDetailsRecurrence;
