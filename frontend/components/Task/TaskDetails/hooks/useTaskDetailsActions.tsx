import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Task, PriorityType } from '../../../../entities/Task';
import { Project } from '../../../../entities/Project';
import { Area } from '../../../../entities/Area';
import { Tag } from '../../../../entities/Tag';
import {
    updateTask,
    deleteTask,
    fetchSubtasks,
    fetchTaskNextIterations,
    toggleTaskCompletion,
} from '../../../../utils/tasksService';
import { createProject } from '../../../../utils/projectsService';
import { useStore } from '../../../../store/useStore';
import { useToast } from '../../../Shared/ToastContext';
import { getTodayDateString } from '../../../../utils/dateUtils';
import { buildDuplicateTaskPayload } from '../../../../utils/duplicateTask';
import { sizeToApiValue, SizeValue } from '../../../../constants/taskSize';
import { refreshTaskInStore } from './refreshTaskInStore';
import { RecurrenceFormState } from './useTaskDetailsRecurrenceData';

export type SubtaskWithEditFlags = Task & {
    _isNew?: boolean;
    _isEdited?: boolean;
    _statusChanged?: boolean;
};

type UseTaskDetailsActionsParams = {
    uid: string | undefined;
    task: Task | undefined;
    subtasks: Task[];
    hasLoadedSubtasks: boolean;
    setHasLoadedSubtasks: (value: boolean) => void;
    setPendingSubtasks: (subtasks: Task[]) => void;
    lastKnownSubtaskCount: React.MutableRefObject<number>;
    markTaskModified: () => void;
    recurrenceForm: RecurrenceFormState;
    setIsEditingRecurrence: (value: boolean) => void;
    editedDueDate: string;
    setIsEditingDueDate: (value: boolean) => void;
    setEditedDueDate: (value: string) => void;
    editedDeferUntil: string;
    setIsEditingDeferUntil: (value: boolean) => void;
    setEditedDeferUntil: (value: string) => void;
    parentTask: Task | null;
    setNextIterations: (iterations: Awaited<
        ReturnType<typeof fetchTaskNextIterations>
    >) => void;
    setLoadingIterations: (value: boolean) => void;
};

