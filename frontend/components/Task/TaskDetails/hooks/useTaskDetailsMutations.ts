import { MutableRefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigateFunction } from 'react-router-dom';
import { Task, PriorityType } from '../../../../entities/Task';
import {
    updateTask,
    deleteTask,
    fetchTaskByUid,
    toggleTaskCompletion,
} from '../../../../utils/tasksService';
import { useToast } from '../../../Shared/ToastContext';
import { StoreState } from '../../../../store/useStore';
import { replaceTaskInStore } from '../taskDetailsMutations';

interface UseTaskDetailsMutationsParams {
    task: Task | undefined;
    uid: string | undefined;
    tasksStore: StoreState['tasksStore'];
    taskModifiedRef: MutableRefObject<boolean>;
    onTimelineRefresh: () => void;
    onCompletionToggled: (mergedTask: Task) => void | Promise<void>;
    navigate: NavigateFunction;
    deleteRedirectPath?: string;
}

/**
 * Owns the mutation handlers that act on the task as a whole (title,
 * content, status, priority, completion toggle, delete) and that are
 * shared across multiple sub-components rather than owned by one of them.
 */
export function useTaskDetailsMutations({
    task,
    uid,
    tasksStore,
    taskModifiedRef,
    onTimelineRefresh,
    onCompletionToggled,
    navigate,
    deleteRedirectPath,
}: UseTaskDetailsMutationsParams) {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

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

            const updatedTask = await fetchTaskByUid(task.uid);
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            showSuccessToast(
                t('task.titleUpdated', 'Task title updated successfully')
            );
            onTimelineRefresh();
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

            const updatedTask = await fetchTaskByUid(task.uid);
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            showSuccessToast(
                t('task.contentUpdated', 'Task content updated successfully')
            );
            onTimelineRefresh();
        } catch (error) {
            console.error('Error updating task content:', error);
            showErrorToast(
                t('task.contentUpdateError', 'Failed to update task content')
            );
            throw error;
        }
    };

    const handleStatusUpdate = async (newStatus: number) => {
        if (!task?.uid) return;

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                status: newStatus,
            });

            const updatedTask = await fetchTaskByUid(task.uid);
            replaceTaskInStore(tasksStore, task.uid, updatedTask);

            showSuccessToast(
                t('task.statusUpdated', 'Status updated successfully')
            );
            onTimelineRefresh();
        } catch (error) {
            console.error('Error updating status:', error);
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    const handlePriorityUpdate = async (priority: PriorityType) => {
        if (!task?.uid || !uid) return;

        try {
            taskModifiedRef.current = true;
            await updateTask(task.uid, {
                priority: priority,
            });
            const updatedTask = await fetchTaskByUid(uid);
            tasksStore.updateTaskInStore(updatedTask);
            onTimelineRefresh();
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

    const handleCompletionToggle = async () => {
        if (!task?.uid || !uid) {
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

            replaceTaskInStore(tasksStore, uid, mergedTask);

            await onCompletionToggled(mergedTask);
            onTimelineRefresh();
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
                navigate(deleteRedirectPath || '/today');
            } catch (error) {
                console.error('Error deleting task:', error);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    const cancelDelete = () => {
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    return {
        handleTitleUpdate,
        handleContentUpdate,
        handleStatusUpdate,
        handlePriorityUpdate,
        handleCompletionToggle,
        isConfirmDialogOpen,
        taskToDelete,
        handleDeleteClick,
        handleDeleteConfirm,
        cancelDelete,
    };
}
