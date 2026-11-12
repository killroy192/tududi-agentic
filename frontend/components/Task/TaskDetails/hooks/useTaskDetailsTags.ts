import { useTranslation } from 'react-i18next';
import { Task } from '../../../../entities/Task';
import { useToast } from '../../../Shared/ToastContext';
import { useTaskUpdate } from './useTaskUpdate';

/** Server validation errors carry `details`; prefer them, then `message`, then the fallback. */
const getTagsErrorMessage = (error: unknown, fallback: string): string => {
    const { details, message } = (error ?? {}) as {
        details?: unknown;
        message?: string;
    };
    if (Array.isArray(details) && details.length > 0) {
        return details.join('. ');
    }
    return message || fallback;
};

interface UseTaskDetailsTagsParams {
    task: Task | undefined;
    updateAndRefresh: ReturnType<typeof useTaskUpdate>['updateAndRefresh'];
    onMutated: () => void;
}

export const useTaskDetailsTags = ({
    task,
    updateAndRefresh,
    onMutated,
}: UseTaskDetailsTagsParams) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    /** Rethrows on failure so the card stays in edit mode. */
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
            await updateAndRefresh(
                task.uid,
                { tags: tags.map((name) => ({ name })) },
                { write: 'replaceAtIndex', subtasksFallbackFrom: task }
            );

            showSuccessToast(
                t('task.tagsUpdated', 'Tags updated successfully')
            );

            onMutated();
        } catch (error) {
            console.error('Error updating tags:', error);
            showErrorToast(
                getTagsErrorMessage(
                    error,
                    t('task.tagsUpdateError', 'Failed to update tags')
                )
            );
            throw error;
        }
    };

    return { handleTagsUpdate };
};
