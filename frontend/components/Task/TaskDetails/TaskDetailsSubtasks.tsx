import React from 'react';
import { Task } from '../../../entities/Task';
import TaskSubtasksCard from './TaskSubtasksCard';
import { TaskDetailsSubtasksState } from './hooks/useTaskDetailsSubtasks';

interface TaskDetailsSubtasksProps {
    task: Task;
    subtasks: TaskDetailsSubtasksState;
}

/** Subtasks section of the task details Overview tab. State comes from `useTaskDetailsSubtasks`. */
const TaskDetailsSubtasks: React.FC<TaskDetailsSubtasksProps> = ({
    task,
    subtasks,
}) => (
    <TaskSubtasksCard
        task={task}
        subtasks={subtasks.pendingSubtasks}
        onSubtasksChange={subtasks.setPendingSubtasks}
        onSave={subtasks.handleSaveSubtasks}
    />
);

export default TaskDetailsSubtasks;
