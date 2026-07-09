import { sortTasksByPriorityDueDateProject } from './taskSortUtils';
import { Task } from '../entities/Task';

function makeTask(overrides: Partial<Task>): Task {
    return {
        name: 'task',
        status: 'not_started',
        ...overrides,
    } as Task;
}

describe('sortTasksByPriorityDueDateProject', () => {
    it('orders by priority High -> Medium -> Low -> None (string form)', () => {
        const tasks = [
            makeTask({ id: 1, priority: 'low' }),
            makeTask({ id: 2, priority: 'high' }),
            makeTask({ id: 3 }),
            makeTask({ id: 4, priority: 'medium' }),
        ];

        const sorted = sortTasksByPriorityDueDateProject(tasks);
        expect(sorted.map((t) => t.id)).toEqual([2, 4, 1, 3]);
    });

    it('orders by priority High -> Medium -> Low -> None (numeric form)', () => {
        const tasks = [
            makeTask({ id: 1, priority: 0 }),
            makeTask({ id: 2, priority: 2 }),
            makeTask({ id: 3, priority: undefined }),
            makeTask({ id: 4, priority: 1 }),
        ];

        const sorted = sortTasksByPriorityDueDateProject(tasks);
        expect(sorted.map((t) => t.id)).toEqual([2, 4, 1, 3]);
    });

    it('treats mixed string/numeric priorities equivalently', () => {
        const tasks = [
            makeTask({ id: 1, priority: 'low' }),
            makeTask({ id: 2, priority: 2 }),
        ];

        const sorted = sortTasksByPriorityDueDateProject(tasks);
        expect(sorted.map((t) => t.id)).toEqual([2, 1]);
    });

    it('breaks priority ties by due date, earlier first, null/undefined last', () => {
        const tasks = [
            makeTask({ id: 1, priority: 'high', due_date: '2026-08-01' }),
            makeTask({ id: 2, priority: 'high' }),
            makeTask({ id: 3, priority: 'high', due_date: '2026-07-01' }),
        ];

        const sorted = sortTasksByPriorityDueDateProject(tasks);
        expect(sorted.map((t) => t.id)).toEqual([3, 1, 2]);
    });

    it('breaks priority+due date ties by project id', () => {
        const tasks = [
            makeTask({ id: 1, priority: 'high', project_id: 20 }),
            makeTask({ id: 2, priority: 'high', project_id: 10 }),
        ];

        const sorted = sortTasksByPriorityDueDateProject(tasks);
        expect(sorted.map((t) => t.id)).toEqual([2, 1]);
    });

    it('excludes future-deferred tasks when excludeFutureDeferred is true', () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        const tasks = [
            makeTask({ id: 1, defer_until: future }),
            makeTask({ id: 2 }),
        ];

        const sorted = sortTasksByPriorityDueDateProject(tasks, {
            excludeFutureDeferred: true,
        });
        expect(sorted.map((t) => t.id)).toEqual([2]);
    });

    it('returns an empty array for empty/undefined input', () => {
        expect(sortTasksByPriorityDueDateProject([])).toEqual([]);
        expect(sortTasksByPriorityDueDateProject(undefined as any)).toEqual([]);
    });
});
