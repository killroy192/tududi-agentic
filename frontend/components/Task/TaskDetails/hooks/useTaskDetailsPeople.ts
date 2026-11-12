import { Task } from '../../../../entities/Task';
import { useToast } from '../../../Shared/ToastContext';
import { useTaskUpdate } from './useTaskUpdate';

interface UseTaskDetailsPeopleParams {
    task: Task | undefined;
    updateAndRefresh: ReturnType<typeof useTaskUpdate>['updateAndRefresh'];
}

export const useTaskDetailsPeople = ({
    task,
    updateAndRefresh,
}: UseTaskDetailsPeopleParams) => {
    const { showErrorToast } = useToast();

    const handleAssignPerson = async (personUid: string | null) => {
        if (!task?.uid) return;
        try {
            await updateAndRefresh(
                task.uid,
                { assigned_to: personUid },
                { write: 'mergeById' }
            );
        } catch (error) {
            console.error('Error assigning person:', error);
            showErrorToast('Failed to update assignment');
        }
    };

    return { handleAssignPerson };
};
