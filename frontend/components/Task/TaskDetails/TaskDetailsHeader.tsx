import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CheckIcon,
    XMarkIcon,
    FolderIcon,
    TagIcon,
    ChevronDownIcon,
    ExclamationTriangleIcon,
    FireIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { Task, PriorityType } from '../../../entities/Task';
import { Project } from '../../../entities/Project';
import { Tag } from '../../../entities/Tag';
import BackButton from '../../Shared/BackButton';
import ConfirmDialog from '../../Shared/ConfirmDialog';
import { formatDateTime } from '../../../utils/dateUtils';
import TaskStatusControl from '../TaskStatusControl';
import { getStatusValue } from '../../../constants/taskStatus';
import {
    updateTask,
    deleteTask as deleteTaskService,
    fetchTaskByUid,
    toggleTaskCompletion,
} from '../../../utils/tasksService';
import { useStore } from '../../../store/useStore';
import { useToast } from '../../Shared/ToastContext';
import {
    isTaskOverdueInTodayPlan,
    isTaskPastDue,
} from '../../../utils/dateUtils';

/* ------------------------------------------------------------------ */
/*  Typed store selectors                                             */
/* ------------------------------------------------------------------ */

interface TasksStore {
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    updateTaskInStore: (updatedTask: Task) => void;
}
interface ProjectsStore {
    projects: Project[];
    setProjects: (projects: Project[]) => void;
}
interface TagsStore {
    tags: Tag[];
    hasLoaded: boolean;
    isLoading: boolean;
    loadTags: (force?: boolean) => Promise<void>;
}
interface AreasStore {
    areas: import('../../../entities/Area').Area[];
    hasLoaded: boolean;
    isLoading: boolean;
    loadAreas: () => Promise<void>;
}

const selectTasksStore = (state: { tasksStore: TasksStore }) => state.tasksStore;
const selectProjectsStore = (state: { projectsStore: ProjectsStore }) => state.projectsStore;
const selectTagsStore = (state: { tagsStore: TagsStore }) => state.tagsStore;
const selectAreasStore = (state: { areasStore: AreasStore }) => state.areasStore;
const selectAiEnabled = (state: { userSettingsStore: { aiAssistantEnabled: boolean } }) =>
    state.userSettingsStore.aiAssistantEnabled;

/* ------------------------------------------------------------------ */
/*  useTaskDetailsLifecycle                                           */
/* ------------------------------------------------------------------ */

interface LifecycleArgs {
    uid: string | undefined;
    isNewTask: boolean;
    navigate: ReturnType<typeof useNavigate>;
    locationPathname: string;
}

