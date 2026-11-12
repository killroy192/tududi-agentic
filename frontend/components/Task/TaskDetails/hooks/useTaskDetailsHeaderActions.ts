import { MutableRefObject, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PriorityType, Task, TaskSize } from '../../../../entities/Task';
import {
    deleteTask,
    toggleTaskCompletion,
} from '../../../../utils/tasksService';
import {
    isTaskOverdueInTodayPlan,
    isTaskPastDue,
} from '../../../../utils/dateUtils';
import { useStore } from '../../../../store/useStore';
import { useToast } from '../../../Shared/ToastContext';
import { useOverdueBubble } from './useOverdueBubble';
import { useTaskUpdate } from './useTaskUpdate';

interface UseTaskDetailsHeaderActionsParams {
    uid: string | undefined;
    task: Task | undefined;
    taskModifiedRef: MutableRefObject<boolean>;
    updateAndRefresh: ReturnType<typeof useTaskUpdate>['updateAndRefresh'];
    writeTask: ReturnType<typeof useTaskUpdate>['writeTask'];
    refreshRecurringSetup: (latestTask?: Task | null) => Promise<void>;
    onMutated: () => void;
}

/** Handlers and flags for `TaskDetailsHeader`: title, status, priority, size, completion, delete, overdue. */
export const useTaskDetailsHeaderActions = ({
    uid,
    task,
    taskModifiedRef,
    updateAndRefresh,
    writeTask,
    refreshRecurringSetup,
    onMutated,
}: UseTaskDetailsHeaderActionsParams) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

    const isOverdue = task ? isTaskOverdueInTodayPlan(task) : false;
    const isPastDue = task ? isTaskPastDue(task) : false;
    const {
        isOverdueBubbleVisible,
        handleOverdueIconClick,
        handleDismissOverdueAlert,
    } = useOverdueBubble(isOverdue);

    /** Rethrows on failure so the title stays in edit mode. */
    const handleTitleUpdate = async (newTitle: string) => {
        if (!task?.uid || !newTitle.trim()) {
            return;
        }

        if (newTitle.trim() === task.name) {
            return;
        }

        try {
            await updateAndRefresh(
                task.uid,
                { name: newTitle.trim() },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.titleUpdated', 'Task title updated successfully')
            );

            onMutated();
        } catch (error) {
            console.error('Error updating task title:', error);
            showErrorToast(
                t('task.titleUpdateError', 'Failed to update task title')
            );
            throw error;
        }
    };

    const handleStatusUpdate = async (newStatus: number) => {
        if (!task?.uid) return;

        try {
            await updateAndRefresh(
                task.uid,
                { status: newStatus },
                { write: 'replaceAtIndex' }
            );

            showSuccessToast(
                t('task.statusUpdated', 'Status updated successfully')
            );

            onMutated();
        } catch (error) {
            console.error('Error updating status:', error);
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    /** Rethrows on failure so the priority dropdown can revert. */
    const handlePriorityUpdate = async (priority: PriorityType | number) => {
        if (!task?.uid) return;

        try {
            await updateAndRefresh(
                task.uid,
                { priority },
                { write: 'mergeById', skipUidGuard: true }
            );
            onMutated();
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
                .tasksStore.tasks.find((item) => item.uid === uid) ?? task;
        writeTask({ ...current, size }, 'mergeById');
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
                writeTask(mergedTask, 'replaceAtIndex');
            }

            await refreshRecurringSetup(mergedTask);
            onMutated();
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

    const handleDeleteCancel = () => {
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
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
        handleDeleteCancel();
    };

    return {
        isOverdue,
        isPastDue,
        isOverdueBubbleVisible,
        handleOverdueIconClick,
        handleDismissOverdueAlert,
        handleTitleUpdate,
        handleStatusUpdate,
        handlePriorityUpdate,
        handleSizeSaved,
        handleCompletionToggle,
        isDeleteDialogOpen: isConfirmDialogOpen && !!taskToDelete,
        handleDeleteClick,
        handleDeleteConfirm,
        handleDeleteCancel,
    };
};
