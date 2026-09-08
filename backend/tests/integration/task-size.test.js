const request = require('supertest');
const app = require('../../app');
const { Task, TaskEvent, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task size', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `size_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('model and create (AC-1, AC-3)', () => {
        it('creates a task without size as unset (null)', async () => {
            const response = await agent.post('/api/task').send({
                name: 'No size task',
            });

            expect(response.status).toBe(201);
            expect(response.body.size).toBeNull();

            const stored = await Task.findByPk(response.body.id);
            expect(stored.size).toBeNull();
            expect(Task.rawAttributes.size.defaultValue).toBeUndefined();
        });

        it('accepts integer and string size forms', async () => {
            const intRes = await agent
                .post('/api/task')
                .send({ name: 'Sized int', size: 3 });
            expect(intRes.status).toBe(201);
            expect(intRes.body.size).toBe(3);

            const strRes = await agent
                .post('/api/task')
                .send({ name: 'Sized str', size: 'xl' });
            expect(strRes.status).toBe(201);
            expect(strRes.body.size).toBe(4);
        });

        it('rejects out-of-set size with field-named error (AC-16)', async () => {
            const response = await agent.post('/api/task').send({
                name: 'Bad size',
                size: 99,
            });

            expect(response.status).toBe(400);
            expect(response.body.field).toBe('size');
            expect(
                await Task.findOne({ where: { name: 'Bad size', user_id: user.id } })
            ).toBeNull();
        });
    });

    describe('update (AC-8, AC-10, AC-11, AC-12, AC-15)', () => {
        let task;

        beforeEach(async () => {
            const created = await agent.post('/api/task').send({
                name: 'Size update target',
                priority: 1,
                size: 2,
            });
            task = created.body;
        });

        it('updates only size and leaves priority unchanged (AC-8, AC-12)', async () => {
            const before = await Task.findByPk(task.id);
            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 4 });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe(4);
            expect(response.body.priority).toBe(before.priority);

            const events = await TaskEvent.findAll({
                where: { task_id: task.id },
            });
            const sizeEvents = events.filter((e) => e.event_type === 'size_changed');
            const priorityEvents = events.filter(
                (e) => e.event_type === 'priority_changed'
            );
            expect(sizeEvents).toHaveLength(1);
            expect(priorityEvents).toHaveLength(0);
        });

        it('clears size to null via null (AC-10)', async () => {
            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: null });

            expect(response.status).toBe(200);
            expect(response.body.size).toBeNull();

            const omitRes = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ note: 'still unset' });
            expect(omitRes.status).toBe(200);
            expect(omitRes.body.size).toBeNull();
        });

        it('omitting size leaves existing size unchanged (AC-15)', async () => {
            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ note: 'touch note only' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe(2);
        });

        it('re-selecting the same size creates no timeline entry (AC-11)', async () => {
            const beforeCount = await TaskEvent.count({
                where: { task_id: task.id, event_type: 'size_changed' },
            });

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 2 });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe(2);

            const afterCount = await TaskEvent.count({
                where: { task_id: task.id, event_type: 'size_changed' },
            });
            expect(afterCount).toBe(beforeCount);
        });

        it('rejects invalid size without persisting (AC-16)', async () => {
            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'huge' });

            expect(response.status).toBe(400);
            expect(response.body.field).toBe('size');

            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe(2);
        });

        it('string form of current size does not create a phantom event (AC-11)', async () => {
            const beforeCount = await TaskEvent.count({
                where: { task_id: task.id, event_type: 'size_changed' },
            });

            await agent.patch(`/api/task/${task.uid}`).send({ size: 'm' });

            const afterCount = await TaskEvent.count({
                where: { task_id: task.id, event_type: 'size_changed' },
            });
            expect(afterCount).toBe(beforeCount);
        });
    });

    describe('timeline (AC-17, AC-18)', () => {
        it('records both sides for unset→S, S→unset, S→XL, XL→S', async () => {
            const created = await agent
                .post('/api/task')
                .send({ name: 'Timeline size' });
            const uid = created.body.uid;
            const id = created.body.id;

            const transitions = [
                { size: 1 },
                { size: null },
                { size: 1 },
                { size: 4 },
                { size: 1 },
            ];

            for (const body of transitions) {
                const res = await agent.patch(`/api/task/${uid}`).send(body);
                expect(res.status).toBe(200);
            }

            const events = await TaskEvent.findAll({
                where: { task_id: id, event_type: 'size_changed' },
                order: [['id', 'ASC']],
            });

            expect(events.length).toBeGreaterThanOrEqual(4);

            const pairs = events.map((e) => [
                e.old_value?.size ?? null,
                e.new_value?.size ?? null,
            ]);

            expect(pairs).toEqual(
                expect.arrayContaining([
                    [null, 1],
                    [1, null],
                    [1, 4],
                    [4, 1],
                ])
            );
        });

        it('size change succeeds even if timeline write fails (AC-18)', async () => {
            const created = await agent
                .post('/api/task')
                .send({ name: 'Timeline fail', size: 1 });

            const originalCreate = TaskEvent.create;
            TaskEvent.create = jest.fn().mockRejectedValue(new Error('boom'));

            try {
                const response = await agent
                    .patch(`/api/task/${created.body.uid}`)
                    .send({ size: 3 });

                expect(response.status).toBe(200);
                expect(response.body.size).toBe(3);

                const stored = await Task.findByPk(created.body.id);
                expect(stored.size).toBe(3);
            } finally {
                TaskEvent.create = originalCreate;
            }
        });
    });

    describe('authorization (AC-14)', () => {
        it('rejects size change from read-only share', async () => {
            const owner = await createTestUser({
                email: `owner_size_${Date.now()}@example.com`,
            });
            const reader = await createTestUser({
                email: `reader_size_${Date.now()}@example.com`,
            });

            const ownerAgent = request.agent(app);
            await ownerAgent.post('/api/login').send({
                email: owner.email,
                password: 'password123',
            });

            const projectRes = await ownerAgent.post('/api/project').send({
                name: 'RO Share Project',
            });
            const project = projectRes.body;

            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: reader.email,
                access_level: 'ro',
            });

            const taskRes = await ownerAgent.post('/api/task').send({
                name: 'Shared sized task',
                project_id: project.id,
                size: 2,
            });
            const task = taskRes.body;

            const readerAgent = request.agent(app);
            await readerAgent.post('/api/login').send({
                email: reader.email,
                password: 'password123',
            });

            const response = await readerAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 4 });

            expect(response.status).toBe(403);

            const stored = await Task.findByPk(task.id);
            expect(stored.size).toBe(2);
        });
    });

    describe('recurrence (AC-19)', () => {
        it('setting size on recurring parent does not destroy future instances', async () => {
            const created = await agent.post('/api/task').send({
                name: 'Recurring parent',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: '2030-01-01',
                size: 1,
            });
            const parent = created.body;

            // Generate / ensure children exist by fetching tasks or creating instances
            // Many installs create instances lazily; seed one child linked to parent
            const child = await Task.create({
                name: 'Recurring parent',
                user_id: user.id,
                recurrence_type: 'none',
                recurring_parent_id: parent.id,
                due_date: new Date('2030-01-02'),
                status: 0,
                priority: 0,
            });

            const beforeIds = [child.id];
            const beforeDue = child.due_date?.toISOString();

            const response = await agent
                .patch(`/api/task/${parent.uid}`)
                .send({ size: 4 });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe(4);

            const stillThere = await Task.findByPk(child.id);
            expect(stillThere).not.toBeNull();
            expect(stillThere.id).toBe(beforeIds[0]);
            expect(stillThere.due_date?.toISOString()).toBe(beforeDue);
        });
    });

    describe('backward compatibility (AC-29)', () => {
        it('create/read/update without size continue to work', async () => {
            const created = await agent.post('/api/task').send({
                name: 'Legacy client task',
                priority: 0,
                status: 0,
            });
            expect(created.status).toBe(201);

            const fetched = await agent.get(`/api/task/${created.body.uid}`);
            expect(fetched.status).toBe(200);
            expect(fetched.body.name).toBe('Legacy client task');

            const updated = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ name: 'Legacy renamed' });
            expect(updated.status).toBe(200);
            expect(updated.body.name).toBe('Legacy renamed');
        });
    });

    describe('OpenAPI contract (AC-28)', () => {
        it('read endpoint returns size as integer or null', async () => {
            const created = await agent
                .post('/api/task')
                .send({ name: 'Contract', size: 2 });
            expect(typeof created.body.size).toBe('number');
            expect(Number.isInteger(created.body.siz)).toBeFalsy();
            expect(Number.isInteger(created.body.size)).toBe(true);

            const cleared = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ size: null });
            expect(cleared.body.size).toBeNull();
        });
    });
});
