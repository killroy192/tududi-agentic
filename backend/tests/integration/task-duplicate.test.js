const request = require('supertest');
const app = require('../../app');
const {
    Task,
    Tag,
    Project,
    Area,
    TaskAttachment,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/duplicate', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `duplicate_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    it('should duplicate a task with main details and leave the original unchanged', async () => {
        const project = await Project.create({
            name: 'Work',
            user_id: user.id,
        });
        const area = await Area.create({
            name: 'Focus',
            user_id: user.id,
        });
        const tag = await Tag.create({
            name: 'urgent',
            user_id: user.id,
        });

        const source = await Task.create({
            name: 'Write report',
            note: 'Q3 summary',
            priority: Task.PRIORITY.HIGH,
            status: Task.STATUS.IN_PROGRESS,
            due_date: new Date('2026-10-01T23:59:59.000Z'),
            defer_until: new Date('2026-09-20T10:00:00.000Z'),
            assigned_to: null,
            involves: ['person-uid-1'],
            project_id: project.id,
            area_id: area.id,
            user_id: user.id,
            recurrence_type: Task.RECURRENCE_TYPE.WEEKLY,
            recurrence_interval: 1,
            completion_based: true,
        });
        await source.setTags([tag]);

        const response = await agent
            .post(`/api/task/${source.uid}/duplicate`)
            .expect(201);

        expect(response.body.uid).toBeDefined();
        expect(response.body.uid).not.toBe(source.uid);
        expect(response.body.id).not.toBe(source.id);
        expect(response.body.name).toBe('Write report copy');
        expect(response.body.note).toBe('Q3 summary');
        expect(response.body.priority).toBe(Task.PRIORITY.HIGH);
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.due_date).toBeNull();
        expect(response.body.defer_until).toBeNull();
        expect(response.body.assigned_to).toBeNull();
        expect(response.body.involves).toEqual([]);
        expect(response.body.project_id).toBe(project.id);
        expect(response.body.area_id).toBe(area.id);
        expect(response.body.recurrence_type).toBe(Task.RECURRENCE_TYPE.NONE);
        expect(response.body.recurring_parent_id).toBeNull();
        expect(response.body.completion_based).toBe(false);
        expect(response.body.tags.map((t) => t.name)).toContain('urgent');

        const original = await Task.findByPk(source.id, {
            include: [{ model: Tag }],
        });
        expect(original.name).toBe('Write report');
        expect(original.status).toBe(Task.STATUS.IN_PROGRESS);
        expect(original.due_date).not.toBeNull();
        expect(original.defer_until).not.toBeNull();
        expect(original.recurrence_type).toBe(Task.RECURRENCE_TYPE.WEEKLY);
        expect(original.Tags.map((t) => t.name)).toContain('urgent');
    });

    it('should copy subtasks as incomplete children with copy suffix', async () => {
        const parent = await Task.create({
            name: 'Parent',
            user_id: user.id,
            status: Task.STATUS.DONE,
            completed_at: new Date(),
            priority: Task.PRIORITY.MEDIUM,
        });

        await Task.create({
            name: 'Buy milk',
            user_id: user.id,
            parent_task_id: parent.id,
            status: Task.STATUS.DONE,
            completed_at: new Date(),
            due_date: new Date('2026-10-05T23:59:59.000Z'),
            priority: Task.PRIORITY.LOW,
            order: 1,
        });
        await Task.create({
            name: 'Call bank',
            user_id: user.id,
            parent_task_id: parent.id,
            status: Task.STATUS.IN_PROGRESS,
            priority: Task.PRIORITY.HIGH,
            order: 2,
        });

        const response = await agent
            .post(`/api/task/${parent.uid}/duplicate`)
            .expect(201);

        expect(response.body.name).toBe('Parent copy');
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.subtasks).toHaveLength(2);
        expect(response.body.subtasks[0].name).toBe('Buy milk copy');
        expect(response.body.subtasks[1].name).toBe('Call bank copy');
        expect(response.body.subtasks[0].status).toBe(
            Task.STATUS.NOT_STARTED
        );
        expect(response.body.subtasks[1].status).toBe(
            Task.STATUS.NOT_STARTED
        );
        expect(response.body.subtasks[0].completed_at).toBeNull();
        expect(response.body.subtasks[0].due_date).toBeNull();
        expect(response.body.subtasks[0].parent_task_id).toBe(
            response.body.id
        );
        expect(response.body.subtasks[1].parent_task_id).toBe(
            response.body.id
        );

        const originalSubtasks = await Task.findAll({
            where: { parent_task_id: parent.id },
        });
        expect(originalSubtasks).toHaveLength(2);
        expect(originalSubtasks.map((s) => s.name).sort()).toEqual([
            'Buy milk',
            'Call bank',
        ]);
    });

    it('should not copy attachments', async () => {
        const source = await Task.create({
            name: 'With file',
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });

        await TaskAttachment.create({
            task_id: source.id,
            user_id: user.id,
            original_filename: 'doc.pdf',
            stored_filename: 'task-doc.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            file_path: 'tasks/task-doc.pdf',
        });

        const response = await agent
            .post(`/api/task/${source.uid}/duplicate`)
            .expect(201);

        const cloneAttachments = await TaskAttachment.findAll({
            where: { task_id: response.body.id },
        });
        expect(cloneAttachments).toHaveLength(0);

        const sourceAttachments = await TaskAttachment.findAll({
            where: { task_id: source.id },
        });
        expect(sourceAttachments).toHaveLength(1);
    });

    it('should duplicate a subtask as a top-level task', async () => {
        const parent = await Task.create({
            name: 'Parent',
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });
        const subtask = await Task.create({
            name: 'Child',
            user_id: user.id,
            parent_task_id: parent.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const response = await agent
            .post(`/api/task/${subtask.uid}/duplicate`)
            .expect(201);

        expect(response.body.name).toBe('Child copy');
        expect(response.body.parent_task_id).toBeNull();
    });

    it('should return 403 for another user’s task', async () => {
        const otherUser = await createTestUser({
            email: `other_dup_${Date.now()}@example.com`,
        });
        const otherTask = await Task.create({
            name: 'Secret',
            user_id: otherUser.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const response = await agent.post(
            `/api/task/${otherTask.uid}/duplicate`
        );

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
    });

    it('should require authentication', async () => {
        const task = await Task.create({
            name: 'Auth check',
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const response = await request(app).post(
            `/api/task/${task.uid}/duplicate`
        );

        expect(response.status).toBe(401);
    });

    it('should return 404 for a non-existent task', async () => {
        const response = await agent.post(
            '/api/task/abcdefghijklmno/duplicate'
        );

        expect([403, 404]).toContain(response.status);
    });
});
