const request = require('supertest');
const app = require('../../app');
const { Task, TaskEvent, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/duplicate', () => {
    let user, otherUser, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `duplicate_user_${Date.now()}@example.com`,
        });
        otherUser = await createTestUser({
            email: `duplicate_other_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it('should duplicate a task with copied fields and reset status', async () => {
        const project = await Project.create({
            name: 'Duplicate Project',
            user_id: user.id,
        });

        const dueDate = '2026-08-15';
        const sourceTask = await Task.create({
            name: 'Original Task',
            note: 'Source note',
            priority: 2,
            status: 2,
            completed_at: new Date(),
            due_date: dueDate,
            project_id: project.id,
            user_id: user.id,
        });

        const response = await agent.post(
            `/api/task/${sourceTask.uid}/duplicate`
        );

        expect(response.status).toBe(201);
        expect(response.body.uid).toBeDefined();
        expect(response.body.uid).not.toBe(sourceTask.uid);
        expect(response.body.name).toBe('Original Task (copy)');
        expect(response.body.note).toBe('Source note');
        expect(response.body.priority).toBe(2);
        expect(response.body.status).toBe(0);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.due_date).toBe(dueDate);
        expect(response.body.project_id).toBe(project.id);
        expect(response.body.parent_task_id).toBeNull();

        const dbTask = await Task.findByPk(response.body.id);
        expect(dbTask).not.toBeNull();
        expect(dbTask.uid).toBe(response.body.uid);
    });

    it('should copy tags to the duplicated task', async () => {
        const createResponse = await agent.post('/api/task').send({
            name: 'Tagged Task',
            tags: [{ name: 'work' }, { name: 'urgent' }],
        });
        expect(createResponse.status).toBe(201);

        const response = await agent.post(
            `/api/task/${createResponse.body.uid}/duplicate`
        );

        expect(response.status).toBe(201);
        const tagNames = (response.body.tags || []).map((t) => t.name);
        expect(tagNames).toEqual(
            expect.arrayContaining(['work', 'urgent'])
        );
        expect(tagNames.length).toBe(2);
    });

    it('should not copy subtasks', async () => {
        const parentTask = await Task.create({
            name: 'Parent Task',
            user_id: user.id,
            status: 0,
        });

        await Task.create({
            name: 'Subtask 1',
            user_id: user.id,
            parent_task_id: parentTask.id,
            status: 0,
        });

        const response = await agent.post(
            `/api/task/${parentTask.uid}/duplicate`
        );

        expect(response.status).toBe(201);
        expect(response.body.subtasks).toEqual([]);
        expect(response.body.parent_task_id).toBeNull();
    });

    it('should log created and duplicated events', async () => {
        const sourceTask = await Task.create({
            name: 'Event Source Task',
            user_id: user.id,
            status: 0,
        });

        const response = await agent.post(
            `/api/task/${sourceTask.uid}/duplicate`
        );
        expect(response.status).toBe(201);

        const events = await TaskEvent.findAll({
            where: { task_id: response.body.id },
            order: [['created_at', 'ASC']],
        });

        const eventTypes = events.map((e) => e.event_type);
        expect(eventTypes).toContain('created');
        expect(eventTypes).toContain('duplicated');

        const duplicatedEvent = events.find(
            (e) => e.event_type === 'duplicated'
        );
        expect(duplicatedEvent.metadata.source_task_uid).toBe(sourceTask.uid);
    });

    it('should return 403 for unknown uid', async () => {
        const response = await agent.post(
            '/api/task/nonexistent-uid-12345/duplicate'
        );
        expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
        const sourceTask = await Task.create({
            name: 'Auth Task',
            user_id: user.id,
        });

        const response = await request(app).post(
            `/api/task/${sourceTask.uid}/duplicate`
        );

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
    });

    it("should return 403 when duplicating another user's task", async () => {
        const otherTask = await Task.create({
            name: 'Other User Task',
            user_id: otherUser.id,
        });

        const response = await agent.post(
            `/api/task/${otherTask.uid}/duplicate`
        );

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
    });
});
