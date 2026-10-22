import React from 'react';
import { useTranslation } from 'react-i18next';
import { Task, TaskSize } from '../../entities/Task';
import { useStore } from '../../store/useStore';
import { getCurrentUser } from '../../utils/userUtils';
import { saveTaskSize } from '../../utils/taskSize';
import { useToast } from '../Shared/ToastContext';
import SizeDropdown from '../Shared/SizeDropdown';

interface TaskSizeControlProps {
    task: Task;
}

const TaskSizeControl: React.FC<TaskSizeControlProps> = ({ task }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const sizesByUid = useStore((state) => state.tasksStore.sizesByUid);
    const currentUser = getCurrentUser();
    const isOwner = Boolean(
        currentUser?.uid && task.user_uid === currentUser.uid
    );

    if (!task.uid) {
        return null;
    }

    const displayedSize = Object.prototype.hasOwnProperty.call(
        sizesByUid,
        task.uid
    )
        ? sizesByUid[task.uid]
        : (task.size ?? null);

    const handleChange = async (size: TaskSize | null) => {
        try {
            const saved = await saveTaskSize(task.uid!, size);
            useStore.getState().tasksStore.applyTaskSize(task.uid!, saved);
            showSuccessToast(
                t('task.sizeUpdated', 'Size updated successfully')
            );
        } catch {
            showErrorToast(t('task.sizeUpdateError', 'Failed to update size'));
        }
    };

    return (
        <SizeDropdown
            value={displayedSize}
            isOwner={isOwner}
            onChange={handleChange}
        />
    );
};

export default TaskSizeControl;
