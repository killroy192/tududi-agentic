import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { Project } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { createProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    TaskContentCard,
    TaskProjectCard,
    TaskAreaCard,
    TaskDueDateCard,
    TaskDeferUntilCard,
    TaskDetailsSubtasks,
    TaskDetailsRecurrence,
    TaskDetailsTags,
    TaskDetailsPeople,
    TaskDetailsAttachments,
    TaskDetailsAI,
} from './TaskDetails/';
import { getTodayDateString } from '../../utils/dateUtils';
import {
    getAreaLink,
    getProjectLink,
    getTagLink,
} from './TaskDetails/taskDetailsLinks';
import { useClearNewTaskState } from './TaskDetails/hooks/useClearNewTaskState';
import { useAbandonedTaskCleanup } from './TaskDetails/hooks/useAbandonedTaskCleanup';
import { useTaskData } from './TaskDetails/hooks/useTaskData';
import { useLazyTaskMetadata } from './TaskDetails/hooks/useLazyTaskMetadata';
import { useDateDraft } from './TaskDetails/hooks/useDateDraft';
import { useTaskUpdate } from './TaskDetails/hooks/useTaskUpdate';
import { useTaskDetailsSubtasks } from './TaskDetails/hooks/useTaskDetailsSubtasks';
import { useTaskDetailsRecurrence } from './TaskDetails/hooks/useTaskDetailsRecurrence';
import { useTaskDetailsTags } from './TaskDetails/hooks/useTaskDetailsTags';
import { useTaskDetailsPeople } from './TaskDetails/hooks/useTaskDetailsPeople';
import { useTaskDetailsAttachments } from './TaskDetails/hooks/useTaskDetailsAttachments';
import { useTaskDetailsAI } from './TaskDetails/hooks/useTaskDetailsAI';
import { useTaskDetailsHeaderActions } from './TaskDetails/hooks/useTaskDetailsHeaderActions';

