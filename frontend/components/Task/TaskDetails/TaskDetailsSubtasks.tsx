import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    EyeIcon,
    PencilIcon,
} from '@heroicons/react/24/outline';
import MarkdownRenderer from '../../Shared/MarkdownRenderer';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import { Task } from '../../../entities/Task';
import {
    updateTask,
    fetchTaskByUid,
    fetchSubtasks,
} from '../../../utils/tasksService';
import { useStore } from '../../../store/useStore';
import { useToast } from '../../Shared/ToastContext';

const EMPTY_SUBTASKS: Task[] = [];

/* ------------------------------------------------------------------ */
/*  Local type for subtask transient flags                            */
/* ------------------------------------------------------------------ */

interface SubtaskTransient {
    _isNew?: boolean;
    _isEdited?: boolean;
    _statusChanged?: boolean;
}

/* ------------------------------------------------------------------ */
/*  useTaskDetailsSubtasks hook                                       */
/* ------------------------------------------------------------------ */

interface SubtasksArgs {
    task: Task | undefined;
    uid: string | undefined;
    markModified: () => void;
    bumpTimeline: () => void;
}

export const useTaskDetailsSubtasks = ({
    task,
    uid,
    markModified,
    bumpTimeline,
}: SubtasksArgs) => {
    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    const subtasks = task?.subtasks ?? EMPTY_SUBTASKS;
    const [pendingSubtasks, setPendingSubtasks] = useState<Task[]>([]);
    const [hasLoadedSubtasks, setHasLoadedSubtasks] = useState(false);
    const lastKnownSubtaskCount = useRef<number>(0);

    // Reset on uid change
    useEffect(() => {
        setHasLoadedSubtasks(false);
        lastKnownSubtaskCount.current = 0;
    }, [uid]);

    // Sync pending from store
    useEffect(() => {
        setPendingSubtasks(subtasks);
    }, [subtasks]);

    // Fetch subtasks when missing
    useEffect(() => {
        const loadSubtasks = async () => {
            if (!task?.uid) return;

            const currentCount = task?.subtasks?.length || 0;
            const subtasksDisappeared =
                lastKnownSubtaskCount.current > 0 && currentCount === 0;
            const needsInitialLoad = !hasLoadedSubtasks && currentCount === 0;

            if (needsInitialLoad || subtasksDisappeared) {
                try {
                    const fetchedSubtasks = await fetchSubtasks(task.uid);
                    setHasLoadedSubtasks(true);
                    lastKnownSubtaskCount.current = fetchedSubtasks.length;

                    const store = useStore.getState();
                    const existingIndex = store.tasksStore.tasks.findIndex(
                        (t: Task) => t.uid === task.uid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...store.tasksStore.tasks];
                        updatedTasks[existingIndex] = {
                            ...task,
                            subtasks: fetchedSubtasks,
                        };
                        store.tasksStore.setTasks(updatedTasks);
                    }
                } catch (error) {
                    console.error('Error loading subtasks:', error);
                    setHasLoadedSubtasks(true);
                }
            } else if (currentCount > 0) {
                lastKnownSubtaskCount.current = currentCount;
            }
        };

        loadSubtasks();
    }, [task?.uid, task?.subtasks, hasLoadedSubtasks]);

    const handleSaveSubtasks = useCallback(
        async (subtasksToSave: Task[]) => {
            if (!task?.uid) return;

            const hasChanges =
                subtasksToSave.length !== subtasks.length ||
                subtasksToSave.some(
                    (ps, i) =>
                        !subtasks[i] ||
                        ps.name !== subtasks[i].name ||
                        ps.status !== subtasks[i].status ||
                        (ps as Task & SubtaskTransient)._isNew ||
                        (ps as Task & SubtaskTransient)._isEdited ||
                        (ps as Task & SubtaskTransient)._statusChanged
                );

            if (!hasChanges) return;

            try {
                markModified();
                await updateTask(task.uid, { subtasks: subtasksToSave });

                if (uid) {
                    const updatedTask = await fetchTaskByUid(uid);
                    lastKnownSubtaskCount.current =
                        updatedTask.subtasks?.length || 0;
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

                bumpTimeline();
            } catch (error) {
                console.error('Error updating subtasks:', error);
                showErrorToast(
                    t('task.subtasksUpdateError', 'Failed to update subtasks')
                );
                setPendingSubtasks([...subtasks]);
            }
        },
        [task?.uid, subtasks, uid, markModified, bumpTimeline, showErrorToast, t]
    );

    const handleContentUpdate = useCallback(
        async (newContent: string) => {
            if (!task?.uid) return;

            const trimmedContent = newContent.trim();
            if (trimmedContent === (task.note || '').trim()) return;

            try {
                markModified();
                await updateTask(task.uid, { note: trimmedContent });

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
        },
        [task?.uid, task?.note, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]
    );

    return {
        pendingSubtasks,
        setPendingSubtasks,
        handleSaveSubtasks,
        handleContentUpdate,
    };
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsNote — exported for tests                              */
/* ------------------------------------------------------------------ */

interface TaskDetailsNoteProps {
    content: string;
    onUpdate: (newContent: string) => Promise<void>;
}

export const TaskDetailsNote: React.FC<TaskDetailsNoteProps> = ({
    content,
    onUpdate,
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(content);
    const [contentTab, setContentTab] = useState<'edit' | 'preview'>('edit');
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setEditedContent(content);
    }, [content]);

    useEffect(() => {
        if (isEditing && contentTextareaRef.current) {
            contentTextareaRef.current.focus();
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (editedContent !== content) {
            await onUpdate(editedContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedContent(content);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className="space-y-2">
            {isEditing ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 p-6">
                    <div className="relative">
                        {/* Floating toggle buttons */}
                        <div className="absolute top-2 right-2 z-10 flex space-x-1">
                            <button
                                type="button"
                                onClick={() => setContentTab('edit')}
                                className={`p-1.5 rounded-md transition-colors ${
                                    contentTab === 'edit'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                                }`}
                                title={t('common.edit', 'Edit')}
                            >
                                <PencilIcon className="h-3 w-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setContentTab('preview')}
                                className={`p-1.5 rounded-md transition-colors ${
                                    contentTab === 'preview'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                                }`}
                                title={t('common.preview', 'Preview')}
                            >
                                <EyeIcon className="h-3 w-3" />
                            </button>
                        </div>

                        {contentTab === 'edit' ? (
                            <textarea
                                ref={contentTextareaRef}
                                value={editedContent}
                                onChange={(e) =>
                                    setEditedContent(e.target.value)
                                }
                                onKeyDown={handleKeyDown}
                                className="w-full min-h-[200px] bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 resize-y font-normal pr-20"
                                placeholder={t(
                                    'task.contentPlaceholder',
                                    'Add content here... (Markdown supported)'
                                )}
                            />
                        ) : (
                            <div className="w-full min-h-[200px] bg-gray-50 dark:bg-gray-800 rounded p-3 pr-20 overflow-y-auto">
                                {editedContent ? (
                                    <MarkdownRenderer
                                        content={editedContent}
                                        className="prose dark:prose-invert max-w-none"
                                    />
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400 italic">
                                        {t(
                                            'task.noContentPreview',
                                            'No content to preview. Switch to Edit mode to add content.'
                                        )}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'task.contentEditHint',
                                'Press Cmd/Ctrl+Enter to save, Esc to cancel'
                            )}
                        </span>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : content ? (
                <div
                    onClick={handleStartEdit}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                    title={t(
                        'task.clickToEditContent',
                        'Click to edit content'
                    )}
                >
                    <MarkdownRenderer
                        content={content}
                        className="prose dark:prose-invert max-w-none"
                        onContentChange={onUpdate}
                    />
                </div>
            ) : (
                <div
                    onClick={handleStartEdit}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                    title={t('task.clickToAddContent', 'Click to add content')}
                >
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <PencilSquareIcon className="h-12 w-12 mb-3 opacity-50" />
                        <span className="text-sm text-center">
                            {t('task.noNotes', 'Add some content')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsSubtasksSection                                        */
/* ------------------------------------------------------------------ */

interface TaskDetailsSubtasksSectionProps {
    task: Task;
    pendingSubtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSave: (subtasks: Task[]) => void;
    content: string;
    onContentUpdate: (newContent: string) => Promise<void>;
}

const TaskDetailsSubtasksSection: React.FC<TaskDetailsSubtasksSectionProps> = ({
    task,
    pendingSubtasks,
    onSubtasksChange,
    onSave,
    content,
    onContentUpdate,
}) => {
    return (
        <>
            <TaskDetailsNote content={content} onUpdate={onContentUpdate} />
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                <TaskSubtasksSection
                    parentTaskId={task.id!}
                    subtasks={pendingSubtasks}
                    onSubtasksChange={onSubtasksChange}
                    onSave={onSave}
                />
            </div>
        </>
    );
};

export default TaskDetailsSubtasksSection;
