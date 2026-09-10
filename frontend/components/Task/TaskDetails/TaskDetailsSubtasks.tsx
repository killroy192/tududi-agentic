import React from 'react';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import { Task } from '../../../entities/Task';

interface TaskDetailsSubtasksProps {
    task: Task;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSave: (subtasks: Task[]) => void;
}

const TaskDetailsSubtasks: React.FC<TaskDetailsSubtasksProps> = ({
    task,
    subtasks,
    onSubtasksChange,
    onSave,
}) => {
    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
            <TaskSubtasksSection
                parentTaskId={task.id!}
                subtasks={subtasks}
                onSubtasksChange={onSubtasksChange}
                onSave={onSave}
            />
        </div>
    );
};

export default TaskDetailsSubtasks;
