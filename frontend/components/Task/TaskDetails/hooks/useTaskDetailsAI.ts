import { useCallback, useRef, useState } from 'react';
import { useStore } from '../../../../store/useStore';
import { TaskAIInsightsHandle } from '../../../AI/TaskAIInsights';

/** AI insights panel state shared with the header's sparkle button. */
export const useTaskDetailsAI = () => {
    const aiAssistantEnabled = useStore(
        (state) => state.userSettingsStore.aiAssistantEnabled
    );
    const aiInsightsRef = useRef<TaskAIInsightsHandle>(null);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);

    const handleAiInsightsClick = useCallback(() => {
        aiInsightsRef.current?.activate();
    }, []);

    return {
        aiAssistantEnabled,
        aiInsightsRef,
        aiInsightsActive,
        setAiInsightsActive,
        handleAiInsightsClick,
    };
};

export type TaskDetailsAIState = ReturnType<typeof useTaskDetailsAI>;
