import { createContext, useContext } from 'react';

export interface TaskDetailsPageContextValue {
    markModified: () => void;
    bumpTimeline: () => void;
    refreshRecurrence: () => Promise<void>;
    registerRecurrenceRefresh: (fn: (() => Promise<void>) | null) => void;
}

export const TaskDetailsPageContext =
    createContext<TaskDetailsPageContextValue | null>(null);

export const TaskDetailsPageProvider = TaskDetailsPageContext.Provider;

export const useTaskDetailsPageContext = (): TaskDetailsPageContextValue => {
    const value = useContext(TaskDetailsPageContext);
    if (!value) {
        throw new Error(
            'useTaskDetailsPageContext must be used within TaskDetailsPageProvider'
        );
    }
    return value;
};
