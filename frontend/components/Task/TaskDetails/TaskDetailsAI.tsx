import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import TaskAIInsights, {
    TaskAIInsightsHandle,
} from '../../AI/TaskAIInsights';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';

export interface TaskDetailsAIHandle {
    activate: () => void;
}

interface TaskDetailsAIProps {
    task: Task;
    onActiveChange: (active: boolean) => void;
}

const TaskDetailsAI = forwardRef<TaskDetailsAIHandle, TaskDetailsAIProps>(
    ({ task, onActiveChange }, ref) => {
        const aiAssistantEnabled = useStore(
            (state) => state.userSettingsStore.aiAssistantEnabled
        );
        const projects = useStore((state) => state.projectsStore.projects);
        const innerRef = useRef<TaskAIInsightsHandle>(null);

        useImperativeHandle(ref, () => ({
            activate: () => innerRef.current?.activate(),
        }));

        if (!aiAssistantEnabled) {
            return null;
        }

        const project =
            projects.find((p) => p.id === task.project_id) || null;

        return (
            <div className="mb-4 mt-6">
                <TaskAIInsights
                    ref={innerRef}
                    task={task}
                    project={project}
                    onActiveChange={onActiveChange}
                />
            </div>
        );
    }
);

TaskDetailsAI.displayName = 'TaskDetailsAI';

export default TaskDetailsAI;
