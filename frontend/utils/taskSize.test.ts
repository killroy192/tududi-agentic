import { Task } from '../entities/Task';
import { mergeSavedTaskSize, omitTaskSize } from './taskSize';

type ListedTask = Task & { is_virtual_occurrence?: boolean };

describe('task size helpers', () => {
    it('copies a saved size onto every row with that uid and leaves occurrence fields', () => {
        const rows: ListedTask[] = [
            {
                id: 1,
                uid: 'series-1',
                name: 'Daily',
                status: 'not_started',
                completed_at: null,
                size: 'S',
                due_date: '2099-01-15',
                is_virtual_occurrence: true,
            },
            {
                id: 1,
                uid: 'series-1',
                name: 'Daily',
                status: 'not_started',
                completed_at: null,
                size: 'S',
                due_date: '2099-06-20',
                is_virtual_occurrence: true,
            },
            {
                id: 2,
                uid: 'other',
                name: 'Other',
                status: 'not_started',
                completed_at: null,
                size: null,
                due_date: '2099-03-01',
            },
        ];

        const merged = mergeSavedTaskSize(rows, 'series-1', 'XL');

        expect(merged[0].size).toBe('XL');
        expect(merged[1].size).toBe('XL');
        expect(merged[0].due_date).toBe('2099-01-15');
        expect(merged[1].due_date).toBe('2099-06-20');
        expect(merged[0].is_virtual_occurrence).toBe(true);
        expect(merged[1].is_virtual_occurrence).toBe(true);
        expect(merged[2]).toEqual(rows[2]);
    });

    it('updates a nested subtask without replacing the parent size', () => {
        const rows: Task[] = [
            {
                id: 1,
                uid: 'parent',
                name: 'Parent',
                status: 'not_started',
                completed_at: null,
                size: 'S',
                subtasks: [
                    {
                        id: 2,
                        uid: 'child',
                        name: 'Child',
                        status: 'not_started',
                        completed_at: null,
                        size: null,
                    },
                ],
            },
        ];

        const merged = mergeSavedTaskSize(rows, 'child', 'L');

        expect(merged[0].size).toBe('S');
        expect(merged[0].subtasks?.[0].size).toBe('L');
    });

    it('removes size from a general task payload', () => {
        expect(
            omitTaskSize({
                uid: 'task-1',
                name: 'Task',
                priority: 1,
                size: 'M' as const,
            })
        ).toEqual({
            uid: 'task-1',
            name: 'Task',
            priority: 1,
        });
    });
});