const getErrorMessage = (error: unknown): string | undefined =>
    (error as { message?: string } | null)?.message;

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const isNewTask = location.state?.isNew === true;
    const { showSuccessToast, showErrorToast } = useToast();

    useClearNewTaskState(isNewTask);
    const taskModifiedRef = useAbandonedTaskCleanup(uid, isNewTask);

    const projectsStore = useStore((state) => state.projectsStore);
    const areasStore = useStore((state) => state.areasStore);
    const { task, loading, error } = useTaskData(uid);

    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const bumpTimeline = () => setTimelineRefreshKey((prev) => prev + 1);
    const { updateAndRefresh, writeTask } = useTaskUpdate({
        uid,
        taskModifiedRef,
    });
    const ai = useTaskDetailsAI();
    const {
        isEditing: isEditingDueDate,
        setIsEditing: setIsEditingDueDate,
        draft: editedDueDate,
        setDraft: setEditedDueDate,
    } = useDateDraft(task?.due_date, { syncWithSource: true });
    const {
        isEditing: isEditingDeferUntil,
        setIsEditing: setIsEditingDeferUntil,
        draft: editedDeferUntil,
        setDraft: setEditedDeferUntil,
    } = useDateDraft(task?.defer_until, { syncWithSource: false });
    const [activePill, setActivePill] = useState('overview');

    useLazyTaskMetadata();

    const { attachmentCount, setAttachmentCount } = useTaskDetailsAttachments(
        task?.uid
    );
    const subtasksSection = useTaskDetailsSubtasks({
        uid,
        task,
        updateAndRefresh,
        writeTask,
        onMutated: bumpTimeline,
    });
    const recurrence = useTaskDetailsRecurrence({
        task,
        updateAndRefresh,
        onMutated: bumpTimeline,
    });
    const header = useTaskDetailsHeaderActions({
        uid,
        task,
        taskModifiedRef,
        updateAndRefresh,
        writeTask,
        refreshRecurringSetup: recurrence.refreshRecurringSetup,
        onMutated: bumpTimeline,
    });
    const { handleTagsUpdate } = useTaskDetailsTags({
        task,
        updateAndRefresh,
        onMutated: bumpTimeline,
    });
    const { handleAssignPerson } = useTaskDetailsPeople({
        task,
        updateAndRefresh,
    });

    const handleStartDueDateEdit = () => {
        setEditedDueDate(task?.due_date || '');
        setIsEditingDueDate(true);
    };

    const handleSaveDueDate = async () => {
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
            await updateAndRefresh(
                task.uid,
                { due_date: editedDueDate || null },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.dueDateUpdated', 'Due date updated successfully')
            );
            setIsEditingDueDate(false);

            bumpTimeline();
        } catch (error) {
            console.error('Error updating due date:', error);
            showErrorToast(
                t('task.dueDateUpdateError', 'Failed to update due date')
            );
            setEditedDueDate(task.due_date || '');
            setIsEditingDueDate(false);
        }
    };

    const handleCancelDueDateEdit = () => {
        setIsEditingDueDate(false);
        setEditedDueDate(task?.due_date || '');
    };

    const handleStartDeferUntilEdit = () => {
        setEditedDeferUntil(task?.defer_until || '');
        setIsEditingDeferUntil(true);
    };

    const handleSaveDeferUntil = async () => {
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
            await updateAndRefresh(
                task.uid,
                { defer_until: editedDeferUntil || null },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.deferUntilUpdated', 'Defer until successfully updated')
            );
            setIsEditingDeferUntil(false);
            bumpTimeline();
        } catch (error) {
            console.error('Error updating defer until:', error);
            showErrorToast(
                getErrorMessage(error) ||
                    t(
                        'task.deferUntilUpdateError',
                        'Failed to update defer until'
                    )
            );
            setEditedDeferUntil(task?.defer_until || '');
            setIsEditingDeferUntil(false);
        }
    };

    const handleCancelDeferUntilEdit = () => {
        setIsEditingDeferUntil(false);
        setEditedDeferUntil(task?.defer_until || '');
    };

    const handleProjectSelection = async (project: Project) => {
        if (!task?.uid) return;

        try {
            await updateAndRefresh(
                task.uid,
                { project_id: project.id },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.projectUpdated', 'Project updated successfully')
            );

            bumpTimeline();
        } catch (error) {
            console.error('Error updating project:', error);
            showErrorToast(
                t('task.projectUpdateError', 'Failed to update project')
            );
        }
    };

    const handleClearProject = async () => {
        if (!task?.uid) return;

        try {
            await updateAndRefresh(
                task.uid,
                { project_id: null },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.projectCleared', 'Project cleared successfully')
            );

            bumpTimeline();
        } catch (error) {
            console.error('Error clearing project:', error);
            showErrorToast(
                t('task.projectClearError', 'Failed to clear project')
            );
        }
    };

    /** Rethrows on failure so the card keeps the inline form open. */
    const handleContentUpdate = async (newContent: string) => {
        if (!task?.uid) {
            return;
        }

        const trimmedContent = newContent.trim();

        if (trimmedContent === (task.note || '').trim()) {
            return;
        }

        try {
            await updateAndRefresh(
                task.uid,
                { note: trimmedContent },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.contentUpdated', 'Task content updated successfully')
            );

            bumpTimeline();
        } catch (error) {
            console.error('Error updating task content:', error);
            showErrorToast(
                t('task.contentUpdateError', 'Failed to update task content')
            );
            throw error;
        }
    };

    /** Rethrows on failure so the card keeps the inline form open. */
    const handleProjectCreateInline = async (name: string) => {
        if (!task?.uid || !name.trim()) return;

        try {
            taskModifiedRef.current = true;
            const newProject = await createProject({ name });

            projectsStore.setProjects([...projectsStore.projects, newProject]);

            await updateAndRefresh(
                task.uid,
                { project_id: newProject.id },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('project.createdAndAssigned', 'Project created and assigned')
            );

            bumpTimeline();
        } catch (error) {
            console.error('Error creating project:', error);
            showErrorToast(
                t('project.createError', 'Failed to create project')
            );
            throw error;
        }
    };

    const handleAreaSelection = async (area: Area) => {
        if (!task?.uid) return;

        try {
            await updateAndRefresh(
                task.uid,
                { area_id: area.id },
                { write: 'mergeById' }
            );

            showSuccessToast(
                t('task.areaUpdated', 'Area updated successfully')
            );
            bumpTimeline();
        } catch (error) {
            console.error('Error updating area:', error);
            showErrorToast(t('task.areaUpdateError', 'Failed to update area'));
        }
    };

    const handleClearArea = async () => {
        if (!task?.uid) return;

        try {
            await updateAndRefresh(
                task.uid,
                { area_id: null },
                { write: 'mergeById' }
            );

            showSuccessToast(
                t('task.areaCleared', 'Area cleared successfully')
            );
            bumpTimeline();
        } catch (error) {
            console.error('Error clearing area:', error);
            showErrorToast(t('task.areaClearError', 'Failed to clear area'));
        }
    };

    if (loading) {
        return <LoadingScreen />;
    }

    if (error || !task) {
        return (
            <div className="flex justify-center px-4 lg:px-2">
                <div className="w-full max-w-5xl">
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                        <ExclamationTriangleIcon className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto mb-8" />
                        <h1 className="text-2xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                            {error || t('task.notFound', 'Task Not Found')}
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                            {t(
                                'task.notFoundDescription',
                                'The task you are looking for does not exist or has been deleted.'
                            )}
                        </p>
                        <button
                            onClick={() => navigate('/today')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
                        >
                            {t('common.goToToday', 'Go to Today')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 lg:px-6 pt-4">
            <div className="w-full">
                <TaskDetailsHeader
                    task={task}
                    onTitleUpdate={header.handleTitleUpdate}
                    onStatusUpdate={header.handleStatusUpdate}
                    onPriorityUpdate={header.handlePriorityUpdate}
                    onSizeSaved={header.handleSizeSaved}
                    onDelete={header.handleDeleteClick}
                    getProjectLink={getProjectLink}
                    getTagLink={getTagLink}
                    activePill={activePill}
                    onPillChange={setActivePill}
                    showOverdueIcon={header.isOverdue}
                    showPastDueBadge={header.isPastDue}
                    onOverdueIconClick={header.handleOverdueIconClick}
                    isOverdueAlertVisible={
                        header.isOverdue && header.isOverdueBubbleVisible
                    }
                    onDismissOverdueAlert={header.handleDismissOverdueAlert}
                    onQuickStatusToggle={header.handleCompletionToggle}
                    onAiInsightsClick={
                        ai.aiAssistantEnabled
                            ? ai.handleAiInsightsClick
                            : undefined
                    }
                    aiInsightsActive={ai.aiInsightsActive}
                    attachmentCount={attachmentCount}
                    autoEditTitle={isNewTask}
                />

                <TaskDetailsAI task={task} ai={ai} />

                <div className="mb-6 mt-6">
                    {activePill === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-3 space-y-8">
                                <TaskContentCard
                                    content={task.note || ''}
                                    onUpdate={handleContentUpdate}
                                />
                                <TaskDetailsSubtasks
                                    task={task}
                                    subtasks={subtasksSection}
                                />
                                <TaskDetailsRecurrence
                                    task={task}
                                    recurrence={recurrence}
                                />
                            </div>

                            <div className="space-y-6">
                                <TaskProjectCard
                                    task={task}
                                    projects={projectsStore.projects}
                                    onProjectSelect={handleProjectSelection}
                                    onProjectClear={handleClearProject}
                                    onProjectCreate={handleProjectCreateInline}
                                    getProjectLink={getProjectLink}
                                />

                                <TaskAreaCard
                                    task={task}
                                    areas={areasStore.areas}
                                    onAreaSelect={handleAreaSelection}
                                    onAreaClear={handleClearArea}
                                    getAreaLink={getAreaLink}
                                />

                                <TaskDetailsPeople
                                    task={task}
                                    onAssign={handleAssignPerson}
                                />

                                <TaskDetailsTags
                                    task={task}
                                    onUpdate={handleTagsUpdate}
                                />

                                <TaskDueDateCard
                                    task={task}
                                    isEditing={isEditingDueDate}
                                    editedDueDate={editedDueDate}
                                    onChangeDate={setEditedDueDate}
                                    onStartEdit={handleStartDueDateEdit}
                                    onSave={handleSaveDueDate}
                                    onCancel={handleCancelDueDateEdit}
                                />

                                <TaskDeferUntilCard
                                    task={task}
                                    isEditing={isEditingDeferUntil}
                                    editedDeferUntil={editedDeferUntil}
                                    onChangeDateTime={setEditedDeferUntil}
                                    onStartEdit={handleStartDeferUntilEdit}
                                    onSave={handleSaveDeferUntil}
                                    onCancel={handleCancelDeferUntilEdit}
                                />
                            </div>
                        </div>
                    )}

                    {activePill === 'attachments' && (
                        <TaskDetailsAttachments
                            taskUid={task.uid}
                            onCountChange={setAttachmentCount}
                        />
                    )}

                    {activePill === 'activity' && (
                        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                            <TaskTimeline
                                taskUid={task.uid}
                                refreshKey={timelineRefreshKey}
                            />
                        </div>
                    )}
                </div>

                {header.isDeleteDialogOpen && (
                    <ConfirmDialog
                        title={t('task.deleteConfirmTitle', 'Delete Task')}
                        message={t(
                            'task.deleteConfirmMessage',
                            'Are you sure you want to delete this task? This action cannot be undone.'
                        )}
                        onConfirm={header.handleDeleteConfirm}
                        onCancel={header.handleDeleteCancel}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
