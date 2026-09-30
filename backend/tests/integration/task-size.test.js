const request = require('supertest');
const app = require('../../app');
const { Task, TaskEvent } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const SIZES = ['S', 'M', 'L', 'XL'];

describe('Task size (S / M / L / XL)', () => {
    let user, agent;

    const loginAs = async (email) => {
        const newAgent = request.agent(app);
        await newAgent
            .post('/api/login')
            .send({ email, password: 'password123' });
        return newAgent;
    };

    beforeEach(async () => {
        user = await createTestUser({
            email: `size_${Date.now()}@example.com`,
        });
        agent = await loginAs(user.email);
    });

    describe('POST /api/task (create contract)', () => {
        it('creates an unset task when size is omitted', async () => {
            const res = await agent.post('/api/task').send({ name: 'No size' });

            expect(res.status).toBe(201);
            expect(res.body.size).toBeNull();

            const stored = await Task.findByPk(res.body.id);
            expect(stored.size).toBeNull();
        });

        it('creates an unset task when size is null', async () => {
            const res = await agent
                .post('/api/task')
                .send({ name: 'Null size', size: null });

            expect(res.status).toBe(201);
            expect(res.body.size).toBeNull();
        });

        it.each(SIZES)('persists size %s on create', async (size) => {
            const res = await agent
                .post('/api/task')
                .send({ name: `Size ${size}`, size });

            expect(res.status).toBe(201);
            expect(res.body.size).toBe(size);

            const fetched = await agent.get(`/api/task/${res.body.uid}`);
            expect(fetched.status).toBe(200);
            expect(fetched.body.size).toBe(size);
        });

        it('normalizes lowercase size values', async () => {
            const res = await agent
                .post('/api/task')
                .send({ name: 'Lowercase', size: 'xl' });

            expect(res.status).toBe(201);
            expect(res.body.size).toBe('XL');
        });

        it.each(['XS', 'XXL', 'large', '', 2, true])(
            'rejects unsupported size %p and creates no task',
            async (size) => {
                const res = await agent
                    .post('/api/task')
                    .send({ name: 'Bad size', size });

                expect(res.status).toBe(400);
                expect(res.body.error).toMatch(/size/i);

                const count = await Task.count({
                    where: { user_id: user.id },
                });
                expect(count).toBe(0);
            }
        );
    });

    describe('PATCH /api/task/:uid (update contract)', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Sized task',
                user_id: user.id,
                priority: Task.PRIORITY.MEDIUM,
                size: 'M',
                note: 'keep me',
            });
        });

        it('keeps the stored size and other fields when size is omitted', async () => {
            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ note: 'updated note' });

            expect(res.status).toBe(200);
            expect(res.body.size).toBe('M');
            expect(res.body.note).toBe('updated note');
            expect(res.body.priority).toBe(Task.PRIORITY.MEDIUM);
            expect(res.body.name).toBe('Sized task');
        });

        it.each(SIZES)('updates size to %s', async (size) => {
            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size });

            expect(res.status).toBe(200);
            expect(res.body.size).toBe(size);

            await task.reload();
            expect(task.size).toBe(size);
        });

        it('clears size when null is sent', async () => {
            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: null });

            expect(res.status).toBe(200);
            expect(res.body.size).toBeNull();

            const fetched = await agent.get(`/api/task/${task.uid}`);
            expect(fetched.body.size).toBeNull();
        });

        it.each(['XS', 'huge', '', 1])(
            'rejects unsupported size %p and leaves the stored size unchanged',
            async (size) => {
                const res = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size });

                expect(res.status).toBe(400);
                expect(res.body.error).toMatch(/size/i);

                await task.reload();
                expect(task.size).toBe('M');
            }
        );

        it('changing size leaves priority unchanged', async () => {
            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'XL' });

            expect(res.status).toBe(200);
            expect(res.body.size).toBe('XL');
            expect(res.body.priority).toBe(Task.PRIORITY.MEDIUM);
        });

        it('changing priority leaves size unchanged', async () => {
            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ priority: Task.PRIORITY.HIGH });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe(Task.PRIORITY.HIGH);
            expect(res.body.size).toBe('M');
        });

        it.each([Task.STATUS.DONE, Task.STATUS.ARCHIVED])(
            'remains editable when task status is %i',
            async (status) => {
                await task.update({ status });

                const res = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size: 'L' });

                expect(res.status).toBe(200);
                expect(res.body.size).toBe('L');
            }
        );

        it('does not write any activity event for a size change', async () => {
            const before = await TaskEvent.count({
                where: { task_id: task.id },
            });

            const res = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'S' });
            expect(res.status).toBe(200);

            const after = await TaskEvent.count({
                where: { task_id: task.id },
            });
            expect(after).toBe(before);

            const timeline = await agent.get(`/api/task/${task.uid}/timeline`);
            expect(timeline.status).toBe(200);
            const eventTypes = timeline.body.map((e) => e.event_type);
            expect(eventTypes.some((type) => /size/i.test(type))).toBe(false);
        });
    });

    describe('permissions and can_edit', () => {
        let otherUser, otherAgent, project, task;

        const shareProject = async (accessLevel) => {
            const res = await agent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: otherUser.email,
                access_level: accessLevel,
            });
            expect(res.status).toBeGreaterThanOrEqual(200);
            expect(res.status).toBeLessThan(300);
        };

        beforeEach(async () => {
            otherUser = await createTestUser({
                email: `other_${Date.now()}@example.com`,
            });
            otherAgent = await loginAs(otherUser.email);

            const projectRes = await agent
                .post('/api/project')
                .send({ name: 'Shared project' });
            project = projectRes.body;

            const taskRes = await agent.post('/api/task').send({
                name: 'Shared task',
                project_id: project.id,
                size: 'L',
            });
            task = taskRes.body;
        });

        it('owner sees can_edit=true on single and list reads', async () => {
            const single = await agent.get(`/api/task/${task.uid}`);
            expect(single.body.can_edit).toBe(true);

            const list = await agent.get('/api/tasks?type=all&status=all');
            const row = list.body.tasks.find((t) => t.uid === task.uid);
            expect(row).toBeDefined();
            expect(row.can_edit).toBe(true);
            expect(row.size).toBe('L');
        });

        it('read-only user sees the size, gets can_edit=false, and cannot change it', async () => {
            await shareProject('ro');

            const single = await otherAgent.get(`/api/task/${task.uid}`);
            expect(single.status).toBe(200);
            expect(single.body.size).toBe('L');
            expect(single.body.can_edit).toBe(false);

            const projectRes = await otherAgent.get(
                `/api/project/${project.uid}`
            );
            expect(projectRes.status).toBe(200);
            const projectTask = (projectRes.body.Tasks || []).find(
                (t) => t.uid === task.uid
            );
            expect(projectTask).toBeDefined();
            expect(projectTask.can_edit).toBe(false);

            const update = await otherAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'S' });
            expect(update.status).toBe(403);

            const stored = await Task.findOne({ where: { uid: task.uid } });
            expect(stored.size).toBe('L');
        });

        it('read-write shared user gets can_edit=true and can change size', async () => {
            await shareProject('rw');

            const single = await otherAgent.get(`/api/task/${task.uid}`);
            expect(single.body.can_edit).toBe(true);

            const update = await otherAgent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'S' });
            expect(update.status).toBe(200);
            expect(update.body.size).toBe('S');
        });
    });

    describe('subtasks', () => {
        it('subtask size is independent of the parent size', async () => {
            const parent = await Task.create({
                name: 'Parent',
                user_id: user.id,
                size: 'XL',
            });
            const subtask = await Task.create({
                name: 'Child',
                user_id: user.id,
                parent_task_id: parent.id,
            });

            const childRes = await agent
                .patch(`/api/task/${subtask.uid}`)
                .send({ size: 'S' });
            expect(childRes.status).toBe(200);
            expect(childRes.body.size).toBe('S');

            await parent.reload();
            expect(parent.size).toBe('XL');

            const parentRes = await agent
                .patch(`/api/task/${parent.uid}`)
                .send({ size: null });
            expect(parentRes.status).toBe(200);

            await subtask.reload();
            expect(subtask.size).toBe('S');
        });

        it('creating subtasks with a parent does not copy the parent size', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Parent with children',
                size: 'L',
                subtasks: [
                    { name: 'Unsized child' },
                    { name: 'Sized child', size: 'S' },
                ],
            });

            expect(res.status).toBe(201);
            expect(res.body.size).toBe('L');

            const children = await Task.findAll({
                where: { parent_task_id: res.body.id },
                order: [['order', 'ASC']],
            });
            expect(children).toHaveLength(2);
            expect(children[0].size).toBeNull();
            expect(children[1].size).toBe('S');

            const subtasksRes = await agent.get(
                `/api/task/${res.body.uid}/subtasks`
            );
            expect(subtasksRes.status).toBe(200);
            expect(subtasksRes.body.every((s) => s.can_edit === true)).toBe(
                true
            );
        });
    });

    describe('recurring tasks', () => {
        it('virtual upcoming occurrences are unset even when the template has a size', async () => {
            const today = new Date().toISOString().split('T')[0];
            const templateRes = await agent.post('/api/task').send({
                name: 'Daily sized',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                size: 'L',
            });
            expect(templateRes.status).toBe(201);
            expect(templateRes.body.size).toBe('L');

            const upcoming = await agent.get(
                '/api/tasks?type=upcoming&groupBy=day'
            );
            expect(upcoming.status).toBe(200);

            const virtualRows = upcoming.body.tasks.filter(
                (t) => t.is_virtual_occurrence
            );
            expect(virtualRows.length).toBeGreaterThan(0);
            virtualRows.forEach((row) => {
                expect(row.size).toBeNull();
            });

            const template = await agent.get(
                `/api/task/${templateRes.body.uid}`
            );
            expect(template.body.size).toBe('L');
        });

        it('changing the template size does not change or delete existing occurrences', async () => {
            const template = await Task.create({
                name: 'Weekly template',
                user_id: user.id,
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                due_date: new Date(),
                size: 'M',
            });

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);
            const occurrenceA = await Task.create({
                name: 'Weekly template',
                user_id: user.id,
                recurring_parent_id: template.id,
                due_date: futureDate,
                size: 'S',
            });
            const occurrenceB = await Task.create({
                name: 'Weekly template',
                user_id: user.id,
                recurring_parent_id: template.id,
                due_date: futureDate,
            });

            const templateRes = await agent
                .patch(`/api/task/${template.uid}`)
                .send({ size: 'XL' });
            expect(templateRes.status).toBe(200);
            expect(templateRes.body.size).toBe('XL');

            const storedA = await Task.findByPk(occurrenceA.id);
            const storedB = await Task.findByPk(occurrenceB.id);
            expect(storedA).not.toBeNull();
            expect(storedB).not.toBeNull();
            expect(storedA.size).toBe('S');
            expect(storedB.size).toBeNull();

            const occurrenceRes = await agent
                .patch(`/api/task/${occurrenceB.uid}`)
                .send({ size: 'L' });
            expect(occurrenceRes.status).toBe(200);

            await storedA.reload();
            await template.reload();
            expect(storedA.size).toBe('S');
            expect(template.size).toBe('XL');
        });
    });
});
