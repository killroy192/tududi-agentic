import React from 'react';
import { Task } from '../../../entities/Task';
import TaskAssignedToCard from './TaskAssignedToCard';

interface TaskDetailsPeopleProps {
    task: Task;
    onAssign: (personUid: string | null) => Promise<void>;
}

/** People (assignee) section of the task details Overview tab. */
const TaskDetailsPeople: React.FC<TaskDetailsPeopleProps> = ({
    task,
    onAssign,
}) => <TaskAssignedToCard task={task} onAssign={onAssign} />;

export default TaskDetailsPeople;
