import React, { useRef, useState, useCallback } from 'react';
import { Project } from '../../../entities/Project';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import TaskAIInsights, { TaskAIInsightsHandle } from '../../AI/TaskAIInsights';
import { selectAiEnabled } from './TaskDetailsHeader';

/* ------------------------------------------------------------------ */
/*  useTaskDetailsAI hook                                             */
/* ------------------------------------------------------------------ */

interface AIArgs {
    task: Task | undefined;
    projectsStore: {
        projects: Project[];
    };
}

export const useTaskDetailsAI = ({ task, projectsStore }: AIArgs) => {
    const aiAssistantEnabled = useStore(selectAiEnabled);
    const aiInsightsRef = useRef<TaskAIInsightsHandle>(null);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);

    const handleAiInsightsClick = useCallback(() => {
        aiInsightsRef.current?.activate();
    }, []);

    const project = task
        ? projectsStore.projects.find((p: Project) => p.id === task.project_id) || null
        : null;

    return {
        aiAssistantEnabled,
        aiInsightsRef,
        aiInsightsActive,
        setAiInsightsActive,
        handleAiInsightsClick,
        project,
    };
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsAI component                                           */
/* ------------------------------------------------------------------ */

interface TaskDetailsAIProps {
    task: Task;
    aiInsightsRef: React.RefObject<TaskAIInsightsHandle | null>;
    project: Project | null;
    onActiveChange: (active: boolean) => void;
}

const TaskDetailsAI: React.FC<TaskDetailsAIProps> = ({
    task,
    aiInsightsRef,
    project,
    onActiveChange,
}) => {
    return (
        <div className="mb-4 mt-6">
            <TaskAIInsights
                ref={aiInsightsRef}
                task={task}
                project={project}
                onActiveChange={onActiveChange}
            />
        </div>
    );
};

export default TaskDetailsAI;