export const useTaskDetailsActions = ({
    uid,
    task,
    subtasks,
    hasLoadedSubtasks,
    setHasLoadedSubtasks,
    setPendingSubtasks,
    lastKnownSubtaskCount,
    markTaskModified,
    recurrenceForm,
    setIsEditingRecurrence,
    editedDueDate,
    setIsEditingDueDate,
    setEditedDueDate,
    editedDeferUntil,
    setIsEditingDeferUntil,
    setEditedDeferUntil,
    parentTask,
    setNextIterations,
    setLoadingIterations,
}: UseTaskDetailsActionsParams) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showSuccessToast, showErrorToast } = useToast();
    const tasksStore = useStore((state) => state.tasksStore);
    const projectsStore = useStore((state) => state.projectsStore);

    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [activePill, setActivePill] = useState('overview');

    const bumpTimeline = () => setTimelineRefreshKey((prev) => prev + 1);

    const refreshAfterUpdate = async (
        options?: Parameters<typeof refreshTaskInStore>[1]
    ) => {
        if (!uid) {
            return null;
        }
        return refreshTaskInStore(uid, options);
    };

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
        [parentTask?.id, parentTask?.recurrence_type, parentTask?.uid, setLoadingIterations, setNextIterations]
    );

    const handleSaveRecurrence = async () => {
        if (!task?.uid) {
            setIsEditingRecurrence(false);
            return;
        }

        try {
            markTaskModified();
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
            await refreshAfterUpdate();
            showSuccessToast(
                t('task.recurrenceUpdated', 'Recurrence updated successfully')
            );
            setIsEditingRecurrence(false);
            bumpTimeline();
        } catch (error) {
            console.error('Error updating recurrence:', error);
            showErrorToast(
                t('task.recurrenceUpdateError', 'Failed to update recurrence')
            );
            setIsEditingRecurrence(false);
        }
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
            markTaskModified();
            await updateTask(task.uid, {
                due_date: editedDueDate || null,
            });
            await refreshAfterUpdate();
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
            markTaskModified();
            await updateTask(task.uid, {
                defer_until: editedDeferUntil || null,
            });
            await refreshAfterUpdate();
            showSuccessToast(
                t('task.deferUntilUpdated', 'Defer until successfully updated')
            );
            setIsEditingDeferUntil(false);
            bumpTimeline();
        } catch (error: unknown) {
            console.error('Error updating defer until:', error);
            const message =
                error instanceof Error ? error.message : undefined;
            showErrorToast(
                message ||
                    t(
                        'task.deferUntilUpdateError',
                        'Failed to update defer until'
                    )
            );
            setEditedDeferUntil(task?.defer_until || '');
            setIsEditingDeferUntil(false);
        }
    };

    const handleSaveSubtasks = async (subtasksToSave: Task[]) => {
        if (!task?.uid) {
            return;
        }

        const hasChanges =
            subtasksToSave.length !== subtasks.length ||
            subtasksToSave.some((ps, i) => {
                const flagged = ps as SubtaskWithEditFlags;
                return (
                    !subtasks[i] ||
                    ps.name !== subtasks[i].name ||
                    ps.status !== subtasks[i].status ||
                    flagged._isNew ||
                    flagged._isEdited ||
                    flagged._statusChanged
                );
            });

        if (!hasChanges) {
            return;
        }

        try {
            markTaskModified();
            await updateTask(task.uid, { subtasks: subtasksToSave });
            const updatedTask = await refreshAfterUpdate();
            if (updatedTask) {
                lastKnownSubtaskCount.current =
                    updatedTask.subtasks?.length || 0;
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

    const handleProjectSelection = async (project: Project) => {
        if (!task?.uid) return;

        try {
            markTaskModified();
            await updateTask(task.uid, { project_id: project.id });
            await refreshAfterUpdate();
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
            markTaskModified();
            await updateTask(task.uid, { project_id: null });
            await refreshAfterUpdate();
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

    const handleCompletionToggle = async () => {
        if (!task?.uid) {
            return;
        }

        try {
            markTaskModified();
            const updatedTaskResponse = await toggleTaskCompletion(
                task.uid,
                task
            );
            const mergedTask = {
                ...task,
                ...updatedTaskResponse,
                subtasks: updatedTaskResponse.subtasks || task.subtasks || [],
            };

            if (uid) {
                tasksStore.updateTaskInStore(mergedTask);
            }

            await refreshRecurringSetup(mergedTask);
            bumpTimeline();
            showSuccessToast(
                t('task.statusUpdated', 'Status updated successfully')
            );
        } catch (error) {
            console.error('Error toggling task completion:', error);
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    const handleStatusUpdate = async (newStatus: number) => {
        if (!task?.uid) return;

        try {
            markTaskModified();
            await updateTask(task.uid, {
                status: newStatus,
            });
            await refreshAfterUpdate();
            showSuccessToast(
                t('task.statusUpdated', 'Status updated successfully')
            );
            bumpTimeline();
        } catch (error) {
            console.error('Error updating status:', error);
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    const handleDeleteClick = () => {
        if (task) {
            setTaskToDelete(task);
            setIsConfirmDialogOpen(true);
        }
    };

    const handleDuplicate = async () => {
        if (!task?.uid || isDuplicating) {
            return;
        }

        setIsDuplicating(true);
        try {
            let subtasksForCopy = task.subtasks || [];
            if (!hasLoadedSubtasks && subtasksForCopy.length === 0) {
                subtasksForCopy = await fetchSubtasks(task.uid);
                setHasLoadedSubtasks(true);
                lastKnownSubtaskCount.current = subtasksForCopy.length;

                tasksStore.updateTaskInStore({
                    ...task,
                    subtasks: subtasksForCopy,
                });
            }

            const payload = buildDuplicateTaskPayload({
                ...task,
                subtasks: subtasksForCopy,
            });
            const createdTask = await tasksStore.createTask(payload);

            const taskLink = (
                <span>
                    {t('task.duplicated', 'Task')}{' '}
                    <a
                        href={`/task/${createdTask.uid}`}
                        className="text-green-200 underline hover:text-green-100"
                    >
                        {createdTask.name}
                    </a>{' '}
                    {t(
                        'task.duplicatedSuccessfully',
                        'duplicated successfully!'
                    )}
                </span>
            );
            showSuccessToast(taskLink);
        } catch (error) {
            console.error('Error duplicating task:', error);
            showErrorToast(
                t('task.duplicateError', 'Failed to duplicate task')
            );
        } finally {
            setIsDuplicating(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (taskToDelete?.uid) {
            try {
                markTaskModified();
                await deleteTask(taskToDelete.uid);
                showSuccessToast(
                    t('task.deleteSuccess', 'Task deleted successfully')
                );
                navigate(location.state?.from || '/today');
            } catch (error) {
                console.error('Error deleting task:', error);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    const getProjectLink = (project: Project) => {
        if (project.uid) {
            const slug = project.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/project/${project.uid}-${slug}`;
        }
        return `/project/${project.id}`;
    };

    const getTagLink = (tag: Tag) => {
        if (tag.uid) {
            const slug = tag.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/tag/${tag.uid}-${slug}`;
        }
        return `/tag/${encodeURIComponent(tag.name)}`;
    };

    const getAreaLink = (area: Area) => {
        if (area.uid) {
            const slug = area.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/area/${area.uid}-${slug}`;
        }
        return `/area/${area.id}`;
    };

    const handleTitleUpdate = async (newTitle: string) => {
        if (!task?.uid || !newTitle.trim()) {
            return;
        }

        if (newTitle.trim() === task.name) {
            return;
        }

        try {
            markTaskModified();
            await updateTask(task.uid, { name: newTitle.trim() });
            await refreshAfterUpdate();
            showSuccessToast(
                t('task.titleUpdated', 'Task title updated successfully')
            );
            bumpTimeline();
        } catch (error) {
            console.error('Error updating task title:', error);
            showErrorToast(
                t('task.titleUpdateError', 'Failed to update task title')
            );
            throw error;
        }
    };

    const handleContentUpdate = async (newContent: string) => {
        if (!task?.uid) {
            return;
        }

        const trimmedContent = newContent.trim();

        if (trimmedContent === (task.note || '').trim()) {
            return;
        }

        try {
            markTaskModified();
            await updateTask(task.uid, { note: trimmedContent });
            await refreshAfterUpdate();
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

    const handleProjectCreateInlineWrapper = async (name: string) => {
        if (!task?.uid || !name.trim()) return;

        try {
            markTaskModified();
            const newProject = await createProject({ name });
            projectsStore.setProjects([...projectsStore.projects, newProject]);
            await updateTask(task.uid, { project_id: newProject.id });
            await refreshAfterUpdate();
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
            markTaskModified();
            await updateTask(task.uid, { area_id: area.id });
            await refreshAfterUpdate();
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
            markTaskModified();
            await updateTask(task.uid, { area_id: null });
            await refreshAfterUpdate();
            showSuccessToast(
                t('task.areaCleared', 'Area cleared successfully')
            );
            bumpTimeline();
        } catch (error) {
            console.error('Error clearing area:', error);
            showErrorToast(t('task.areaClearError', 'Failed to clear area'));
        }
    };

    const handleAssignPerson = async (personUid: string | null) => {
        if (!task?.uid) return;
        try {
            markTaskModified();
            await updateTask(task.uid, { assigned_to: personUid });
            await refreshAfterUpdate();
        } catch (error) {
            console.error('Error assigning person:', error);
            showErrorToast('Failed to update assignment');
        }
    };

    const handleTagsUpdate = async (tags: string[]) => {
        if (!task?.uid) {
            return;
        }

        const currentTags = task.tags?.map((tag) => tag.name) || [];
        if (
            tags.length === currentTags.length &&
            tags.every((tag, idx) => tag === currentTags[idx])
        ) {
            return;
        }

        try {
            markTaskModified();
            await updateTask(task.uid, {
                tags: tags.map((name) => ({ name })),
            });
            if (uid) {
                const updatedTask = await refreshTaskInStore(uid);
                tasksStore.updateTaskInStore({
                    ...updatedTask,
                    subtasks: updatedTask.subtasks || task.subtasks || [],
                });
            }
            showSuccessToast(
                t('task.tagsUpdated', 'Tags updated successfully')
            );
            bumpTimeline();
        } catch (error: unknown) {
            console.error('Error updating tags:', error);
            const err = error as { details?: string[]; message?: string };
            if (err.details && Array.isArray(err.details) && err.details.length > 0) {
                showErrorToast(err.details.join('. '));
            } else {
                showErrorToast(
                    err.message ||
                        t('task.tagsUpdateError', 'Failed to update tags')
                );
            }
            throw error;
        }
    };

    const handlePriorityUpdate = async (priority: PriorityType) => {
        if (!task?.uid) return;

        try {
            markTaskModified();
            await updateTask(task.uid, {
                priority: priority,
            });
            await refreshAfterUpdate();
            bumpTimeline();
            showSuccessToast(
                t('task.priorityUpdated', 'Priority updated successfully')
            );
        } catch (error) {
            console.error('Error updating priority:', error);
            showErrorToast(
                t('task.priorityUpdateError', 'Failed to update priority')
            );
            throw error;
        }
    };

    const handleSizeUpdate = async (size: SizeValue) => {
        if (!task?.uid) return;
        markTaskModified();
        tasksStore.updateTaskInStore({
            ...task,
            size: sizeToApiValue(size) ?? undefined,
        });
    };

    const handleSizeSaved = async () => {
        if (!uid) return;
        try {
            await refreshAfterUpdate();
            bumpTimeline();
        } catch (error) {
            console.error('Error refreshing task after size update:', error);
        }
    };

    const clearDeleteDialog = () => {
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    return {
        timelineRefreshKey,
        activePill,
        setActivePill,
        isConfirmDialogOpen,
        clearDeleteDialog,
        taskToDelete,
        handleSaveRecurrence,
        handleSaveDueDate,
        handleSaveDeferUntil,
        handleSaveSubtasks,
        handleProjectSelection,
        handleClearProject,
        handleCompletionToggle,
        handleStatusUpdate,
        handleDeleteClick,
        handleDuplicate,
        handleDeleteConfirm,
        getProjectLink,
        getTagLink,
        getAreaLink,
        handleTitleUpdate,
        handleContentUpdate,
        handleProjectCreateInlineWrapper,
        handleAreaSelection,
        handleClearArea,
        handleAssignPerson,
        handleTagsUpdate,
        handlePriorityUpdate,
        handleSizeUpdate,
        handleSizeSaved,
        bumpTimeline,
        refreshAfterUpdate,
    };
};
