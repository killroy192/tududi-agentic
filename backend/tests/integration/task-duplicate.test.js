const request = require('supertest');
const app = require('../../app');
const {
    Task,
    Tag,
    Project,
    Area,
    Person,
    TaskAttachment,
    TaskEvent,
    Permission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/duplicate', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'duplicate@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'duplicate@example.com',
            password: 'password123',
        });
    });

    async function snapshot(task) {
        await task.reload();
        return {
            uid: task.uid,
            user_id: task.user_id,
            name: task.name,
            note: task.note,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date ? task.due_date.toISOString() : null,
            defer_until: task.defer_until
                ? task.defer_until.toISOString()
                : null,
            reminder_at: task.reminder_at
                ? task.reminder_at.toISOString()
                : null,
            completed_at: task.completed_at
                ? task.completed_at.toISOString()
                : null,
            recurrence_type: task.recurrence_type,
            recurrence_interval: task.recurrence_interval,
            recurring_parent_id: task.recurring_parent_id,
            completion_based: task.completion_based,
            project_id: task.project_id,
            area_id: task.area_id,
            parent_task_id: task.parent_task_id,
            order: task.order,
            assigned_to: task.getDataValue('assigned_to'),
            involves: task.getDataValue('involves'),
            ai_insights: task.ai_insights,
            habit_mode: task.habit_mode,
            habit_target_count: task.habit_target_count,
            habit_frequency_period: task.habit_frequency_period,
            habit_streak_mode: task.habit_streak_mode,
            habit_flexibility_mode: task.habit_flexibility_mode,
            habit_current_streak: task.habit_current_streak,
            habit_best_streak: task.habit_best_streak,
            habit_total_completions: task.habit_total_completions,
            habit_last_completion_at: task.habit_last_completion_at
                ? task.habit_last_completion_at.toISOString()
                : null,
        };
    }

    it('copies the stored details and resets schedule, status, people, and habit progress', async () => {
        const area = await Area.create({
            name: 'Home',
            user_id: user.id,
        });
        const project = await Project.create({
            name: 'House',
            user_id: user.id,
            area_id: area.id,
        });
        const series = await Task.create({
            name: 'Series',
            user_id: user.id,
            recurrence_type: 'daily',
        });
        const person = await Person.create({
            name: 'Alex',
            user_id: user.id,
        });
        const home = await Tag.create({ name: 'home', user_id: user.id });
        const urgent = await Tag.create({ name: 'urgent', user_id: user.id });

        const source = await Task.create({
            name: 'Pay rent',
            note: 'Transfer before Friday',
            priority: Task.PRIORITY.HIGH,
            status: Task.STATUS.DONE,
            completed_at: new Date('2026-04-02T10:00:00.000Z'),
            due_date: new Date('2026-05-01T00:00:00.000Z'),
            defer_until: new Date('2026-04-01T00:00:00.000Z'),
            reminder_at: new Date('2026-04-20T09:00:00.000Z'),
            recurrence_type: 'daily',
            recurrence_interval: 1,
            recurrence_weekday: 1,
            recurrence_weekdays: [1, 3],
            recurrence_month_day: 1,
            recurrence_week_of_month: 2,
            recurrence_end_date: new Date('2026-12-31T00:00:00.000Z'),
            completion_based: true,
            recurring_parent_id: series.id,
            project_id: project.id,
            area_id: area.id,
            user_id: user.id,
            assigned_to: person.uid,
            involves: [person.uid],
            ai_insights: { summary: 'Do not copy' },
            habit_mode: true,
            habit_target_count: 3,
            habit_frequency_period: 'weekly',
            habit_streak_mode: 'scheduled',
            habit_flexibility_mode: 'strict',
            habit_current_streak: 4,
            habit_best_streak: 9,
            habit_total_completions: 12,
            habit_last_completion_at: new Date('2026-04-03T10:00:00.000Z'),
        });
        await source.setTags([home, urgent]);
        await TaskAttachment.create({
            task_id: source.id,
            user_id: user.id,
            original_filename: 'lease.pdf',
            stored_filename: 'lease.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            file_path: 'tasks/lease.pdf',
        });
        await TaskEvent.create({
            task_id: source.id,
            user_id: user.id,
            event_type: 'created',
            field_name: 'name',
            new_value: 'Pay rent',
        });

        const before = await snapshot(source);
        const response = await agent.post(`/api/task/${source.uid}/duplicate`);

        expect(response.status).toBe(201);
        expect(response.body.uid).not.toBe(source.uid);
        expect(response.body.id).not.toBe(source.id);
        expect(response.body.user_id).toBe(user.id);
        expect(response.body.name).toBe('Pay rent');
        expect(response.body.note).toBe('Transfer before Friday');
        expect(response.body.priority).toBe(Task.PRIORITY.HIGH);
        expect(response.body.project_id).toBe(project.id);
        expect(response.body.area_id).toBe(area.id);
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.due_date).toBeNull();
        expect(response.body.defer_until).toBeNull();
        expect(response.body.reminder_at).toBeNull();
        expect(response.body.recurrence_type).toBe('none');
        expect(response.body.recurring_parent_id).toBeNull();
        expect(response.body.completion_based).toBe(false);
        expect(response.body.parent_task_id).toBeNull();
        expect(response.body.order).toBeNull();
        expect(response.body.assigned_to).toBeNull();
        expect(response.body.involves || []).toEqual([]);
        expect(response.body.ai_insights).toBeNull();
        expect(response.body.habit_mode).toBe(true);
        expect(response.body.habit_target_count).toBe(3);
        expect(response.body.habit_frequency_period).toBe('weekly');
        expect(response.body.habit_streak_mode).toBe('scheduled');
        expect(response.body.habit_flexibility_mode).toBe('strict');
        expect(response.body.habit_current_streak).toBe(0);
        expect(response.body.habit_best_streak).toBe(0);
        expect(response.body.habit_total_completions).toBe(0);
        expect(response.body.habit_last_completion_at).toBeNull();
        expect(response.body.tags.map((tag) => tag.name).sort()).toEqual([
            'home',
            'urgent',
        ]);
        expect(response.body.subtasks).toEqual([]);

        const copy = await Task.findOne({ where: { uid: response.body.uid } });
        expect(copy.user_id).toBe(user.id);
        expect(
            await TaskAttachment.count({ where: { task_id: copy.id } })
        ).toBe(0);
        expect(await TaskEvent.count({ where: { task_id: copy.id } })).toBe(0);
        expect(
            await Task.count({ where: { recurring_parent_id: copy.id } })
        ).toBe(0);

        expect(await snapshot(source)).toEqual(before);
        expect((await source.getTags()).map((tag) => tag.name).sort()).toEqual([
            'home',
            'urgent',
        ]);
        expect(
            await TaskAttachment.count({ where: { task_id: source.id } })
        ).toBe(1);
        expect(await TaskEvent.count({ where: { task_id: source.id } })).toBe(
            1
        );
    });

    it('copies direct subtasks in order and skips grandchildren', async () => {
        const parent = await Task.create({
            name: 'Parent',
            note: 'Keep me',
            user_id: user.id,
            status: Task.STATUS.IN_PROGRESS,
        });
        const tag = await Tag.create({ name: 'step', user_id: user.id });
        const first = await Task.create({
            name: 'First step',
            note: 'Do this',
            priority: Task.PRIORITY.MEDIUM,
            status: Task.STATUS.DONE,
            completed_at: new Date('2026-04-02T10:00:00.000Z'),
            due_date: new Date('2026-05-01T00:00:00.000Z'),
            parent_task_id: parent.id,
            order: 1,
            user_id: user.id,
        });
        await first.setTags([tag]);
        const second = await Task.create({
            name: 'Second step',
            parent_task_id: parent.id,
            order: 2,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });
        const grandchild = await Task.create({
            name: 'Nested step',
            parent_task_id: first.id,
            order: 1,
            user_id: user.id,
        });

        const response = await agent.post(`/api/task/${parent.uid}/duplicate`);

        expect(response.status).toBe(201);
        expect(response.body.uid).not.toBe(parent.uid);
        expect(response.body.name).toBe('Parent');
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.subtasks.map((subtask) => subtask.name)).toEqual([
            'First step',
            'Second step',
        ]);

        const copiedFirst = response.body.subtasks[0];
        const copiedSecond = response.body.subtasks[1];
        expect(copiedFirst.uid).not.toBe(first.uid);
        expect(copiedSecond.uid).not.toBe(second.uid);
        expect(copiedFirst.status).toBe(Task.STATUS.NOT_STARTED);
        expect(copiedFirst.completed_at).toBeNull();
        expect(copiedFirst.due_date).toBeNull();
        expect(copiedFirst.note).toBe('Do this');
        expect(copiedFirst.priority).toBe(Task.PRIORITY.MEDIUM);
        expect(copiedFirst.order).toBe(1);
        expect(copiedSecond.order).toBe(2);
        expect(copiedFirst.tags.map((item) => item.name)).toEqual(['step']);

        const copiedFirstRow = await Task.findOne({
            where: { uid: copiedFirst.uid },
        });
        expect(copiedFirstRow.parent_task_id).toBe(response.body.id);
        expect(
            await Task.count({
                where: { parent_task_id: copiedFirstRow.id },
            })
        ).toBe(0);
        expect(await Task.findByPk(grandchild.id)).not.toBeNull();
        expect((await Task.findByPk(parent.id)).status).toBe(
            Task.STATUS.IN_PROGRESS
        );
    });

    it('inserts a duplicated subtask immediately after the original', async () => {
        const parent = await Task.create({
            name: 'Checklist',
            user_id: user.id,
        });
        const first = await Task.create({
            name: 'A',
            parent_task_id: parent.id,
            order: 1,
            user_id: user.id,
        });
        const middle = await Task.create({
            name: 'B',
            parent_task_id: parent.id,
            order: 2,
            user_id: user.id,
            status: Task.STATUS.DONE,
            completed_at: new Date('2026-04-02T10:00:00.000Z'),
        });
        const last = await Task.create({
            name: 'C',
            parent_task_id: parent.id,
            order: 3,
            user_id: user.id,
        });

        const response = await agent.post(`/api/task/${middle.uid}/duplicate`);

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('B');
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.parent_task_id).toBe(parent.id);
        expect(response.body.order).toBe(3);
        expect(response.body.uid).not.toBe(middle.uid);

        const siblings = await Task.findAll({
            where: { parent_task_id: parent.id },
            order: [
                ['order', 'ASC'],
                ['id', 'ASC'],
            ],
        });
        expect(
            siblings.map((sibling) => [sibling.name, sibling.order])
        ).toEqual([
            ['A', 1],
            ['B', 2],
            ['B', 3],
            ['C', 4],
        ]);
        expect(siblings[0].uid).toBe(first.uid);
        expect(siblings[1].uid).toBe(middle.uid);
        expect(siblings[2].uid).toBe(response.body.uid);
        expect(siblings[3].uid).toBe(last.uid);
        expect((await middle.reload()).status).toBe(Task.STATUS.DONE);
    });

    it('appends a subtask copy when the original has no order', async () => {
        const parent = await Task.create({
            name: 'Unordered',
            user_id: user.id,
        });
        const numbered = await Task.create({
            name: 'Numbered',
            parent_task_id: parent.id,
            order: 4,
            user_id: user.id,
        });
        const source = await Task.create({
            name: 'Unsorted',
            parent_task_id: parent.id,
            order: null,
            user_id: user.id,
        });

        const response = await agent.post(`/api/task/${source.uid}/duplicate`);

        expect(response.status).toBe(201);
        expect(response.body.parent_task_id).toBe(parent.id);
        expect(response.body.order).toBe(5);
        expect((await numbered.reload()).order).toBe(4);
        expect((await source.reload()).order).toBeNull();
    });

    it('returns 404 when the task does not exist', async () => {
        const response = await agent.post(
            '/api/task/missing-task-uid/duplicate'
        );

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Task not found.');
    });

    it('returns 403 when the user cannot write the task', async () => {
        const source = await Task.create({
            name: 'Shared',
            user_id: user.id,
            note: 'Original',
        });
        const reader = await createTestUser({
            email: 'reader@example.com',
        });
        await Permission.create({
            user_id: reader.id,
            resource_type: 'task',
            resource_uid: source.uid,
            access_level: 'ro',
            granted_by_user_id: user.id,
        });

        const readerAgent = request.agent(app);
        await readerAgent.post('/api/login').send({
            email: 'reader@example.com',
            password: 'password123',
        });

        const beforeCount = await Task.count();
        const response = await readerAgent.post(
            `/api/task/${source.uid}/duplicate`
        );

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(await Task.count()).toBe(beforeCount);
        expect((await source.reload()).note).toBe('Original');
    });

    it('requires authentication', async () => {
        const source = await Task.create({
            name: 'Private',
            user_id: user.id,
        });

        const response = await request(app).post(
            `/api/task/${source.uid}/duplicate`
        );

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
    });
});
