import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import TaskDueDateSection from '../TaskForm/TaskDueDateSection';
import { Task } from '../../../entities/Task';
import {
    parseDateString,
    formatDateByCountry,
    getUserTimezone,
    getTodayDateString,
} from '../../../utils/dateUtils';
import { getCountryFromTimezone } from '../../../utils/localeUtils';
import { updateTask, fetchTaskByUid } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';
import { StoreState } from '../../../store/useStore';
import { replaceTaskInStore } from './taskDetailsMutations';

interface TaskDueDateCardProps {
    task: Task;
    tasksStore: StoreState['tasksStore'];
    onTaskModified: () => void;
    onTimelineRefresh: () => void;
}

const TaskDueDateCard: React.FC<TaskDueDateCardProps> = ({
    task,
    tasksStore,
    onTaskModified,
    onTimelineRefresh,
}) => {
    const { t } = useTranslation();
    const { showErrorToast, showSuccessToast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editedDueDate, setEditedDueDate] = useState<string>(
        task.due_date || ''
    );

    useEffect(() => {
        setEditedDueDate(task.due_date || '');
    }, [task.due_date]);

    const handleStartEdit = () => {
        setEditedDueDate(task.due_date || '');
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!task.uid) {
            setIsEditing(false);
            setEditedDueDate(task.due_date || '');
            return;
        }

        if ((editedDueDate || '') === (task.due_date || '')) {
            setIsEditing(false);
            return;
        }

        if (task.defer_until && editedDueDate) {
            const deferDate = new Date(task.defer_until);
            const dueDate = new Date(editedDueDate);

            if (!isNaN(deferDate.getTime()) && !isNaN(dueDate.getTime())) {
                // Due dates are date-only; allow defer until any time on the same calendar day
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
            onTaskModified();
            await updateTask(task.uid, {
                due_date: editedDueDate || null,
            });

            const updatedTask = await fetchTaskByUid(task.uid);
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            showSuccessToast(
                t('task.dueDateUpdated', 'Due date updated successfully')
            );
            setIsEditing(false);

            onTimelineRefresh();
        } catch (error) {
            console.error('Error updating due date:', error);
            showErrorToast(
                t('task.dueDateUpdateError', 'Failed to update due date')
            );
            setEditedDueDate(task.due_date || '');
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedDueDate(task.due_date || '');
    };

    const getDueDateDisplay = (dueDate: string) => {
        const date = parseDateString(dueDate);
        if (!date) return null;

        // Format date based on user's timezone-derived country
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
            relativeText = t('task.inDays', 'in {{count}} days', {
                count: diffDays,
            });
        } else {
            relativeText = t('task.daysAgo', '{{count}} days ago', {
                count: Math.abs(diffDays),
            });
        }

        return { formattedDate, relativeText };
    };

    return (
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
                {isEditing ? (
                    <div className="space-y-3">
                        <TaskDueDateSection
                            value={editedDueDate}
                            onChange={setEditedDueDate}
                            placeholder={t(
                                'forms.task.dueDatePlaceholder',
                                'Select due date'
                            )}
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
                    <button
                        type="button"
                        onClick={handleStartEdit}
                        className="flex w-full items-center justify-between text-left"
                    >
                        {task.due_date ? (
                            (() => {
                                const display = getDueDateDisplay(
                                    task.due_date
                                );
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
    );
};

export default TaskDueDateCard;
