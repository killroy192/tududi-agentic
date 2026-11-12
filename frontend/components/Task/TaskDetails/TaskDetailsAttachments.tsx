import React from 'react';
import TaskAttachmentsCard from './TaskAttachmentsCard';

interface TaskDetailsAttachmentsProps {
    taskUid: string;
    onCountChange: (count: number) => void;
}

/** Attachments tab of the task details page. */
const TaskDetailsAttachments: React.FC<TaskDetailsAttachmentsProps> = ({
    taskUid,
    onCountChange,
}) => (
    <div className="grid grid-cols-1">
        <TaskAttachmentsCard
            taskUid={taskUid}
            onAttachmentsCountChange={onCountChange}
        />
    </div>
);

export default TaskDetailsAttachments;
