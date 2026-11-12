import React from 'react';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import TaskAIInsights from '../../AI/TaskAIInsights';
import { TaskDetailsAIState } from './hooks/useTaskDetailsAI';

interface TaskDetailsAIProps {
    task: Task;
    ai: TaskDetailsAIState;
}

/** AI insights panel; renders nothing when the assistant is disabled. */
const TaskDetailsAI: React.FC<TaskDetailsAIProps> = ({ task, ai }) => {
    const projects = useStore((state) => state.projectsStore.projects);

    if (!ai.aiAssistantEnabled) {
        return null;
    }

    const project =
        projects.find((item) => item.id === task.project_id) || null;

    return (
        <div className="mb-4 mt-6">
            <TaskAIInsights
                ref={ai.aiInsightsRef}
                task={task}
                project={project}
                onActiveChange={ai.setAiInsightsActive}
            />
        </div>
    );
};

export default TaskDetailsAI;
