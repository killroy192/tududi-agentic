import { useMemo } from 'react';
import { Task } from '../entities/Task';
import { useStore } from '../store/useStore';

export function useTasksWithSavedSizes(tasks: Task[]): Task[] {
    const sizesByUid = useStore((s) => s.tasksStore.sizesByUid);
    return useMemo(() => {
        const apply = (list: Task[]): Task[] =>
            list.map((task) => {
                const subtasks = task.subtasks
                    ? apply(task.subtasks)
                    : task.subtasks;
                const override = task.uid ? sizesByUid[task.uid] : undefined;
                if (override === undefined && subtasks === task.subtasks)
                    return task;
                return {
                    ...task,
                    ...(override !== undefined ? { size: override } : {}),
                    subtasks,
                };
            });
        return apply(tasks || []);
    }, [tasks, sizesByUid]);
}
