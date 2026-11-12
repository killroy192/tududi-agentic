import { Task } from '../entities/Task';
import { applyTaskSizeUpdateToGroups } from './taskSize';
import { updateTask } from './tasksService';

jest.mock('./csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('csrf-token'),
}));

const task = (overrides: Partial<Task> & Pick<Task, 'uid' | 'name'>): Task => ({
    status: 0,
    completed_at: null,
    ...overrides,
});

describe('applyTaskSizeUpdateToGroups', () => {
    it('merges a published size into two sections that hold the same uid', () => {
        const overdue = task({
            uid: 'task-1',
            name: 'Overdue copy',
            size: null,
        });
        const dueToday = task({
            uid: 'task-1',
            name: 'Due today copy',
            size: 'S',
        });
        const untouched = task({ uid: 'task-2', name: 'Other', size: 'XL' });
        const groups = {
            overdue: [overdue],
            dueToday: [dueToday, untouched],
        };

        const next = applyTaskSizeUpdateToGroups(groups, {
            uid: 'task-1',
            size: 'M',
        });

        expect(next.overdue[0].size).toBe('M');
        expect(next.dueToday[0].size).toBe('M');
        expect(next.dueToday[1]).toBe(untouched);
        expect(next.overdue[0]).not.toBe(overdue);
        expect(next).not.toBe(groups);
    });

    it('keeps a virtual occurrence and updates the stored row in another section', () => {
        const virtual = task({
            uid: 'task-1',
            name: 'Monday',
            size: 'S',
            is_virtual_occurrence: true,
        });
        const stored = task({ uid: 'task-1', name: 'Parent', size: 'S' });
        const groups = {
            monday: [virtual],
            parent: [stored],
        };

        const next = applyTaskSizeUpdateToGroups(groups, {
            uid: 'task-1',
            size: 'XL',
        });

        expect(next.monday[0]).toBe(virtual);
        expect(next.monday[0].size).toBe('S');
        expect(next.parent[0].size).toBe('XL');
    });

    it('updates a nested subtask and the same uid shown as its own row', () => {
        const subtask = task({ uid: 'sub-1', name: 'Sub', size: null });
        const parent = task({
            uid: 'parent-1',
            name: 'Parent',
            subtasks: [subtask],
        });
        const subtaskRow = task({ uid: 'sub-1', name: 'Sub row', size: null });
        const groups = {
            parents: [parent],
            subtasks: [subtaskRow],
        };

        const next = applyTaskSizeUpdateToGroups(groups, {
            uid: 'sub-1',
            size: 'L',
        });

        expect(next.parents[0].subtasks?.[0].size).toBe('L');
        expect(next.parents[0].size).toBeUndefined();
        expect(next.subtasks[0].size).toBe('L');
        expect(next.parents[0]).not.toBe(parent);
    });

    it('returns the same map when no section contains the uid', () => {
        const other = task({ uid: 'task-2', name: 'Other', size: 'S' });
        const groups = { later: [other] };

        expect(
            applyTaskSizeUpdateToGroups(groups, { uid: 'missing', size: 'L' })
        ).toBe(groups);
    });
});

describe('updateTask size protection', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                uid: 'task-1',
                name: 'Task',
                status: 0,
                size: 'L',
            }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('keeps size on the dedicated partial { size } write', async () => {
        await updateTask('task-1', { size: 'L' });

        const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
        expect(body).toEqual({ size: 'L' });
    });

    it('drops size and access_level from a full-task body such as completion undo', async () => {
        await updateTask('task-1', {
            ...task({
                uid: 'task-1',
                name: 'Task',
                size: 'S',
                access_level: 'rw',
            }),
            status: 0,
            completed_at: null,
        });

        const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
        expect(body).not.toHaveProperty('size');
        expect(body).not.toHaveProperty('access_level');
        expect(body.name).toBe('Task');
        expect(body.status).toBe(0);
    });
});
