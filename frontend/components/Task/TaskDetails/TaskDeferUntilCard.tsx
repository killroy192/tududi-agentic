import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import TaskDeferUntilSection from '../TaskForm/TaskDeferUntilSection';
import { Task } from '../../../entities/Task';
import {
    formatDateByCountry,
    formatDateTimeByCountry,
    getUserTimezone,
} from '../../../utils/dateUtils';
import { getCountryFromTimezone } from '../../../utils/localeUtils';
import { updateTask, fetchTaskByUid } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';
import { StoreState } from '../../../store/useStore';
import { replaceTaskInStore } from './taskDetailsMutations';

interface TaskDeferUntilCardProps {
    task: Task;
    tasksStore: StoreState['tasksStore'];
    onTaskModified: () => void;
    onTimelineRefresh: () => void;
}

const TaskDeferUntilCard: React.FC<TaskDeferUntilCardProps> = ({
    task,
    tasksStore,
    onTaskModified,
    onTimelineRefresh,
}) => {
    const { t } = useTranslation();
    const { showErrorToast, showSuccessToast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editedDeferUntil, setEditedDeferUntil] = useState<string>(
        task.defer_until || ''
    );

    const handleStartEdit = () => {
        setEditedDeferUntil(task.defer_until || '');
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!task.uid) {
            setIsEditing(false);
            setEditedDeferUntil(task.defer_until || '');
            return;
        }

        if ((editedDeferUntil || '') === (task.defer_until || '')) {
            setIsEditing(false);
            return;
        }

        if (editedDeferUntil && task.due_date) {
            const deferDate = new Date(editedDeferUntil);
            const dueDate = new Date(task.due_date);

            if (!isNaN(deferDate.getTime()) && !isNaN(dueDate.getTime())) {
                // For recurring instances, skip strict frontend validation
                // Backend will validate against parent's recurrence_end_date
                if (!task.recurring_parent_id) {
                    // Due dates are date-only; allow any time on the same calendar day
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
            onTaskModified();
            await updateTask(task.uid, {
                defer_until: editedDeferUntil || null,
            });

            const updatedTask = await fetchTaskByUid(task.uid);
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            showSuccessToast(
                t('task.deferUntilUpdated', 'Defer until successfully updated')
            );
            setIsEditing(false);
            onTimelineRefresh();
        } catch (error) {
            console.error('Error updating defer until:', error);
            showErrorToast(
                (error as { message?: string })?.message ||
                    t(
                        'task.deferUntilUpdateError',
                        'Failed to update defer until'
                    )
            );
            setEditedDeferUntil(task.defer_until || '');
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedDeferUntil(task.defer_until || '');
    };

    const getDeferUntilDisplay = (deferUntil: string) => {
        const date = new Date(deferUntil);
        if (Number.isNaN(date.getTime())) return null;

        const timezone = getUserTimezone();
        const country = getCountryFromTimezone(timezone);

        // A value stored as UTC midnight came from a CalDAV DATE-only field.
        // Display it without a time component to avoid spurious offset noise
        // (e.g. UTC+2 would otherwise show "02:00").
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
                relativeText = t('task.inDays', 'in {{count}} days', {
                    count: diffDays,
                });
            } else {
                relativeText = t('task.daysAgo', '{{count}} days ago', {
                    count: Math.abs(diffDays),
                });
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
                    relativeText = t('task.daysAgo', '{{count}} days ago', {
                        count: Math.abs(diffDays),
                    });
                } else if (diffHours < -1) {
                    relativeText = t('task.hoursAgo', '{{count}} hours ago', {
                        count: Math.abs(diffHours),
                    });
                } else {
                    relativeText = t(
                        'task.minutesAgo',
                        '{{count}} minutes ago',
                        { count: Math.abs(diffMins) }
                    );
                }
            } else if (diffMins < 60) {
                relativeText = t('task.inMinutes', 'in {{count}} minutes', {
                    count: diffMins,
                });
            } else if (diffHours < 24) {
                relativeText = t('task.inHours', 'in {{count}} hours', {
                    count: diffHours,
                });
            } else {
                relativeText = t('task.inDays', 'in {{count}} days', {
                    count: diffDays,
                });
            }
        }

        const isPast = date.getTime() < new Date().getTime();
        return { formattedDateTime, relativeText, isPast };
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.deferUntil', 'Defer Until')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors">
                {isEditing ? (
                    <div className="space-y-3">
                        <TaskDeferUntilSection
                            value={editedDeferUntil}
                            onChange={setEditedDeferUntil}
                            placeholder={t(
                                'forms.task.deferUntilPlaceholder',
                                'Select defer until date and time'
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
                        {task.defer_until ? (
                            (() => {
                                const display = getDeferUntilDisplay(
                                    task.defer_until
                                );
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
    );
};

export default TaskDeferUntilCard;
