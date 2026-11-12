const request = require('supertest');
const app = require('../../app');
const { Task, TaskEvent } = require('../../models');
const { createTestUser, authenticateUser } = require('../helpers/testUtils');
const { registerTaskTools } = require('../../modules/mcp/tools/taskTools');
const { registerHabitTools } = require('../../modules/mcp/tools/habitTools');
const {
    serializeTaskToVTODO,
} = require('../../modules/caldav/icalendar/vtodo-serializer');
const ICAL = require('ical.js');

const INVALID_SIZE_ERROR =
    'Invalid size. Allowed values are null, S, M, L, or XL.';

describe('Task size', () => {
    let user;
    let agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'task-size@example.com',
        });
        agent = request.agent(app);
        await authenticateUser(agent, user);
    });

    async function reload(id) {
        return Task.findByPk(id);
    }

    describe('AC-1 read payload', () => {
        it('returns size null for an existing task and a newly created task', async () => {
            const existing = await Task.create({
                name: 'Existing task',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const existingResponse = await agent.get(
                `/api/task/${existing.uid}`
            );

            expect(existingResponse.status).toBe(200);
            expect(existingResponse.body.size).toBeNull();

            const created = await agent.post('/api/task').send({
                name: 'Brand new task',
            });

            expect(created.status).toBe(201);
            expect(created.body.size).toBeNull();

            const createdRow = await reload(created.body.id);
            expect(createdRow.size).toBeNull();

            const fetched = await agent.get(`/api/task/${created.body.uid}`);
            expect(fetched.status).toBe(200);
            expect(fetched.body.size).toBeNull();
        });
    });

    describe('AC-11 create ignores size', () => {
        it.each([
            ['omitted', undefined],
            ['null', null],
            ['S', 'S'],
            ['XXL', 'XXL'],
        ])('stores null when create size is %s', async (_label, size) => {
            const body = { name: `Create ${_label}`, priority: 1 };
            if (size !== undefined) {
                body.size = size;
            }

            const response = await agent.post('/api/task').send(body);

            expect(response.status).toBe(201);
            expect(response.body.size).toBeNull();
            expect(response.body.name).toBe(body.name);

            const stored = await reload(response.body.id);
            expect(stored.size).toBeNull();
        });
    });

    describe('AC-13 omit size on update', () => {
        it('leaves a seeded size unchanged when the patch does not send size', async () => {
            const task = await Task.create({
                name: 'Seeded size',
                priority: 1,
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'L',
            });

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ name: 'Renamed without size', priority: 2 });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Renamed without size');
            expect(response.body.priority).toBe(2);
            expect(response.body.size).toBe('L');

            const stored = await reload(task.id);
            expect(stored.size).toBe('L');
            expect(stored.name).toBe('Renamed without size');
        });
    });

    describe('AC-3 AC-4 AC-5 AC-6 AC-15 updates', () => {
        it('sets S M L XL and then clears to null', async () => {
            const task = await Task.create({
                name: 'Sizable',
                priority: 1,
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
            });

            for (const size of ['S', 'M', 'L', 'XL']) {
                const response = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size });

                expect(response.status).toBe(200);
                expect(response.body.size).toBe(size);

                const fetched = await agent.get(`/api/task/${task.uid}`);
                expect(fetched.status).toBe(200);
                expect(fetched.body.size).toBe(size);

                const stored = await reload(task.id);
                expect(stored.size).toBe(size);
            }

            const cleared = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: null });

            expect(cleared.status).toBe(200);
            expect(cleared.body.size).toBeNull();

            const fetched = await agent.get(`/api/task/${task.uid}`);
            expect(fetched.body.size).toBeNull();
            expect((await reload(task.id)).size).toBeNull();
        });

        it('keeps priority and status independent of size', async () => {
            const task = await Task.create({
                name: 'Independent',
                priority: 1,
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'S',
            });

            const sizePatch = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'XL' });

            expect(sizePatch.status).toBe(200);
            expect(sizePatch.body.size).toBe('XL');
            expect(sizePatch.body.priority).toBe(1);
            expect(sizePatch.body.status).toBe(Task.STATUS.NOT_STARTED);

            const priorityPatch = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ priority: 2 });

            expect(priorityPatch.status).toBe(200);
            expect(priorityPatch.body.priority).toBe(2);
            expect(priorityPatch.body.size).toBe('XL');

            const statusPatch = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.IN_PROGRESS });

            expect(statusPatch.status).toBe(200);
            expect(statusPatch.body.status).toBe(Task.STATUS.IN_PROGRESS);
            expect(statusPatch.body.priority).toBe(2);
            expect(statusPatch.body.size).toBe('XL');

            const stored = await reload(task.id);
            expect(stored.size).toBe('XL');
            expect(stored.priority).toBe(2);
            expect(stored.status).toBe(Task.STATUS.IN_PROGRESS);
        });

        it.each([
            ['completed', Task.STATUS.DONE],
            ['archived', Task.STATUS.ARCHIVED],
            ['cancelled', Task.STATUS.CANCELLED],
        ])(
            'allows a size change on a %s task and keeps size when status changes',
            async (_label, status) => {
                const task = await Task.create({
                    name: `Status ${status}`,
                    priority: 0,
                    status,
                    user_id: user.id,
                    size: 'S',
                });

                const sizePatch = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ size: 'L' });

                expect(sizePatch.status).toBe(200);
                expect(sizePatch.body.size).toBe('L');
                expect(sizePatch.body.status).toBe(status);

                const nextStatus =
                    status === Task.STATUS.IN_PROGRESS
                        ? Task.STATUS.NOT_STARTED
                        : Task.STATUS.IN_PROGRESS;
                const statusPatch = await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ status: nextStatus });

                expect(statusPatch.status).toBe(200);
                expect(statusPatch.body.status).toBe(nextStatus);
                expect(statusPatch.body.size).toBe('L');
                expect((await reload(task.id)).size).toBe('L');
            }
        );

        it('keeps the later of two sequential size saves', async () => {
            const task = await Task.create({
                name: 'Last write wins',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const first = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'S' });
            expect(first.status).toBe(200);
            expect(first.body.size).toBe('S');

            const second = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'M' });
            expect(second.status).toBe(200);
            expect(second.body.size).toBe('M');

            const fetched = await agent.get(`/api/task/${task.uid}`);
            expect(fetched.body.size).toBe('M');
            expect((await reload(task.id)).size).toBe('M');
        });
    });

    describe('AC-12 invalid size rejects the whole update', () => {
        async function createRecurringParent() {
            const parent = await Task.create({
                name: 'Recurring parent',
                priority: 1,
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'M',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurrence_end_date: new Date('2099-12-31T00:00:00Z'),
                completion_based: false,
            });

            const children = [];
            for (const [index, size] of ['S', 'L'].entries()) {
                children.push(
                    await Task.create({
                        name: `Future child ${index + 1}`,
                        priority: 0,
                        status: Task.STATUS.NOT_STARTED,
                        user_id: user.id,
                        size,
                        recurrence_type: 'none',
                        recurring_parent_id: parent.id,
                        due_date: new Date(Date.UTC(2099, 0, 10 + index)),
                    })
                );
            }

            return { parent, children };
        }

        async function expectUntouched(parent, children) {
            const storedParent = await reload(parent.id);
            expect(storedParent.name).toBe('Recurring parent');
            expect(storedParent.priority).toBe(1);
            expect(storedParent.size).toBe('M');
            expect(storedParent.recurrence_type).toBe('daily');
            expect(storedParent.recurrence_interval).toBe(1);
            expect(storedParent.completion_based).toBe(false);
            expect(
                new Date(storedParent.recurrence_end_date)
                    .toISOString()
                    .slice(0, 10)
            ).toBe('2099-12-31');

            const storedChildren = await Task.findAll({
                where: { recurring_parent_id: parent.id },
                order: [['id', 'ASC']],
            });
            expect(storedChildren.map((child) => child.id)).toEqual(
                children.map((child) => child.id)
            );
            expect(storedChildren.map((child) => child.size)).toEqual([
                'S',
                'L',
            ]);
            expect(storedChildren.map((child) => child.name)).toEqual(
                children.map((child) => child.name)
            );
        }

        it.each([
            ['empty string', ''],
            ['unset', 'unset'],
            ['lowercase s', 's'],
            ['XXL', 'XXL'],
            ['number', 5],
        ])(
            'returns 400 for %s and does not write the parent or delete children',
            async (_label, invalidSize) => {
                const { parent, children } = await createRecurringParent();

                const parentResponse = await agent
                    .patch(`/api/task/${parent.uid}`)
                    .send({
                        name: 'Should not rename',
                        size: invalidSize,
                        update_parent_recurrence: true,
                    });

                expect(parentResponse.status).toBe(400);
                expect(parentResponse.body).toEqual({
                    error: INVALID_SIZE_ERROR,
                });
                await expectUntouched(parent, children);

                const childResponse = await agent
                    .patch(`/api/task/${children[0].uid}`)
                    .send({
                        name: 'Should not rename child',
                        size: invalidSize,
                        update_parent_recurrence: true,
                        recurrence_type: 'weekly',
                        recurrence_interval: 9,
                    });

                expect(childResponse.status).toBe(400);
                expect(childResponse.body).toEqual({
                    error: INVALID_SIZE_ERROR,
                });
                await expectUntouched(parent, children);
            }
        );
    });

    describe('AC-8 recurrence instances', () => {
        it('keeps parent and stored child sizes independent', async () => {
            const parent = await Task.create({
                name: 'Series parent',
                priority: 1,
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'S',
                recurrence_type: 'daily',
                recurrence_interval: 1,
            });
            const childA = await Task.create({
                name: 'Stored child A',
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'M',
                recurrence_type: 'none',
                recurring_parent_id: parent.id,
                due_date: new Date('2099-03-01T00:00:00Z'),
            });
            const childB = await Task.create({
                name: 'Stored child B',
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'L',
                recurrence_type: 'none',
                recurring_parent_id: parent.id,
                due_date: new Date('2099-03-02T00:00:00Z'),
            });

            const parentPatch = await agent
                .patch(`/api/task/${parent.uid}`)
                .send({ size: 'XL' });

            expect(parentPatch.status).toBe(200);
            expect(parentPatch.body.size).toBe('XL');

            let storedChildren = await Task.findAll({
                where: { recurring_parent_id: parent.id },
                order: [['id', 'ASC']],
            });
            expect(storedChildren.map((child) => child.id)).toEqual([
                childA.id,
                childB.id,
            ]);
            expect(storedChildren.map((child) => child.size)).toEqual([
                'M',
                'L',
            ]);

            const childPatch = await agent
                .patch(`/api/task/${childA.uid}`)
                .send({ size: 'S' });

            expect(childPatch.status).toBe(200);
            expect(childPatch.body.size).toBe('S');
            expect((await reload(parent.id)).size).toBe('XL');
            expect((await reload(childB.id)).size).toBe('L');
            expect((await reload(childA.id)).size).toBe('S');

            storedChildren = await Task.findAll({
                where: { recurring_parent_id: parent.id },
                order: [['id', 'ASC']],
            });
            expect(storedChildren.map((child) => child.id)).toEqual([
                childA.id,
                childB.id,
            ]);

            const laterChild = await Task.create({
                name: 'Child created after parent size',
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                recurrence_type: 'none',
                recurring_parent_id: parent.id,
                due_date: new Date('2099-04-01T00:00:00Z'),
            });

            const laterResponse = await agent.get(
                `/api/task/${laterChild.uid}`
            );
            expect(laterResponse.status).toBe(200);
            expect(laterResponse.body.size).toBeNull();
            expect((await reload(parent.id)).size).toBe('XL');
        });
    });

    describe('AC-9 subtasks', () => {
        it('changes a subtask size without changing the parent', async () => {
            const parent = await Task.create({
                name: 'Parent task',
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                size: 'XL',
            });
            const subtask = await Task.create({
                name: 'Subtask',
                status: Task.STATUS.NOT_STARTED,
                user_id: user.id,
                parent_task_id: parent.id,
                size: null,
            });

            const response = await agent
                .patch(`/api/task/${subtask.uid}`)
                .send({ size: 'M' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('M');
            expect((await reload(subtask.id)).size).toBe('M');
            expect((await reload(parent.id)).size).toBe('XL');
            expect((await reload(parent.id)).name).toBe('Parent task');
        });
    });

    describe('AC-10 habits', () => {
        it('stores null when habit create, habit update, and task patch send S', async () => {
            const created = await agent.post('/api/habits').send({
                name: 'Drink water',
                size: 'S',
            });

            expect(created.status).toBe(201);
            expect(created.body.habit.size).toBeNull();
            expect(created.body.habit.habit_mode).toBe(true);

            const createdRow = await Task.findOne({
                where: { uid: created.body.habit.uid },
            });
            expect(createdRow.size).toBeNull();

            const updated = await agent
                .put(`/api/habits/${created.body.habit.uid}`)
                .send({
                    name: 'Drink more water',
                    size: 'S',
                });

            expect(updated.status).toBe(200);
            expect(updated.body.habit.size).toBeNull();
            expect(updated.body.habit.name).toBe('Drink more water');
            expect((await reload(createdRow.id)).size).toBeNull();

            const patched = await agent
                .patch(`/api/task/${created.body.habit.uid}`)
                .send({ size: 'S', note: 'still a habit' });

            expect(patched.status).toBe(200);
            expect(patched.body.size).toBeNull();
            expect(patched.body.note).toBe('still a habit');
            expect(patched.body.habit_mode).toBe(true);

            const stored = await reload(createdRow.id);
            expect(stored.size).toBeNull();
            expect(stored.note).toBe('still a habit');
        });

        it('returns 400 when a habit task patch sends XXL', async () => {
            const habit = await Task.create({
                name: 'Walk',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                habit_mode: true,
                size: null,
            });

            const response = await agent
                .patch(`/api/task/${habit.uid}`)
                .send({ size: 'XXL', name: 'Should not rename' });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: INVALID_SIZE_ERROR });

            const stored = await reload(habit.id);
            expect(stored.size).toBeNull();
            expect(stored.name).toBe('Walk');
        });
    });

    describe('AC-16 no side channels', () => {
        it('does not write a task event for a size-only patch', async () => {
            const task = await Task.create({
                name: 'Quiet size',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                priority: 1,
            });

            const before = await TaskEvent.count({
                where: { task_id: task.id },
            });

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ size: 'S' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('S');

            const after = await TaskEvent.count({
                where: { task_id: task.id },
            });
            expect(after).toBe(before);
        });

        it('does not expose size on MCP task or habit tool inputs', () => {
            const tools = [];
            registerTaskTools({}, { userId: user.id }, tools);
            registerHabitTools({}, { userId: user.id }, tools);

            expect(tools.length).toBeGreaterThan(0);
            for (const tool of tools) {
                expect(tool.inputSchema.properties || {}).not.toHaveProperty(
                    'size'
                );
                expect(tool.inputSchema.required || []).not.toContain('size');
            }
        });

        it('ignores a size filter and size sort on search', async () => {
            await Task.create({
                name: 'SizeProbe Alpha',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                size: 'S',
            });
            await Task.create({
                name: 'SizeProbe Beta',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
                size: 'L',
            });

            const baseline = await agent.get('/api/search').query({
                q: 'SizeProbe',
                filters: 'Task',
            });
            const filtered = await agent.get('/api/search').query({
                q: 'SizeProbe',
                filters: 'Task',
                size: 'S',
                sort: 'size',
            });

            expect(baseline.status).toBe(200);
            expect(filtered.status).toBe(200);

            const names = (body) =>
                body.results
                    .filter((result) => result.type === 'Task')
                    .map((result) => result.name)
                    .sort();

            expect(names(filtered.body)).toEqual(names(baseline.body));
            expect(names(filtered.body)).toEqual([
                'SizeProbe Alpha',
                'SizeProbe Beta',
            ]);
        });

        it('does not write size into CalDAV VTODO output', async () => {
            const vtodo = await serializeTaskToVTODO({
                uid: 'size-caldav-task',
                name: 'Sized task',
                status: 0,
                priority: 1,
                note: 'A note',
                size: 'XL',
            });

            const component = new ICAL.Component(ICAL.parse(vtodo));
            const todo = component.getFirstSubcomponent('vtodo');
            const propertyNames = todo
                .getAllProperties()
                .map((property) => property.name.toLowerCase());

            expect(propertyNames).not.toContain('size');
            expect(propertyNames).not.toContain('x-tududi-size');
            expect(vtodo.toLowerCase()).not.toContain('x-tududi-size');
        });
    });

    describe('model constraint', () => {
        it('rejects a size outside S M L XL at the model', async () => {
            await expect(
                Task.create({
                    name: 'Invalid stored size',
                    user_id: user.id,
                    status: Task.STATUS.NOT_STARTED,
                    size: 'XXL',
                })
            ).rejects.toMatchObject({ name: 'SequelizeValidationError' });
        });
    });
});
