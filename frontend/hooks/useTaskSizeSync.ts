import { useEffect, useRef } from 'react';
import { useStore, TaskSizeUpdate } from '../store/useStore';

/**
 * Calls `onSizeUpdate` every time a task size is saved in this session.
 * Screens that keep their own task copy use it to merge the new size into each section.
 */
export const useTaskSizeSync = (
    onSizeUpdate: (update: TaskSizeUpdate) => void
): void => {
    const handlerRef = useRef(onSizeUpdate);
    handlerRef.current = onSizeUpdate;

    useEffect(
        () =>
            useStore.subscribe((state, prevState) => {
                const update = state.tasksStore.lastSizeUpdate;
                if (!update) return;
                if (update === prevState.tasksStore.lastSizeUpdate) return;
                handlerRef.current(update);
            }),
        []
    );
};
