const request = require('supertest');
const app = require('../../app');
const {
    Task,
    Project,
    Area,
    Tag,
    TaskEvent,
    Permission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

function futureDueDate() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(12, 0, 0, 0);
    return date;
}

async function login(email) {
    const agent = request.agent(app);
    const response = await agent
        .post('/api/login')
        .send({ email, password: 'password123' });
    expect(response.status).toBe(200);
    return agent;
}

async function grantTaskAccess(owner, collaborator, task, accessLevel) {
    await Permission.create({
        user_id: collaborator.id,
        resource_type: 'task',
        resource_uid: task.uid,
        access_level: accessLevel,
        propagation: 'direct',
        granted_by_user_id: owner.id,
    });
}

describe('Task size', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `size-owner-${Date.now()}@example.com`,
        });
        agent = await login(user.email);
    });

    describe('create and load', () => {
        it('stores null and the creator uid when the create body includes a size', async () => {
            const response = await agent
                .post('/api/task')
                .send({ name: 'Created task', size: 'L' });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('size', null);
            expect(response.body.user_uid).toBe(user.uid);
            expect(response.body).not.toHaveProperty('User');

            const stored = await Task.findByPk(response.body.id);
            expect(stored.size).toBeNull();
        });

        it('stores null size on a parent and each subtask and returns user_uid', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Parent',
                size: 'L',
                subtasks: [
                    { name: 'Child A', size: 'XL' },
                    { name: 'Child B', size: 'S' },
                ],
            });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('size', null);
            expect(response.body.user_uid).toBe(user.uid);
            expect(response.body.subtasks).toHaveLength(2);
            response.body.subtasks.forEach((subtask) => {
                expect(subtask).toHaveProperty('size', null);
                expect(subtask.user_uid).toBe(user.uid);
                expect(subtask).not.toHaveProperty('User');
            });

            const listed = await agent.get(
                `/api/task/${response.body.uid}/subtasks`
            );
            expect(listed.status).toBe(200);
            expect(listed.body).toHaveLength(2);
            listed.body.forEach((subtask) => {
                expect(subtask).toHaveProperty('size', null);
                expect(subtask.user_uid).toBe(user.uid);
            });
        });

        it('returns size null and user_uid when an existing task is loaded', async () => {
            const task = await Task.create({
                name: 'Existing',
                user_id: user.id,
            });

            const response = await agent.get(`/api/task/${task.uid}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('size', null);
            expect(response.body.user_uid).toBe(user.uid);
            expect(response.body).not.toHaveProperty('User');
        });
    });

    describe('owner updates', () => {
        it('persists S, M, L, XL, and null and returns size', async () => {
            const task = await Task.create({
                name: 'Resize me',
                user_id: user.id,
                size: 'S',
            });

            for (const size of ['S', 'M', 'L', 'XL', null]) {
                const response = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('size', size);

                const loaded = await agent.get(`/api/task/${task.uid}`);
                expect(loaded.status).toBe(200);
                expect(loaded.body).toHaveProperty('size', size);
            }
        });

        it('leaves a saved size when the body omits size', async () => {
            const task = await Task.create({
                name: 'Keep size',
                user_id: user.id,
                size: 'L',
                note: 'original',
            });

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ note: 'updated' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('L');

            await task.reload();
            expect(task.size).toBe('L');
            expect(task.note).toBe('updated');
        });

        it.each(['XX', 'm', ' M', 'null', 1])(
            'rejects size %s and leaves the stored size unchanged',
            async (size) => {
                const task = await Task.create({
                    name: 'Invalid update',
                    user_id: user.id,
                    size: 'M',
                });

                const response = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size });

                expect(response.status).toBe(400);
                expect(response.body).toEqual({ error: 'The size is invalid' });

                await task.reload();
                expect(task.size).toBe('M');
            }
        );
    });

    describe('who can change size', () => {
        async function taskOwnedBySomeoneElse(accessLevel) {
            const owner = user;
            const collaborator = await createTestUser({
                email: `size-collab-${accessLevel}-${Date.now()}@example.com`,
            });
            const task = await Task.create({
                name: 'Shared task',
                user_id: owner.id,
                priority: 0,
                size: 'S',
            });
            if (accessLevel) {
                await grantTaskAccess(owner, collaborator, task, accessLevel);
            }
            const collaboratorAgent = await login(collaborator.email);
            return { task, collaboratorAgent };
        }

        it('rejects a read-write collaborator size change', async () => {
            const { task, collaboratorAgent } =
                await taskOwnedBySomeoneElse('rw');

            const response = await collaboratorAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'L' });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Forbidden' });

            await task.reload();
            expect(task.size).toBe('S');
        });

        it('rejects a read-write collaborator size change sent with priority', async () => {
            const { task, collaboratorAgent } =
                await taskOwnedBySomeoneElse('rw');

            const response = await collaboratorAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'L', priority: 2 });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Forbidden' });

            await task.reload();
            expect(task.size).toBe('S');
            expect(task.priority).toBe(0);
        });

        it('rejects a read-only collaborator size change', async () => {
            const { task, collaboratorAgent } =
                await taskOwnedBySomeoneElse('ro');

            const response = await collaboratorAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'L' });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Forbidden' });

            await task.reload();
            expect(task.size).toBe('S');
        });

        it('rejects a size change from a user with no access', async () => {
            const { task, collaboratorAgent } =
                await taskOwnedBySomeoneElse(null);

            const response = await collaboratorAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'L' });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Forbidden' });

            await task.reload();
            expect(task.size).toBe('S');
        });
    });

    describe('size stays independent', () => {
        it('leaves priority, status, due date, project, area, tags, completion, and recurrence unchanged', async () => {
            const area = await Area.create({
                name: 'Area',
                user_id: user.id,
            });
            const project = await Project.create({
                name: 'Project',
                user_id: user.id,
            });
            const tag = await Tag.create({
                name: 'keep-tag',
                user_id: user.id,
            });
            const dueDate = new Date('2026-12-15T00:00:00.000Z');
            const completedAt = new Date('2026-10-01T08:30:00.000Z');
            const task = await Task.create({
                name: 'Stable task',
                user_id: user.id,
                priority: 1,
                status: Task.STATUS.DONE,
                due_date: dueDate,
                project_id: project.id,
                area_id: area.id,
                note: 'keep me',
                recurrence_type: 'weekly',
                completed_at: completedAt,
                size: null,
            });
            await task.setTags([tag]);

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'M' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('M');

            await task.reload();
            const tags = await task.getTags();
            expect(task.priority).toBe(1);
            expect(task.status).toBe(Task.STATUS.DONE);
            expect(new Date(task.due_date).toISOString()).toBe(
                dueDate.toISOString()
            );
            expect(task.project_id).toBe(project.id);
            expect(task.area_id).toBe(area.id);
            expect(task.note).toBe('keep me');
            expect(task.recurrence_type).toBe('weekly');
            expect(new Date(task.completed_at).toISOString()).toBe(
                completedAt.toISOString()
            );
            expect(tags.map((item) => item.name)).toEqual(['keep-tag']);
        });

        it('does not delete a future stored child or write a task event', async () => {
            const series = await Task.create({
                name: 'Daily series',
                user_id: user.id,
                recurrence_type: 'daily',
                priority: 0,
                size: 'S',
            });
            const child = await Task.create({
                name: 'Future child',
                user_id: user.id,
                recurring_parent_id: series.id,
                recurrence_type: 'none',
                due_date: futureDueDate(),
                size: 'M',
            });

            const response = await agent
                .patch(`/api/task/${series.uid}`)
                .send({ size: 'XL' });

            expect(response.status).toBe(200);

            const storedChild = await Task.findByPk(child.id);
            expect(storedChild).not.toBeNull();
            expect(storedChild.size).toBe('M');

            const events = await TaskEvent.findAll({
                where: { task_id: series.id },
            });
            expect(events).toHaveLength(0);
        });

        it('still deletes a future stored child and writes priority history when priority changes', async () => {
            const series = await Task.create({
                name: 'Daily series',
                user_id: user.id,
                recurrence_type: 'daily',
                priority: 0,
                size: 'S',
            });
            const child = await Task.create({
                name: 'Future child',
                user_id: user.id,
                recurring_parent_id: series.id,
                recurrence_type: 'none',
                due_date: futureDueDate(),
                size: 'M',
            });

            const response = await agent
                .patch(`/api/task/${series.uid}`)
                .send({ priority: 2 });

            expect(response.status).toBe(200);

            expect(await Task.findByPk(child.id)).toBeNull();
            await series.reload();
            expect(series.size).toBe('S');
            expect(series.priority).toBe(2);

            const events = await TaskEvent.findAll({
                where: { task_id: series.id },
            });
            expect(events.map((event) => event.event_type)).toContain(
                'priority_changed'
            );
        });

        it('keeps parent and subtask sizes independent', async () => {
            const parent = await Task.create({
                name: 'Parent',
                user_id: user.id,
                size: 'S',
            });
            const subtask = await Task.create({
                name: 'Subtask',
                user_id: user.id,
                parent_task_id: parent.id,
                size: 'M',
            });

            const parentResponse = await agent
                .patch(`/api/task/${parent.uid}`)
                .send({ size: 'L' });
            expect(parentResponse.status).toBe(200);

            await subtask.reload();
            expect(subtask.size).toBe('M');

            const subtaskResponse = await agent
                .patch(`/api/task/${subtask.uid}`)
                .send({ size: 'XL' });
            expect(subtaskResponse.status).toBe(200);

            await parent.reload();
            expect(parent.size).toBe('L');
            await subtask.reload();
            expect(subtask.size).toBe('XL');
        });

        it('keeps a series size and a stored child size independent', async () => {
            const series = await Task.create({
                name: 'Series',
                user_id: user.id,
                recurrence_type: 'daily',
                size: 'S',
            });
            const child = await Task.create({
                name: 'Stored child',
                user_id: user.id,
                recurring_parent_id: series.id,
                recurrence_type: 'none',
                due_date: futureDueDate(),
                size: 'M',
            });

            const seriesResponse = await agent
                .patch(`/api/task/${series.uid}`)
                .send({ size: 'XL' });
            expect(seriesResponse.status).toBe(200);

            const storedChild = await Task.findByPk(child.id);
            expect(storedChild).not.toBeNull();
            expect(storedChild.size).toBe('M');

            const childResponse = await agent
                .patch(`/api/task/${child.uid}`)
                .send({ size: 'L' });
            expect(childResponse.status).toBe(200);

            await series.reload();
            expect(series.size).toBe('XL');
            await storedChild.reload();
            expect(storedChild.size).toBe('L');
        });

        it('shows the series size on virtual upcoming rows', async () => {
            const dueDate = new Date();
            dueDate.setUTCHours(15, 0, 0, 0);
            const series = await Task.create({
                name: 'Upcoming series',
                user_id: user.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: dueDate,
                status: Task.STATUS.NOT_STARTED,
            });

            const saved = await agent
                .patch(`/api/task/${series.uid}`)
                .send({ size: 'L' });
            expect(saved.status).toBe(200);
            expect(saved.body.size).toBe('L');

            const response = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day'
            );
            expect(response.status).toBe(200);

            const virtualRows = response.body.tasks.filter(
                (task) => task.uid === series.uid && task.is_virtual_occurrence
            );
            expect(virtualRows.length).toBeGreaterThan(0);
            virtualRows.forEach((row) => {
                expect(row.size).toBe('L');
            });
        });
    });
});