export const useTaskDetailsLifecycle = ({
    uid,
    isNewTask,
    navigate,
    locationPathname,
}: LifecycleArgs) => {
    const tasksStore = useStore(selectTasksStore);
    const projectsStore = useStore(selectProjectsStore);
    const tagsStore = useStore(selectTagsStore);
    const areasStore = useStore(selectAreasStore);
    const task = useStore(
        (state: { tasksStore: TasksStore }) =>
            state.tasksStore.tasks.find((t: Task) => t.uid === uid)
    );

    const isNewTaskRef = useRef(isNewTask);
    const taskModifiedRef = useRef(false);
    const [loading, setLoading] = useState(!task);
    const [error, setError] = useState<string | null>(null);
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

    const bumpTimeline = useCallback(() => {
        setTimelineRefreshKey((prev) => prev + 1);
    }, []);

    const markModified = useCallback(() => {
        taskModifiedRef.current = true;
    }, []);

    // Clear navigation state so refresh/back doesn't re-trigger edit mode
    useEffect(() => {
        if (isNewTask) {
            navigate(locationPathname, { replace: true, state: {} });
        }
    }, [isNewTask, navigate, locationPathname]);

    // Clean up abandoned new tasks
    useEffect(() => {
        const taskUid = uid;
        return () => {
            if (isNewTaskRef.current && !taskModifiedRef.current && taskUid) {
                deleteTaskService(taskUid).catch((err: unknown) =>
                    console.error('Error cleaning up abandoned new task:', err)
                );
                const store = useStore.getState();
                store.tasksStore.setTasks(
                    store.tasksStore.tasks.filter((t: Task) => t.uid !== taskUid)
                );
            }
        };
    }, [uid]);

    // Fetch task when missing from store
    useEffect(() => {
        const fetchTaskData = async () => {
            if (!uid) {
                setError('No task uid provided');
                setLoading(false);
                return;
            }

            const currentTask = useStore.getState().tasksStore.tasks.find((t: Task) => t.uid === uid);
            if (!currentTask) {
                try {
                    setLoading(true);
                    const fetchedTask = await fetchTaskByUid(uid);
                    const store = useStore.getState();
                    store.tasksStore.setTasks([...store.tasksStore.tasks, fetchedTask]);
                } catch (fetchError) {
                    setError('Task not found');
                    console.error('Error fetching task:', fetchError);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        fetchTaskData();
    }, [uid]);

    return {
        task,
        loading,
        error,
        timelineRefreshKey,
        bumpTimeline,
        markModified,
        taskModifiedRef,
        tasksStore,
        projectsStore,
        tagsStore,
        areasStore,
    };
};

/* ------------------------------------------------------------------ */
/*  Helper: link builders                                             */
/* ------------------------------------------------------------------ */

export const getProjectLink = (project: Project): string => {
    if (project.uid) {
        const slug = project.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `/project/${project.uid}-${slug}`;
    }
    return `/project/${project.id}`;
};

export const getTagLink = (tag: Tag): string => {
    if (tag.uid) {
        const slug = tag.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `/tag/${tag.uid}-${slug}`;
    }
    return `/tag/${encodeURIComponent(tag.name)}`;
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsHeader component                                       */
/* ------------------------------------------------------------------ */

interface TaskDetailsHeaderProps {
    task: Task;
    markModified: () => void;
    bumpTimeline: () => void;
    activePill: string;
    onPillChange: (pill: string) => void;
    attachmentCount?: number;
    autoEditTitle?: boolean;
    aiAssistantEnabled: boolean;
    onAiInsightsClick?: () => void;
    aiInsightsActive?: boolean;
    onAfterCompletion?: (mergedTask: Task) => Promise<void>;
}

const TaskDetailsHeader: React.FC<TaskDetailsHeaderProps> = ({
    task,
    markModified,
    bumpTimeline,
    activePill,
    onPillChange,
    attachmentCount = 0,
    autoEditTitle = false,
    aiAssistantEnabled,
    onAiInsightsClick,
    aiInsightsActive = false,
    onAfterCompletion,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [isEditingTitle, setIsEditingTitle] = useState(autoEditTitle);
    const [editedTitle, setEditedTitle] = useState(task.name);
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const [actionsMenuStyle, setActionsMenuStyle] = useState<React.CSSProperties>({});
    const [actionsMenuReady, setActionsMenuReady] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [isOverdueBubbleVisible, setIsOverdueBubbleVisible] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const actionsMenuDropdownRef = useRef<HTMLDivElement>(null);
    const priorityDropdownRef = useRef<HTMLDivElement>(null);

    const isOverdue = isTaskOverdueInTodayPlan(task);
    const isPastDue = isTaskPastDue(task);

    useEffect(() => {
        setEditedTitle(task.name);
    }, [task.name]);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        if (!isOverdue) {
            setIsOverdueBubbleVisible(false);
        }
    }, [isOverdue]);

    // Overdue outside-click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOverdueBubbleVisible) {
                const clickedOverdueToggle =
                    typeof e.composedPath === 'function'
                        ? e
                              .composedPath()
                              .some(
                                  (node) =>
                                      node instanceof HTMLElement &&
                                      node.hasAttribute('data-overdue-toggle')
                              )
                        : (e.target as Node) instanceof HTMLElement &&
                          !!(e.target as HTMLElement).closest('[data-overdue-toggle]');

                if (!clickedOverdueToggle) {
                    setIsOverdueBubbleVisible(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOverdueBubbleVisible]);

    useLayoutEffect(() => {
        if (!actionsMenuOpen) {
            setActionsMenuStyle({});
            setActionsMenuReady(false);
            return;
        }

        const updateMenuPosition = () => {
            const triggerRect = actionsMenuRef.current?.getBoundingClientRect();
            const menuRect = actionsMenuDropdownRef.current?.getBoundingClientRect();

            if (!triggerRect || !menuRect) {
                return;
            }

            const padding = 8;
            const gap = 8;
            let top = triggerRect.bottom + gap;
            if (top + menuRect.height + padding > window.innerHeight) {
                top = triggerRect.top - menuRect.height - gap;
            }
            top = Math.min(
                Math.max(top, padding),
                window.innerHeight - menuRect.height - padding
            );

            let left = triggerRect.right - menuRect.width;
            left = Math.min(
                Math.max(left, padding),
                window.innerWidth - menuRect.width - padding
            );

            setActionsMenuStyle({
                position: 'fixed',
                top,
                left,
            });
            setActionsMenuReady(true);
        };

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        return () => {
            window.removeEventListener('resize', updateMenuPosition);
        };
    }, [actionsMenuOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                actionsMenuOpen &&
                actionsMenuRef.current &&
                !actionsMenuRef.current.contains(e.target as Node)
            ) {
                setActionsMenuOpen(false);
            }
            if (
                priorityDropdownOpen &&
                priorityDropdownRef.current &&
                !priorityDropdownRef.current.contains(e.target as Node)
            ) {
                setPriorityDropdownOpen(false);
            }
        };

        if (actionsMenuOpen || priorityDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [actionsMenuOpen, priorityDropdownOpen]);

    /* -- Handlers -------------------------------------------------- */

    const handleStartTitleEdit = () => {
        setIsEditingTitle(true);
    };

    const handleSaveTitle = async () => {
        if (editedTitle.trim() && editedTitle !== task.name) {
            try {
                markModified();
                await updateTask(task.uid!, { name: editedTitle.trim() });

                const uid = task.uid!;
                const updatedTask = await fetchTaskByUid(uid);
                const store = useStore.getState();
                const existingIndex = store.tasksStore.tasks.findIndex((t: Task) => t.uid === uid);
                if (existingIndex >= 0) {
                    const updatedTasks = [...store.tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    store.tasksStore.setTasks(updatedTasks);
                }

                showSuccessToast(t('task.titleUpdated', 'Task title updated successfully'));
                bumpTimeline();
            } catch (err) {
                console.error('Error updating task title:', err);
                showErrorToast(t('task.titleUpdateError', 'Failed to update task title'));
                throw err;
            }
        }
        setIsEditingTitle(false);
    };

    const handleCancelTitleEdit = () => {
        setEditedTitle(task.name);
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            handleCancelTitleEdit();
        }
    };

    const handleStatusControlUpdate = async (updatedTask: Task) => {
        const currentStatusValue = getStatusValue(task.status);
        const nextStatusValue = getStatusValue(updatedTask.status);

        if (currentStatusValue !== nextStatusValue) {
            await handleStatusUpdate(nextStatusValue);
        }
    };

    const handleStatusUpdate = async (newStatus: number) => {
        if (!task.uid) return;

        try {
            markModified();
            await updateTask(task.uid, { status: newStatus });

            const uid = task.uid;
            const updatedTask = await fetchTaskByUid(uid);
            const store = useStore.getState();
            const existingIndex = store.tasksStore.tasks.findIndex((t: Task) => t.uid === uid);
            if (existingIndex >= 0) {
                const updatedTasks = [...store.tasksStore.tasks];
                updatedTasks[existingIndex] = updatedTask;
                store.tasksStore.setTasks(updatedTasks);
            }

            showSuccessToast(t('task.statusUpdated', 'Status updated successfully'));
            bumpTimeline();
        } catch (err) {
            console.error('Error updating status:', err);
            showErrorToast(t('task.statusUpdateError', 'Failed to update status'));
        }
    };

    const handleCompletionToggle = async () => {
        if (!task.uid) return;

        try {
            markModified();
            const updatedTaskResponse = await toggleTaskCompletion(task.uid, task);
            const mergedTask = {
                ...task,
                ...updatedTaskResponse,
                subtasks: updatedTaskResponse.subtasks || task.subtasks || [],
            };

            const store = useStore.getState();
            const existingIndex = store.tasksStore.tasks.findIndex((t: Task) => t.uid === task.uid);
            if (existingIndex >= 0) {
                const updatedTasks = [...store.tasksStore.tasks];
                updatedTasks[existingIndex] = mergedTask;
                store.tasksStore.setTasks(updatedTasks);
            }

            await onAfterCompletion?.(mergedTask);
            bumpTimeline();
            showSuccessToast(t('task.statusUpdated', 'Status updated successfully'));
        } catch (err) {
            console.error('Error toggling task completion:', err);
            showErrorToast(t('task.statusUpdateError', 'Failed to update status'));
        }
    };

    const handlePriorityChange = async (newPriority: PriorityType) => {
        setPriorityDropdownOpen(false);
        if (!task.uid) return;

        try {
            markModified();
            await updateTask(task.uid, { priority: newPriority });
            const updatedTask = await fetchTaskByUid(task.uid);
            const store = useStore.getState();
            store.tasksStore.updateTaskInStore(updatedTask);
            bumpTimeline();
            showSuccessToast(t('task.priorityUpdated', 'Priority updated successfully'));
        } catch (err) {
            console.error('Error updating priority:', err);
            showErrorToast(t('task.priorityUpdateError', 'Failed to update priority'));
            throw err;
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
                markModified();
                await deleteTaskService(taskToDelete.uid);
                showSuccessToast(t('task.deleteSuccess', 'Task deleted successfully'));
                navigate(location.state?.from || '/today');
            } catch (err) {
                console.error('Error deleting task:', err);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    const handleOverdueIconClick = () => {
        if (!isOverdue) return;
        setIsOverdueBubbleVisible((prev) => !prev);
    };

    const handleDismissOverdueAlert = () => {
        setIsOverdueBubbleVisible(false);
    };

    /* -- Rendering helpers ----------------------------------------- */

    const getPriorityLabel = (priorityOverride?: PriorityType) => {
        const priority =
            typeof priorityOverride !== 'undefined' ? priorityOverride : task.priority;

        if (priority === 'low' || priority === 0) return t('priority.low', 'Low');
        if (priority === 'medium' || priority === 1) return t('priority.medium', 'Medium');
        if (priority === 'high' || priority === 2) return t('priority.high', 'High');
        return t('priority.none', 'None');
    };

    const getPriorityButtonClass = () => {
        const priority = task.priority;

        if (priority === null || priority === undefined) {
            return 'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 sm:gap-2 sm:ml-1 border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60';
        }

        const baseClass =
            'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 sm:gap-2 sm:ml-1 border';

        if (priority === 'low' || priority === 0) {
            return `${baseClass} border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30`;
        } else if (priority === 'medium' || priority === 1) {
            return `${baseClass} border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30`;
        } else if (priority === 'high' || priority === 2) {
            return `${baseClass} border-red-500 text-red-600 dark:border-red-400 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30`;
        }
        return `${baseClass} border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60`;
    };

    const getPriorityIcon = (priorityOverride?: PriorityType): React.ElementType => {
        const priority =
            typeof priorityOverride !== 'undefined' ? priorityOverride : task.priority;

        if (priority === 'low' || priority === 0) return ArrowDownIcon;
        if (priority === 'medium' || priority === 1) return ArrowUpIcon;
        if (priority === 'high' || priority === 2) return FireIcon;
        return XMarkIcon;
    };

    const getPriorityIconClass = (priorityOverride?: PriorityType) => {
        const priority =
            typeof priorityOverride !== 'undefined' ? priorityOverride : task.priority;

        if (priority === 'low' || priority === 0) return 'text-blue-500 dark:text-blue-400';
        if (priority === 'medium' || priority === 1) return 'text-yellow-500 dark:text-yellow-400';
        if (priority === 'high' || priority === 2) return 'text-red-500 dark:text-red-400';
        return 'text-gray-500 dark:text-gray-400';
    };

    const formattedUpdatedAt = task.updated_at
        ? formatDateTime(new Date(task.updated_at))
        : null;

    return (
        <>
        <div className="mb-6">
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editedTitle}
                                onChange={(e) =>
                                    setEditedTitle(e.target.value)
                                }
                                onKeyDown={handleTitleKeyDown}
                                onBlur={handleSaveTitle}
                                className="text-2xl font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                                placeholder={t(
                                    'task.titlePlaceholder',
                                    'Enter task title'
                                )}
                            />
                        ) : (
                            <>
                                <div className="flex items-center gap-3 flex-wrap min-w-0">
                                    <h2
                                        onClick={handleStartTitleEdit}
                                        className="text-2xl font-normal text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 transition-colors truncate min-w-0"
                                        title={t(
                                            'task.clickToEditTitle',
                                            'Click to edit title'
                                        )}
                                    >
                                        {task.name}
                                    </h2>

                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <TaskStatusControl
                                            task={task}
                                            onToggleCompletion={handleCompletionToggle}
                                            onTaskUpdate={handleStatusControlUpdate}
                                            hoverRevealQuickActions={false}
                                            showMobileVariant={false}
                                            variant="square"
                                            className="flex-shrink-0"
                                        />

                                        {/* Priority Dropdown Button - Next to status */}
                                        <div
                                            className="relative flex-shrink-0"
                                            ref={priorityDropdownRef}
                                        >
                                            <button
                                                className={getPriorityButtonClass()}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setPriorityDropdownOpen(
                                                        !priorityDropdownOpen
                                                    );
                                                }}
                                                aria-haspopup="true"
                                                aria-expanded={
                                                    priorityDropdownOpen
                                                }
                                            >
                                                {React.createElement(
                                                    getPriorityIcon(),
                                                    {
                                                        className: `h-4 w-4 ${getPriorityIconClass()}`,
                                                    }
                                                )}
                                                <span className="capitalize hidden sm:inline">
                                                    {getPriorityLabel()}
                                                </span>
                                                <ChevronDownIcon className="h-4 w-4" />
                                            </button>
                                            {priorityDropdownOpen && (
                                                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-20">
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm rounded-t-lg flex items-center gap-2 ${
                                                            task.priority ===
                                                                null ||
                                                            task.priority ===
                                                                undefined
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                null
                                                            );
                                                        }}
                                                    >
                                                        <XMarkIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass(null)}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.none',
                                                                'None'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            null ||
                                                            task.priority ===
                                                                undefined) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                            task.priority ===
                                                                'low' ||
                                                            task.priority === 0
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                'low'
                                                            );
                                                        }}
                                                    >
                                                        <ArrowDownIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass('low')}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.low',
                                                                'Low'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            'low' ||
                                                            task.priority ===
                                                                0) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                            task.priority ===
                                                                'medium' ||
                                                            task.priority === 1
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                'medium'
                                                            );
                                                        }}
                                                    >
                                                        <ArrowUpIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass('medium')}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.medium',
                                                                'Medium'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            'medium' ||
                                                            task.priority ===
                                                                1) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm rounded-b-lg flex items-center gap-2 ${
                                                            task.priority ===
                                                                'high' ||
                                                            task.priority === 2
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                'high'
                                                            );
                                                        }}
                                                    >
                                                        <FireIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass('high')}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.high',
                                                                'High'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            'high' ||
                                                            task.priority ===
                                                                2) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Past Due Badge - Right of priority button */}
                                        {isPastDue && (
                                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex-shrink-0">
                                                <ExclamationTriangleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                                <span className="text-xs font-medium text-red-700 dark:text-red-300 hidden sm:inline">
                                                    {t(
                                                        'task.pastDue',
                                                        'Past Due'
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {formattedUpdatedAt && (
                                            <span className="text-xs text-gray-400 dark:text-gray-600 sm:pl-1 mt-1 sm:mt-0 break-words">
                                                {t(
                                                    'task.updatedAt',
                                                    'Updated at'
                                                )}
                                                :{' '}
                                                <span className="text-gray-400 dark:text-gray-600">
                                                    {formattedUpdatedAt}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Project and tags display below title */}
                                {(task.Project ||
                                    (task.tags && task.tags.length > 0)) && (
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-2 px-2 -mx-2 gap-2 flex-wrap">
                                        {task.Project && (
                                            <Link
                                                to={getProjectLink(task.Project)}
                                                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200 hover:underline transition-colors"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <FolderIcon className="h-4 w-4" />
                                                <span>{task.Project.name}</span>
                                            </Link>
                                        )}
                                        {task.tags && task.tags.length > 0 && (
                                            <div className="flex items-center">
                                                <TagIcon className="h-4 w-4 mr-1" />
                                                <span>
                                                    {task.tags.map(
                                                        (
                                                            tag: Tag,
                                                            index: number
                                                        ) => (
                                                            <React.Fragment
                                                                key={
                                                                    tag.uid ||
                                                                    tag.id ||
                                                                    tag.name
                                                                }
                                                            >
                                                                <Link
                                                                    to={getTagLink(tag)}
                                                                    className="hover:text-gray-900 dark:hover:text-gray-200 hover:underline transition-colors"
                                                                    onClick={(
                                                                        e
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    {tag.name}
                                                                </Link>
                                                                {index <
                                                                    task.tags!
                                                                        .length -
                                                                        1 &&
                                                                    ', '}
                                                            </React.Fragment>
                                                        )
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <BackButton className="flex-shrink-0 self-start" />
                </div>

                {/* Divider - Edge to edge */}
                <div className="mt-4 mb-4 -mx-6 border-t border-gray-200 dark:border-gray-700"></div>

                {/* Pills Navigation */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => onPillChange('overview')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'overview'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.overview', 'Overview')}
                        </button>
                        <button
                            onClick={() => onPillChange('attachments')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
                                activePill === 'attachments'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.attachments', 'Attachments')}
                            {attachmentCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full border border-white dark:border-gray-900"></span>
                            )}
                        </button>
                        <button
                            onClick={() => onPillChange('activity')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'activity'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.activity', 'Activity')}
                        </button>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {aiAssistantEnabled && onAiInsightsClick && (
                            <button
                                onClick={onAiInsightsClick}
                                className={`flex items-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1.5 ${
                                    aiInsightsActive
                                        ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                }`}
                                aria-pressed={aiInsightsActive}
                                aria-label={t('aiAssistant.taskInsightsTitle', 'AI Insights')}
                                title={t('aiAssistant.taskInsightsTitle', 'AI Insights')}
                            >
                                <SparklesIcon
                                    className={`h-4 w-4 ${
                                        aiInsightsActive
                                            ? 'text-indigo-600 dark:text-indigo-300'
                                            : 'text-gray-600 dark:text-gray-200'
                                    }`}
                                />
                            </button>
                        )}
                        {(isOverdue || true) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {isOverdue && (
                                <div
                                    className="relative flex items-center z-20"
                                    data-overdue-toggle
                                >
                                    <button
                                        data-overdue-toggle
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleOverdueIconClick();
                                        }}
                                        className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs transition-colors ${
                                            isOverdue && isOverdueBubbleVisible
                                                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300'
                                                : 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-900/40'
                                        }`}
                                        title={t(
                                            'task.showOverdueWarning',
                                            'Show overdue warning'
                                        )}
                                        aria-label={t(
                                            'task.showOverdueWarning',
                                            'Show overdue warning'
                                        )}
                                    >
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                    </button>
                                    {isOverdue && isOverdueBubbleVisible && (
                                        <div
                                            data-overdue-toggle
                                            className="absolute right-0 top-full translate-y-2 w-[30rem] max-w-lg z-30"
                                        >
                                            <div className="relative rounded-lg shadow-2xl bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-600 px-4 py-3 text-xs text-amber-800 dark:text-amber-100">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDismissOverdueAlert();
                                                    }}
                                                    className="absolute top-2 right-2 text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 transition-colors"
                                                    aria-label={t(
                                                        'common.close',
                                                        'Close'
                                                    )}
                                                >
                                                    <XMarkIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="flex items-start space-x-2 pr-4">
                                                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium">
                                                            {t(
                                                                'task.overdueAlert',
                                                                "This task was in your plan yesterday and wasn't completed."
                                                            )}
                                                        </p>
                                                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-200">
                                                            {t(
                                                                'task.overdueYesterday',
                                                                'Consider prioritizing this task or breaking it into smaller steps.'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div
                                className="relative flex items-center"
                                ref={actionsMenuRef}
                            >
                                <button
                                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActionsMenuOpen(!actionsMenuOpen);
                                    }}
                                    aria-haspopup="true"
                                    aria-expanded={actionsMenuOpen}
                                    aria-label={t(
                                        'common.moreActions',
                                        'More actions'
                                    )}
                                >
                                    <span className="text-lg leading-none">
                                        ...
                                    </span>
                                </button>
                                {actionsMenuOpen && (
                                    <div
                                        ref={actionsMenuDropdownRef}
                                        style={{
                                            ...actionsMenuStyle,
                                            visibility: actionsMenuReady
                                                ? 'visible'
                                                : 'hidden',
                                        }}
                                        className="z-30 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                                    >
                                        <button
                                            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setActionsMenuOpen(false);
                                                handleDeleteClick();
                                            }}
                                        >
                                            {t('common.delete', 'Delete')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
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
    </>
    );
};

export { selectAiEnabled };
export default TaskDetailsHeader;
