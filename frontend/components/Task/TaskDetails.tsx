import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { Task, TaskSize } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Area } from '../../entities/Area';
import {
    updateTask,
    deleteTask,
    fetchTaskByUid,
    toggleTaskCompletion,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { fetchAttachments } from '../../utils/attachmentsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    TaskContentCard,
    TaskProjectCard,
    TaskAreaCard,
    TaskTagsCard,
    TaskDueDateCard,
    TaskDeferUntilCard,
    TaskAttachmentsCard,
    TaskAssignedToCard,
} from './TaskDetails/';
import TaskAIInsights, { TaskAIInsightsHandle } from '../AI/TaskAIInsights';
import {
    isTaskOverdueInTodayPlan,
    isTaskPastDue,
    getTodayDateString,
} from '../../utils/dateUtils';
import { useClearNewTaskState } from './TaskDetails/hooks/useClearNewTaskState';
import { useAbandonedTaskCleanup } from './TaskDetails/hooks/useAbandonedTaskCleanup';
import { useTaskData } from './TaskDetails/hooks/useTaskData';
import { useLazyTaskMetadata } from './TaskDetails/hooks/useLazyTaskMetadata';
import { useOverdueBubble } from './TaskDetails/hooks/useOverdueBubble';
import { useDateDraft } from './TaskDetails/hooks/useDateDraft';
import { useTaskUpdate } from './TaskDetails/hooks/useTaskUpdate';
import { useTaskDetailsSubtasks } from './TaskDetails/hooks/useTaskDetailsSubtasks';
import { useTaskDetailsRecurrence } from './TaskDetails/hooks/useTaskDetailsRecurrence';
import TaskDetailsSubtasks from './TaskDetails/TaskDetailsSubtasks';
import TaskDetailsRecurrence from './TaskDetails/TaskDetailsRecurrence';

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const isNewTask = location.state?.isNew === true;
    const { showSuccessToast, showErrorToast } = useToast();

    useClearNewTaskState(isNewTask);
    const taskModifiedRef = useAbandonedTaskCleanup(uid, isNewTask);

    const projectsStore = useStore((state: any) => state.projectsStore);
    const tagsStore = useStore((state: any) => state.tagsStore);
    const tasksStore = useStore((state: any) => state.tasksStore);
    const areasStore = useStore((state: any) => state.areasStore);
    const { task, loading, error } = useTaskData(uid);

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const bumpTimeline = () => setTimelineRefreshKey((prev) => prev + 1);
    const { updateAndRefresh, writeTask } = useTaskUpdate({
        uid,
        taskModifiedRef,
    });
    const aiAssistantEnabled = useStore(
        (state: any) => state.userSettingsStore.aiAssistantEnabled
    );
    const aiInsightsRef = useRef<TaskAIInsightsHandle>(null);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);

    const handleAiInsightsClick = useCallback(() => {
        aiInsightsRef.current?.activate();
    }, []);
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
    const [attachmentCount, setAttachmentCount] = useState(0);

    useLazyTaskMetadata();

    const isOverdue = task ? isTaskOverdueInTodayPlan(task) : false;
    const isPastDue = task ? isTaskPastDue(task) : false;
    const {
        isOverdueBubbleVisible,
        handleOverdueIconClick,
        handleDismissOverdueAlert,
    } = useOverdueBubble(isOverdue);

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
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                due_date: editedDueDate || null,
            });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.dueDateUpdated', 'Due date updated successfully')
            );
            setIsEditingDueDate(false);

            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                defer_until: editedDeferUntil || null,
            });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.deferUntilUpdated', 'Defer until successfully updated')
            );
            setIsEditingDeferUntil(false);
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error: any) {
            console.error('Error updating defer until:', error);
            showErrorToast(
                error?.message ||
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

    useEffect(() => {
        const loadAttachmentCount = async () => {
            if (task?.uid) {
                try {
                    const attachments = await fetchAttachments(task.uid);
                    setAttachmentCount(attachments.length);
                } catch (error) {
                    console.error('Error loading attachment count:', error);
                }
            }
        };

        loadAttachmentCount();
    }, [task?.uid]);

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

    const handleProjectSelection = async (project: Project) => {
        if (!task?.uid) return;

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, { project_id: project.id });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.projectUpdated', 'Project updated successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
            await updateTask(task.uid, { project_id: null });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.projectCleared', 'Project cleared successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
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
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = mergedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            await recurrence.refreshRecurringSetup(mergedTask);
            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                status: newStatus,
            });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.statusUpdated', 'Status updated successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
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

    const handleDeleteConfirm = async () => {
        if (taskToDelete?.uid) {
            try {
                taskModifiedRef.current = true;
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

    const getTagLink = (tag: any) => {
        if (tag.uid) {
            const slug = tag.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/tag/${tag.uid}-${slug}`;
        }
        return `/tag/${encodeURIComponent(tag.name)}`;
    };

    const handleTitleUpdate = async (newTitle: string) => {
        if (!task?.uid || !newTitle.trim()) {
            return;
        }

        if (newTitle.trim() === task.name) {
            return;
        }

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, { name: newTitle.trim() });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.titleUpdated', 'Task title updated successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
            await updateTask(task.uid, { note: trimmedContent });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.contentUpdated', 'Task content updated successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
            const newProject = await createProject({ name });

            projectsStore.setProjects([...projectsStore.projects, newProject]);

            await updateTask(task.uid, { project_id: newProject.id });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('project.createdAndAssigned', 'Project created and assigned')
            );

            setTimelineRefreshKey((prev) => prev + 1);
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
            taskModifiedRef.current = true;
            await updateTask(task.uid, { area_id: area.id });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                tasksStore.updateTaskInStore(updatedTask);
            }

            showSuccessToast(
                t('task.areaUpdated', 'Area updated successfully')
            );
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating area:', error);
            showErrorToast(t('task.areaUpdateError', 'Failed to update area'));
        }
    };

    const handleClearArea = async () => {
        if (!task?.uid) return;

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, { area_id: null });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                tasksStore.updateTaskInStore(updatedTask);
            }

            showSuccessToast(
                t('task.areaCleared', 'Area cleared successfully')
            );
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error clearing area:', error);
            showErrorToast(t('task.areaClearError', 'Failed to clear area'));
        }
    };

    const handleAssignPerson = async (personUid: string | null) => {
        if (!task?.uid) return;
        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, { assigned_to: personUid });
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                tasksStore.updateTaskInStore(updatedTask);
            }
        } catch (error) {
            console.error('Error assigning person:', error);
            showErrorToast('Failed to update assignment');
        }
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

    const handleTagsUpdate = async (tags: string[]) => {
        if (!task?.uid) {
            return;
        }

        const currentTags = task.tags?.map((tag: any) => tag.name) || [];
        if (
            tags.length === currentTags.length &&
            tags.every((tag, idx) => tag === currentTags[idx])
        ) {
            return;
        }

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                tags: tags.map((name) => ({ name })),
            });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = {
                        ...updatedTask,
                        subtasks: updatedTask.subtasks || task.subtasks || [],
                    };
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.tagsUpdated', 'Tags updated successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error: any) {
            console.error('Error updating tags:', error);
            const details = error?.details;
            if (details && Array.isArray(details) && details.length > 0) {
                showErrorToast(details.join('. '));
            } else {
                showErrorToast(
                    error?.message ||
                        t('task.tagsUpdateError', 'Failed to update tags')
                );
            }
            throw error;
        }
    };

    const handlePriorityUpdate = async (priority: any) => {
        if (!task?.uid) return;

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                priority: priority,
            });
            const updatedTask = await fetchTaskByUid(uid!);
            tasksStore.updateTaskInStore(updatedTask);
            setTimelineRefreshKey((prev) => prev + 1);
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

    const handleSizeSaved = (size: TaskSize | null) => {
        taskModifiedRef.current = true;
        if (!uid || task?.id == null) return;

        // publishTaskSize already merged by uid. Mirror the priority path's
        // store write without refetching or refreshing the timeline.
        const current =
            useStore
                .getState()
                .tasksStore.tasks.find((item: Task) => item.uid === uid) ??
            task;
        tasksStore.updateTaskInStore({ ...current, size });
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
                    onTitleUpdate={handleTitleUpdate}
                    onStatusUpdate={handleStatusUpdate}
                    onPriorityUpdate={handlePriorityUpdate}
                    onSizeSaved={handleSizeSaved}
                    onDelete={handleDeleteClick}
                    getProjectLink={getProjectLink}
                    getTagLink={getTagLink}
                    activePill={activePill}
                    onPillChange={setActivePill}
                    showOverdueIcon={isOverdue}
                    showPastDueBadge={isPastDue}
                    onOverdueIconClick={handleOverdueIconClick}
                    isOverdueAlertVisible={isOverdue && isOverdueBubbleVisible}
                    onDismissOverdueAlert={handleDismissOverdueAlert}
                    onQuickStatusToggle={handleCompletionToggle}
                    onAiInsightsClick={aiAssistantEnabled ? handleAiInsightsClick : undefined}
                    aiInsightsActive={aiInsightsActive}
                    attachmentCount={attachmentCount}
                    autoEditTitle={isNewTask}
                />

                {aiAssistantEnabled && (
                    <div className="mb-4 mt-6">
                        <TaskAIInsights
                            ref={aiInsightsRef}
                            task={task}
                            project={projectsStore.projects.find(
                                (p: any) => p.id === task.project_id
                            ) || null}
                            onActiveChange={setAiInsightsActive}
                        />
                    </div>
                )}

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
                                    onProjectCreate={
                                        handleProjectCreateInlineWrapper
                                    }
                                    getProjectLink={getProjectLink}
                                />

                                <TaskAreaCard
                                    task={task}
                                    areas={areasStore.areas}
                                    onAreaSelect={handleAreaSelection}
                                    onAreaClear={handleClearArea}
                                    getAreaLink={getAreaLink}
                                />

                                <TaskAssignedToCard
                                    task={task}
                                    onAssign={handleAssignPerson}
                                />

                                <TaskTagsCard
                                    task={task}
                                    availableTags={tagsStore.tags}
                                    hasLoadedTags={tagsStore.hasLoaded}
                                    isLoadingTags={tagsStore.isLoading}
                                    onUpdate={handleTagsUpdate}
                                    onLoadTags={() => tagsStore.loadTags()}
                                    getTagLink={getTagLink}
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
                        <div className="grid grid-cols-1">
                            <TaskAttachmentsCard
                                taskUid={task.uid}
                                onAttachmentsCountChange={setAttachmentCount}
                            />
                        </div>
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

                {isConfirmDialogOpen && taskToDelete && (
                    <ConfirmDialog
                        title={t('task.deleteConfirmTitle', 'Delete Task')}
                        message={t(
                            'task.deleteConfirmMessage',
                            'Are you sure you want to delete this task? This action cannot be undone.'
                        )}
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setTaskToDelete(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
