import React from 'react';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import TaskTagsCard from './TaskTagsCard';
import { getTagLink } from './taskDetailsLinks';

interface TaskDetailsTagsProps {
    task: Task;
    onUpdate: (tags: string[]) => Promise<void>;
}

/** Tags section of the task details Overview tab. */
const TaskDetailsTags: React.FC<TaskDetailsTagsProps> = ({
    task,
    onUpdate,
}) => {
    const tagsStore = useStore((state) => state.tagsStore);

    return (
        <TaskTagsCard
            task={task}
            availableTags={tagsStore.tags}
            hasLoadedTags={tagsStore.hasLoaded}
            isLoadingTags={tagsStore.isLoading}
            onUpdate={onUpdate}
            onLoadTags={() => tagsStore.loadTags()}
            getTagLink={getTagLink}
        />
    );
};

export default TaskDetailsTags;
