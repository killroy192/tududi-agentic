const request = require('supertest');
const app = require('../../app');
const { Task, TaskDependency } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Dependencies API', () => {
    let agent;
    let testUser;
    let otherAgent;

    beforeEach(async () => {
        testUser = await createTestUser({ email: 'owner@example.com' });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'owner@example.com',
            password: 'password123',
        });

        const otherUser = await createTestUser({ email: 'other@example.com' });
        otherAgent = request.agent(app);
        await otherAgent.post('/api/login').send({
            email: 'other@example.com',
            password: 'password123',
        });
    });

    const createTaskViaApi = async (name) => {
        const response = await agent.post('/api/task').send({ name });
        expect(response.status).toBe(201);
        return response.body;
    };

    describe('GET /api/task/:uid/dependencies', () => {
        it('returns empty arrays for a task with no dependencies', async () => {
            const task = await createTaskViaApi('Solo Task');

            const response = await agent.get(
                `/api/task/${task.uid}/dependencies`
            );

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ blockers: [], blocking: [] });
        });

        it('returns 403 when another user requests dependencies', async () => {
            const task = await createTaskViaApi('Private Task');

            const response = await otherAgent.get(
                `/api/task/${task.uid}/dependencies`
            );

            expect(response.status).toBe(403);
        });
    });

    describe('POST /api/task/:uid/dependencies', () => {
        it('creates a "blocks" relationship', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');

            const response = await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'blocks' });

            expect(response.status).toBe(201);
            expect(response.body.blocking).toHaveLength(1);
            expect(response.body.blocking[0].uid).toBe(taskB.uid);

            const dependency = await TaskDependency.findOne({
                where: {
                    blocker_task_id: taskA.id,
                    blocked_task_id: taskB.id,
                },
            });
            expect(dependency).not.toBeNull();
        });

        it('creates a "blocked_by" relationship', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');

            const response = await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({
                    target_task_uid: taskB.uid,
                    relationship: 'blocked_by',
                });

            expect(response.status).toBe(201);
            expect(response.body.blockers).toHaveLength(1);
            expect(response.body.blockers[0].uid).toBe(taskB.uid);
        });

        it('returns 400 when relationship is invalid', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');

            const response = await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'huh' });

            expect(response.status).toBe(400);
        });

        it('returns 400 when the target task is a recurring template', async () => {
            const taskA = await createTaskViaApi('Task A');
            const recurringResponse = await agent.post('/api/task').send({
                name: 'Recurring Task',
                recurrence_type: 'daily',
            });
            expect(recurringResponse.status).toBe(201);
            const recurringTask = recurringResponse.body;

            const response = await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({
                    target_task_uid: recurringTask.uid,
                    relationship: 'blocks',
                });

            expect(response.status).toBe(400);
        });

        it('allows a recurring template to block another task', async () => {
            const recurringResponse = await agent.post('/api/task').send({
                name: 'Recurring Task',
                recurrence_type: 'daily',
            });
            expect(recurringResponse.status).toBe(201);
            const recurringTask = recurringResponse.body;
            const taskB = await createTaskViaApi('Task B');

            const response = await agent
                .post(`/api/task/${recurringTask.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'blocks' });

            expect(response.status).toBe(201);
        });

        it('returns 400 when the dependency would create a cycle', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');
            const taskC = await createTaskViaApi('Task C');

            await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'blocks' });
            await agent
                .post(`/api/task/${taskB.uid}/dependencies`)
                .send({ target_task_uid: taskC.uid, relationship: 'blocks' });

            const response = await agent
                .post(`/api/task/${taskC.uid}/dependencies`)
                .send({ target_task_uid: taskA.uid, relationship: 'blocks' });

            expect(response.status).toBe(400);
        });

        it('rejects linking to a task owned by another user', async () => {
            const taskA = await createTaskViaApi('Task A');
            const foreignTaskResponse = await otherAgent
                .post('/api/task')
                .send({ name: 'Foreign Task' });
            const foreignTask = foreignTaskResponse.body;

            const response = await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({
                    target_task_uid: foreignTask.uid,
                    relationship: 'blocks',
                });

            expect(response.status).toBe(400);
        });
    });

    describe('DELETE /api/task/:uid/dependencies/:targetTaskUid', () => {
        it('removes an existing dependency', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');

            await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'blocks' });

            const response = await agent
                .delete(
                    `/api/task/${taskA.uid}/dependencies/${taskB.uid}?relationship=blocks`
                )
                .send();

            expect(response.status).toBe(200);
            expect(response.body.blocking).toHaveLength(0);
        });
    });

    describe('GET /api/task/:uid single task response', () => {
        it('includes blockers and blocking arrays', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');

            await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'blocks' });

            const response = await agent.get(`/api/task/${taskA.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.blocking).toHaveLength(1);
            expect(response.body.blocking[0].uid).toBe(taskB.uid);
            expect(response.body.blockers).toEqual([]);
        });
    });

    describe('DELETE /api/task/:uid cascades dependency cleanup', () => {
        it('removes dependency records when either task is deleted', async () => {
            const taskA = await createTaskViaApi('Task A');
            const taskB = await createTaskViaApi('Task B');

            await agent
                .post(`/api/task/${taskA.uid}/dependencies`)
                .send({ target_task_uid: taskB.uid, relationship: 'blocks' });

            const deleteResponse = await agent.delete(
                `/api/task/${taskA.uid}`
            );
            expect(deleteResponse.status).toBe(200);

            const remaining = await TaskDependency.count({
                where: { blocked_task_id: taskB.id },
            });
            expect(remaining).toBe(0);
        });
    });
});
