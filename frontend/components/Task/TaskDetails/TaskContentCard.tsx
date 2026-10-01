import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    EyeIcon,
    PencilIcon,
} from '@heroicons/react/24/outline';
import MarkdownRenderer from '../../Shared/MarkdownRenderer';
import { Task } from '../../../entities/Task';
import { updateTask } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';
import { useTaskDetailsPageContext } from './TaskDetailsPageContext';
import { refetchAndSetTask } from './taskDetailsStoreUpdates';

interface TaskContentCardProps {
    task?: Task;
    content?: string;
    onUpdate?: (newContent: string) => Promise<void>;
}

const TaskContentCard: React.FC<TaskContentCardProps> = ({
    task,
    content: contentProp,
    onUpdate: onUpdateProp,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { markModified, bumpTimeline } = useTaskDetailsPageContext();
    const noteContent = contentProp ?? task?.note ?? '';
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(noteContent);
    const [contentTab, setContentTab] = useState<'edit' | 'preview'>('edit');
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setEditedContent(noteContent);
    }, [noteContent]);

    useEffect(() => {
        if (isEditing && contentTextareaRef.current) {
            contentTextareaRef.current.focus();
        }
    }, [isEditing]);

    const handleContentUpdate = useCallback(
        async (newContent: string) => {
            if (onUpdateProp) {
                return onUpdateProp(newContent);
            }

            if (!task?.uid) {
                return;
            }

            const trimmedContent = newContent.trim();

            if (trimmedContent === (task.note || '').trim()) {
                return;
            }

            try {
                markModified();
                await updateTask(task.uid, { note: trimmedContent });
                await refetchAndSetTask(task.uid);
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
        [
            onUpdateProp,
            task?.uid,
            task?.note,
            markModified,
            bumpTimeline,
            showSuccessToast,
            showErrorToast,
            t,
        ]
    );

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (onUpdateProp) {
            if (editedContent !== noteContent) {
                await onUpdateProp(editedContent);
            }
        } else {
            const trimmed = editedContent.trim();
            if (trimmed !== noteContent.trim()) {
                await handleContentUpdate(editedContent);
            }
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedContent(noteContent);
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
            ) : noteContent ? (
                <div
                    onClick={handleStartEdit}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                    title={t(
                        'task.clickToEditContent',
                        'Click to edit content'
                    )}
                >
                    <MarkdownRenderer
                        content={noteContent}
                        className="prose dark:prose-invert max-w-none"
                        onContentChange={handleContentUpdate}
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

export default TaskContentCard;
