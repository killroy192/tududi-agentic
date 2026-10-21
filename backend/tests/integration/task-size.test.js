const request = require('supertest');
const app = require('../../app');
const { Task, TaskEvent, Tag, Project, Area, Permission } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task size', () => {
    let owner, collaborator, reader, stranger;
    let ownerAgent, collaboratorAgent, readerAgent, strangerAgent;

    beforeEach(async () => {
        owner = await createTestUser({
            email: `owner_${Date.now()}@example.com`,
        });
        collaborator = await createTestUser({
            email: `rw_${Date.now()}@example.com`,
        });
        reader = await createTestUser({
            email: `ro_${Date.now()}@example.com`,
        });
        stranger = await createTestUser({
            email: `none_${Date.now()}@example.com`,
        });

        ownerAgent = request.agent(app);
        collaboratorAgent = request.agent(app);
        readerAgent = request.agent(app);
        strangerAgent = request.agent(app);

        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });
        await collaboratorAgent
            .post('/api/login')
            .send({ email: collaborator.email, password: 'password123' });
        await readerAgent
            .post('/api/login')
            .send({ email: reader.email, password: 'password123' });
        await strangerAgent
            .post('/api/login')
            .send({ email: stranger.email, password: 'password123' });
    });

    async function shareTask(task, user, accessLevel) {
        await Permission.create({
            user_id: user.id,
            resource_type: 'task',
            resource_uid: task.uid,
            access_level: accessLevel,
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });
    }

    describe('create and load', () => {
        it('stores null when a task is created, including a client-supplied size', async () => {
            const response = await ownerAgent.post('/api/task').send({
                name: 'Created task',
                size: 'L',
                priority: 1,
            });

            expect(response.status).toBe(201);
            expect(response.body.size).toBeNull();
            expect(response.body.user_uid).toBe(owner.uid);

            const stored = await Task.findByPk(response.body.id);
            expect(stored.size).toBeNull();
        });

        it('stores null when a subtask is created with a size', async () => {
            const response = await ownerAgent.post('/api/task').send({
                name: 'Parent',
                subtasks: [{ name: 'Child step', size: 'XL' }],
            });

            expect(response.status).toBe(201);
            expect(response.body.size).toBeNull();
            expect(response.body.user_uid).toBe(owner.uid);
            expect(response.body.subtasks).toHaveLength(1);
            expect(response.body.subtasks[0].size).toBeNull();
            expect(response.body.subtasks[0].user_uid).toBe(owner.uid);

            const storedChild = await Task.findOne({
                where: { parent_task_id: response.body.id },
            });
            expect(storedChild.size).toBeNull();
        });

        it('returns size null and user_uid for an existing task', async () => {
            const task = await Task.create({
                name: 'Existing',
                user_id: owner.id,
            });

            const response = await ownerAgent.get(`/api/task/${task.uid}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('size', null);
            expect(response.body.user_uid).toBe(owner.uid);
        });
    });

    describe('owner updates', () => {
        let task;

        beforeEach(async () => {
            const project = await Project.create({
                name: 'Size project',
                user_id: owner.id,
            });
            const area = await Area.create({
                name: 'Size area',
                user_id: owner.id,
            });
            task = await Task.create({
                name: 'Sized',
                user_id: owner.id,
                priority: 1,
                status: 0,
                due_date: new Date('2026-11-02T00:00:00Z'),
                project_id: project.id,
                area_id: area.id,
                recurrence_type: 'none',
                completed_at: null,
            });
            const tag = await Tag.create({
                name: `size-tag-${Date.now()}`,
                user_id: owner.id,
            });
            await task.setTags([tag]);
        });

        it.each([
            ['S', 'S'],
            ['M', 'M'],
            ['L', 'L'],
            ['XL', 'XL'],
            [null, null],
        ])('persists size %j', async (size, expected) => {
            const response = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe(expected);
            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe(expected);
        });

        it('leaves a saved size unchanged when size is omitted', async () => {
            await task.update({ size: 'M' });

            const response = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ note: 'still medium' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('M');
            expect(response.body.note).toBe('still medium');
        });

        it.each(['XX', 'm', ' M ', 'null'])(
            'rejects invalid size %j and leaves the stored size',
            async (size) => {
                await task.update({ size: 'S' });

                const response = await ownerAgent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size });

                expect(response.status).toBe(400);
                expect(response.body.error).toBe('The size is invalid');
                const stored = await Task.findByPk(task.id);
                expect(stored.size).toBe('S');
            }
        );

        it('does not change priority, status, dates, project, area, tags, completion, or recurrence', async () => {
            const before = await Task.findByPk(task.id, { include: [Tag] });

            const response = await ownerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'L' });

            expect(response.status).toBe(200);
            const after = await Task.findByPk(task.id, { include: [Tag] });
            expect(after.priority).toBe(before.priority);
            expect(after.status).toBe(before.status);
            expect(new Date(after.due_date).toISOString()).toBe(
                new Date(before.due_date).toISOString()
            );
            expect(after.project_id).toBe(before.project_id);
            expect(after.area_id).toBe(before.area_id);
            expect(after.completed_at).toBeNull();
            expect(after.recurrence_type).toBe(before.recurrence_type);
            expect(after.Tags.map((tag) => tag.id)).toEqual(
                before.Tags.map((tag) => tag.id)
            );
        });
    });

    describe('access', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Shared size',
                user_id: owner.id,
                priority: 0,
                size: 'M',
            });
            await shareTask(task, collaborator, 'rw');
            await shareTask(task, reader, 'ro');
        });

        it('rejects a read-write collaborator and leaves the size unchanged', async () => {
            const response = await collaboratorAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'L', priority: 2 });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe('M');
            expect(stored.priority).toBe(0);
        });

        it('rejects a read-only user and leaves the size unchanged', async () => {
            const response = await readerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'S' });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe('M');
        });

        it('rejects a user who cannot view the task and leaves the size unchanged', async () => {
            const response = await strangerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'XL' });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe('M');
        });
    });

    describe('recurrence and history', () => {
        it('does not delete a future child or write history for a size-only update', async () => {
            const series = await Task.create({
                name: 'Series',
                user_id: owner.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: new Date('2026-11-01T00:00:00Z'),
                priority: 0,
                size: 'S',
            });
            const child = await Task.create({
                name: 'Future child',
                user_id: owner.id,
                recurring_parent_id: series.id,
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                size: 'M',
                priority: 0,
            });

            const response = await ownerAgent
                .patch(`/api/task/${series.uid}`)
                .send({ size: 'XL' });

            expect(response.status).toBe(200);
            const storedChild = await Task.findByPk(child.id);
            expect(storedChild).not.toBeNull();
            expect(storedChild.size).toBe('M');
            const events = await TaskEvent.count({
                where: { task_id: series.id },
            });
            expect(events).toBe(0);

            const storedSeries = await Task.findByPk(series.id);
            expect(storedSeries.size).toBe('XL');
            expect(storedSeries.priority).toBe(0);
        });

        it('still deletes future children and writes priority history when priority changes', async () => {
            const series = await Task.create({
                name: 'Series priority',
                user_id: owner.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: new Date('2026-11-01T00:00:00Z'),
                priority: 0,
                size: 'S',
            });
            const child = await Task.create({
                name: 'Future child',
                user_id: owner.id,
                recurring_parent_id: series.id,
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                size: 'M',
            });

            const response = await ownerAgent
                .patch(`/api/task/${series.uid}`)
                .send({ priority: 2 });

            expect(response.status).toBe(200);
            expect(await Task.findByPk(child.id)).toBeNull();
            const storedSeries = await Task.findByPk(series.id);
            expect(storedSeries.priority).toBe(2);
            expect(storedSeries.size).toBe('S');
            const events = await TaskEvent.findAll({
                where: { task_id: series.id },
            });
            expect(events.length).toBeGreaterThan(0);
            expect(
                events.some(
                    (event) =>
                        event.event_type === 'priority_changed' ||
                        event.field_name === 'priority'
                )
            ).toBe(true);
        });
    });

    describe('independent records', () => {
        it('keeps parent and subtask sizes independent', async () => {
            const parent = await Task.create({
                name: 'Parent',
                user_id: owner.id,
                size: 'S',
            });
            const subtask = await Task.create({
                name: 'Subtask',
                user_id: owner.id,
                parent_task_id: parent.id,
                size: 'M',
            });

            const parentResponse = await ownerAgent
                .patch(`/api/task/${parent.uid}`)
                .send({ size: 'L' });
            expect(parentResponse.status).toBe(200);
            expect((await Task.findByPk(subtask.id)).size).toBe('M');

            const subtaskResponse = await ownerAgent
                .patch(`/api/task/${subtask.uid}`)
                .send({ size: 'XL' });
            expect(subtaskResponse.status).toBe(200);
            expect((await Task.findByPk(parent.id)).size).toBe('L');
            expect((await Task.findByPk(subtask.id)).size).toBe('XL');
        });

        it('keeps a series size and a stored child size independent', async () => {
            const series = await Task.create({
                name: 'Series',
                user_id: owner.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: new Date(),
                size: 'S',
            });
            const childOwner = await createTestUser({
                email: `child_${Date.now()}@example.com`,
            });
            const childAgent = request.agent(app);
            await childAgent
                .post('/api/login')
                .send({ email: childOwner.email, password: 'password123' });
            const child = await Task.create({
                name: 'Stored child',
                user_id: childOwner.id,
                recurring_parent_id: series.id,
                due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                size: 'M',
            });

            const seriesResponse = await ownerAgent
                .patch(`/api/task/${series.uid}`)
                .send({ size: 'L' });
            expect(seriesResponse.status).toBe(200);
            expect((await Task.findByPk(child.id)).size).toBe('M');
            expect(await Task.findByPk(child.id)).not.toBeNull();

            const childResponse = await childAgent
                .patch(`/api/task/${child.uid}`)
                .send({ size: 'XL' });
            expect(childResponse.status).toBe(200);
            expect((await Task.findByPk(series.id)).size).toBe('L');
        });

        it('shows the series size on virtual upcoming rows', async () => {
            await Task.create({
                name: 'Daily series',
                user_id: owner.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: new Date(),
                size: 'M',
                status: 0,
            });

            const response = await ownerAgent.get(
                '/api/tasks?type=upcoming&groupBy=day'
            );

            expect(response.status).toBe(200);
            const virtualRows = response.body.tasks.filter(
                (task) => task.is_virtual_occurrence
            );
            expect(virtualRows.length).toBeGreaterThan(0);
            virtualRows.forEach((row) => {
                expect(row.size).toBe('M');
            });
        });
    });

    describe('CalDAV', () => {
        it('leaves the stored size in place when a calendar update is written', async () => {
            const task = await Task.create({
                name: 'Calendar task',
                user_id: owner.id,
                uid: `caldav-size-${Date.now()}`,
                size: 'M',
                status: 0,
            });
            const vtodo = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Test//EN',
                'BEGIN:VTODO',
                `UID:${task.uid}`,
                'SUMMARY:Renamed from calendar',
                'STATUS:NEEDS-ACTION',
                'END:VTODO',
                'END:VCALENDAR',
            ].join('\r\n');
            expect(vtodo).not.toMatch(/^SIZE[:;]/m);

            const authHeader =
                'Basic ' +
                Buffer.from(`${owner.email}:password123`).toString('base64');

            const response = await request(app)
                .put(
                    `/caldav/${encodeURIComponent(owner.email)}/tasks/${task.uid}.ics`
                )
                .set('Authorization', authHeader)
                .set('Content-Type', 'text/calendar')
                .send(vtodo);

            expect(response.status).toBe(204);
            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe('M');
            expect(stored.name).toBe('Renamed from calendar');
        });
    });
});
