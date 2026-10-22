import { Task } from '../entities/Task';
import { applySizeByUid, saveTaskSize } from './taskSize';
import { updateTask } from './tasksService';

jest.mock('./tasksService', () => ({
    updateTask: jest.fn(),
}));

const baseTask = (overrides: Partial<Task>): Task => ({
    name: 'Task',
    status: 'not_started',
    completed_at: null,
    ...overrides,
});

describe('taskSize', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('saves only the size field', async () => {
        (updateTask as jest.Mock).mockResolvedValue({
            uid: 'task-1',
            name: 'Daily',
            original_name: 'Write the report',
            size: 'L',
            due_date: '2026-01-02',
        });

        const saved = await saveTaskSize('task-1', 'L');

        expect(updateTask).toHaveBeenCalledTimes(1);
        expect(updateTask).toHaveBeenCalledWith('task-1', { size: 'L' });
        expect(saved).toBe('L');
    });

    it('copies size onto every matching row and leaves occurrence fields', () => {
        const tasks = [
            baseTask({
                id: 1,
                uid: 'series',
                name: 'Daily',
                due_date: '2026-01-01',
                is_virtual_occurrence: true,
                size: 'S',
            }),
            baseTask({
                id: 1,
                uid: 'series',
                name: 'Daily',
                due_date: '2026-01-02',
                is_virtual_occurrence: true,
                size: 'S',
            }),
            baseTask({
                id: 2,
                uid: 'other',
                name: 'Other',
                due_date: '2026-02-01',
                is_virtual_occurrence: false,
                size: null,
            }),
        ];

        const updated = applySizeByUid(tasks, 'series', 'XL');

        expect(updated[0].size).toBe('XL');
        expect(updated[1].size).toBe('XL');
        expect(updated[0].due_date).toBe('2026-01-01');
        expect(updated[1].due_date).toBe('2026-01-02');
        expect(updated[0].is_virtual_occurrence).toBe(true);
        expect(updated[1].is_virtual_occurrence).toBe(true);
        expect(updated[0].id).toBe(1);
        expect(updated[0].name).toBe('Daily');
        expect(updated[2]).toBe(tasks[2]);
        expect(updated[2].size).toBeNull();
    });

    it('updates a nested subtask without changing the parent', () => {
        const tasks = [
            baseTask({
                uid: 'parent',
                name: 'Parent',
                size: 'S',
                due_date: '2026-03-01',
                subtasks: [
                    baseTask({
                        uid: 'child',
                        name: 'Child',
                        size: null,
                        due_date: '2026-03-02',
                        is_virtual_occurrence: false,
                    }),
                ],
            }),
        ];

        const updated = applySizeByUid(tasks, 'child', 'M');

        expect(updated[0].size).toBe('S');
        expect(updated[0].due_date).toBe('2026-03-01');
        expect(updated[0].uid).toBe('parent');
        expect(updated[0].subtasks?.[0].size).toBe('M');
        expect(updated[0].subtasks?.[0].due_date).toBe('2026-03-02');
        expect(updated[0].subtasks?.[0].name).toBe('Child');
        expect(updated[0].subtasks?.[0].is_virtual_occurrence).toBe(false);
    });
});
