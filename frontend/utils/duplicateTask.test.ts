import { Task } from '../entities/Task';
import { buildDuplicateTaskPayload } from './duplicateTask';

const baseTask = (overrides: Partial<Task> = {}): Task => ({
    id: 42,
    uid: 'source-uid',
    name: 'Write report',
    status: 'done',
    completed_at: '2026-01-15T10:00:00.000Z',
    priority: 'high',
    note: 'Include Q1 metrics',
    due_date: '2026-01-20',
    defer_until: '2026-01-18',
    reminder_at: '2026-01-19T09:00:00.000Z',
    project_uid: 'proj-uid',
    area_uid: 'area-uid',
    tags: [{ id: 1, uid: 'tag-uid', name: 'work' }],
    assigned_to: 'person-uid',
    involves: ['person-a', 'person-b'],
    recurrence_type: 'weekly',
    recurrence_interval: 1,
    recurrence_weekday: 1,
    completion_based: false,
    parent_task_id: 99,
    recurring_parent_id: 7,
    recurring_parent_uid: 'recurring-parent-uid',
    attachments: [{ id: 1, filename: 'doc.pdf' } as any],
    habit_mode: true,
    habit_current_streak: 5,
    habit_best_streak: 10,
    habit_total_completions: 20,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-15T00:00:00.000Z',
    subtasks: [
        {
            id: 100,
            uid: 'sub-1',
            name: 'Gather data',
            status: 'done',
            completed_at: '2026-01-10T00:00:00.000Z',
            priority: 'medium',
        },
        {
            id: 101,
            uid: 'sub-2',
            name: 'Draft outline',
            status: 'in_progress',
            completed_at: null,
            priority: 'low',
        },
    ],
    ...overrides,
});

describe('buildDuplicateTaskPayload', () => {
    it('appends (copy) to the title and prefers original_name', () => {
        const fromName = buildDuplicateTaskPayload(baseTask());
        expect(fromName.name).toBe('Write report (copy)');

        const fromOriginal = buildDuplicateTaskPayload(
            baseTask({ original_name: 'Monthly Report', name: 'Monthly' })
        );
        expect(fromOriginal.name).toBe('Monthly Report (copy)');
    });

    it('resets completion state and clears scheduling fields', () => {
        const payload = buildDuplicateTaskPayload(baseTask());

        expect(payload.status).toBe('not_started');
        expect(payload.completed_at).toBeNull();
        expect(payload.due_date).toBeUndefined();
        expect(payload.defer_until).toBeUndefined();
        expect(payload.reminder_at).toBeUndefined();
    });

    it('copies core details, people, recurrence, and parent', () => {
        const payload = buildDuplicateTaskPayload(baseTask());

        expect(payload.note).toBe('Include Q1 metrics');
        expect(payload.priority).toBe('high');
        expect(payload.project_uid).toBe('proj-uid');
        expect(payload.area_uid).toBe('area-uid');
        expect(payload.tags).toEqual([{ name: 'work' }]);
        expect(payload.assigned_to).toBe('person-uid');
        expect(payload.involves).toEqual(['person-a', 'person-b']);
        expect(payload.recurrence_type).toBe('weekly');
        expect(payload.recurrence_interval).toBe(1);
        expect(payload.recurrence_weekday).toBe(1);
        expect(payload.completion_based).toBe(false);
        expect(payload.parent_task_id).toBe(99);
    });

    it('copies subtasks as incomplete without ids', () => {
        const payload = buildDuplicateTaskPayload(baseTask());

        expect(payload.subtasks).toEqual([
            {
                name: 'Gather data',
                priority: 'medium',
                status: 'not_started',
                completed_at: null,
            },
            {
                name: 'Draft outline',
                priority: 'low',
                status: 'not_started',
                completed_at: null,
            },
        ]);
        expect(payload.subtasks?.[0]).not.toHaveProperty('id');
        expect(payload.subtasks?.[0]).not.toHaveProperty('uid');
    });

    it('omits identity, attachments, habit state, and recurring parent links', () => {
        const payload = buildDuplicateTaskPayload(baseTask());

        expect(payload.id).toBeUndefined();
        expect(payload.uid).toBeUndefined();
        expect(payload.attachments).toBeUndefined();
        expect(payload.habit_mode).toBeUndefined();
        expect(payload.habit_current_streak).toBeUndefined();
        expect(payload.habit_best_streak).toBeUndefined();
        expect(payload.habit_total_completions).toBeUndefined();
        expect(payload.recurring_parent_id).toBeUndefined();
        expect(payload.recurring_parent_uid).toBeUndefined();
        expect(payload.created_at).toBeUndefined();
        expect(payload.updated_at).toBeUndefined();
    });

    it('falls back to project_id and area_id when uids are missing', () => {
        const payload = buildDuplicateTaskPayload(
            baseTask({
                project_uid: undefined,
                area_uid: undefined,
                project_id: 5,
                area_id: 8,
            })
        );

        expect(payload.project_id).toBe(5);
        expect(payload.area_id).toBe(8);
        expect(payload.project_uid).toBeUndefined();
        expect(payload.area_uid).toBeUndefined();
    });
});
