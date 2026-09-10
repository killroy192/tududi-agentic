import React, { forwardRef } from 'react';
import TaskAIInsights, {
    TaskAIInsightsHandle,
} from '../../AI/TaskAIInsights';
import { Task } from '../../../entities/Task';
import { Project } from '../../../entities/Project';

export type TaskDetailsAIHandle = TaskAIInsightsHandle;

interface TaskDetailsAIProps {
    task: Task;
    project?: Project | null;
    onActiveChange?: (active: boolean) => void;
}

const TaskDetailsAI = forwardRef<TaskDetailsAIHandle, TaskDetailsAIProps>(
    (props, ref) => {
        return <TaskAIInsights ref={ref} {...props} />;
    }
);

TaskDetailsAI.displayName = 'TaskDetailsAI';

export default TaskDetailsAI;
