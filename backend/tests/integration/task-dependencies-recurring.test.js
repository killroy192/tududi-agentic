const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Task Dependencies with Recurring Tasks', () => {
    let agent;

    beforeEach(async () => {
        await createTestUser({ email: 'test@example.com' });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    it('attaches the blocking array from the template to virtual occurrences', async () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const recurringResponse = await agent.post('/api/task').send({
            name: 'Daily Standup',
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: today.toISOString().split('T')[0],
        });
        expect(recurringResponse.status).toBe(201);
        const recurringTask = recurringResponse.body;

        const blockedResponse = await agent
            .post('/api/task')
            .send({ name: 'Blocked Task' });
        expect(blockedResponse.status).toBe(201);
        const blockedTask = blockedResponse.body;

        const dependencyResponse = await agent
            .post(`/api/task/${recurringTask.uid}/dependencies`)
            .send({
                target_task_uid: blockedTask.uid,
                relationship: 'blocks',
            });
        expect(dependencyResponse.status).toBe(201);

        const upcomingResponse = await agent.get(
            '/api/tasks?type=upcoming&groupBy=day'
        );
        expect(upcomingResponse.status).toBe(200);

        const occurrences = upcomingResponse.body.tasks.filter(
            (t) =>
                t.is_virtual_occurrence &&
                t.original_name === 'Daily Standup'
        );

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
            expect(occurrence.blocking).toHaveLength(1);
            expect(occurrence.blocking[0].uid).toBe(blockedTask.uid);
        });
    });

    it('leaves blocking empty for recurring templates without dependencies', async () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const recurringResponse = await agent.post('/api/task').send({
            name: 'Daily Journal',
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: today.toISOString().split('T')[0],
        });
        expect(recurringResponse.status).toBe(201);

        const upcomingResponse = await agent.get(
            '/api/tasks?type=upcoming&groupBy=day'
        );
        expect(upcomingResponse.status).toBe(200);

        const occurrences = upcomingResponse.body.tasks.filter(
            (t) =>
                t.is_virtual_occurrence && t.original_name === 'Daily Journal'
        );

        expect(occurrences.length).toBeGreaterThan(0);
        occurrences.forEach((occurrence) => {
            expect(occurrence.blocking).toEqual([]);
        });
    });
});
