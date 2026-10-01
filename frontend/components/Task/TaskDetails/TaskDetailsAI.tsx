import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import TaskAIInsights, {
    TaskAIInsightsHandle,
} from '../../AI/TaskAIInsights';
import { Task } from '../../../entities/Task';
import { useStore, StoreState } from '../../../store/useStore';

export interface TaskDetailsAIHeaderProps {
    onAiInsightsClick?: () => void;
    aiInsightsActive: boolean;
}

interface TaskDetailsAIProps {
    task: Task;
    onProvideHeaderHandlers: (handlers: TaskDetailsAIHeaderProps | null) => void;
}

const TaskDetailsAI: React.FC<TaskDetailsAIProps> = ({
    task,
    onProvideHeaderHandlers,
}) => {
    const aiAssistantEnabled = useStore(
        (state: StoreState) => state.userSettingsStore.aiAssistantEnabled
    );
    const project =
        useStore((state: StoreState) =>
            state.projectsStore.projects.find((p) => p.id === task.project_id)
        ) ?? null;

    const aiInsightsRef = useRef<TaskAIInsightsHandle>(null);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);

    const handleAiInsightsClick = useCallback(() => {
        aiInsightsRef.current?.activate();
    }, []);

    useEffect(() => {
        if (!aiAssistantEnabled) {
            onProvideHeaderHandlers(null);
            return;
        }

        onProvideHeaderHandlers({
            onAiInsightsClick: handleAiInsightsClick,
            aiInsightsActive,
        });
    }, [
        aiAssistantEnabled,
        aiInsightsActive,
        handleAiInsightsClick,
        onProvideHeaderHandlers,
    ]);

    if (!aiAssistantEnabled) {
        return null;
    }

    return (
        <div className="mb-4 mt-6">
            <TaskAIInsights
                ref={aiInsightsRef}
                task={task}
                project={project}
                onActiveChange={setAiInsightsActive}
            />
        </div>
    );
};

export default TaskDetailsAI;
