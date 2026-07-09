import { Task } from '../entities/Task';
import { getPriorityValue } from '../constants/taskPriority';

interface SortOptions {
    excludeFutureDeferred?: boolean;
}

/**
 * Multi-criteria sorting for tasks in Today view sections.
 * Sorting order:
 * 1. Priority (High → Medium → Low → None)
 * 2. Due date (earlier first, null/undefined last)
 * 3. Project (tasks with same priority and due date grouped by project)
 *
 * This function is used to ensure consistent task ordering across all Today sections
 * (Planned, Due Today, Overdue, Suggested) as per issue #653.
 */
export const sortTasksByPriorityDueDateProject = (
    tasks: Task[],
    options: SortOptions = {}
): Task[] => {
    if (!tasks || tasks.length === 0) return [];

    const shouldExcludeDeferred = options.excludeFutureDeferred;
    const now = Date.now();

    const filteredTasks = shouldExcludeDeferred
        ? tasks.filter((task) => {
              if (!task.defer_until) return true;
              const deferUntil = new Date(task.defer_until).getTime();
              if (Number.isNaN(deferUntil)) return true;
              return deferUntil <= now;
          })
        : tasks;

    if (filteredTasks.length === 0) return [];

    return [...filteredTasks].sort((a, b) => {
        // 1. Priority (High → Medium → Low → None)
        // Handles both string ('low', 'medium', 'high') and numeric (0, 1, 2) priority values;
        // "None" (null/undefined/unrecognized) sorts below Low via the -1 fallback.
        const aPriority = getPriorityValue(a.priority) ?? -1;
        const bPriority = getPriorityValue(b.priority) ?? -1;
        if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
        }

        // 2. Due date (earlier first, null/undefined last)
        const aDueDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bDueDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        if (aDueDate !== bDueDate) {
            return aDueDate - bDueDate;
        }

        // 3. Project (tasks with same priority and due date grouped by project)
        const aProject = a.project_id || '';
        const bProject = b.project_id || '';
        return aProject.toString().localeCompare(bProject.toString());
    });
};
