const request = require('supertest');
const app = require('../../app');
const { Task, Tag, Project, Area, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/duplicate', () => {
    let ownerUser;
    let ownerAgent;

    beforeEach(async () => {
        ownerUser = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });

        ownerAgent = request.agent(app);
        await ownerAgent.post('/api/login').send({
            email: ownerUser.email,
            password: 'password123',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('duplicates a done parent with schedule, tags, project, area, and subtasks', async () => {
        const project = await Project.create({
            name: 'Work Project',
            user_id: ownerUser.id,
        });
        const area = await Area.create({
            name: 'Focus Area',
            user_id: ownerUser.id,
        });
        const parentTag = await Tag.create({
            name: 'important',
            user_id: ownerUser.id,
        });
        const subtaskTag = await Tag.create({
            name: 'subtag',
            user_id: ownerUser.id,
        });

        const parent = await Task.create({
            name: 'Original Parent',
            note: 'Parent description',
            user_id: ownerUser.id,
            project_id: project.id,
            area_id: area.id,
            priority: Task.PRIORITY.HIGH,
            status: Task.STATUS.DONE,
            completed_at: new Date('2026-01-15T12:00:00Z'),
            due_date: new Date('2026-06-01T00:00:00Z'),
            defer_until: new Date('2026-05-01T09:00:00Z'),
            reminder_at: new Date('2026-05-31T09:00:00Z'),
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            recurrence_weekday: 1,
        });
        await parent.addTag(parentTag);

        const subtask = await Task.create({
            name: 'Original Subtask',
            note: 'Subtask note',
            user_id: ownerUser.id,
            parent_task_id: parent.id,
            project_id: project.id,
            area_id: area.id,
            priority: Task.PRIORITY.MEDIUM,
            status: Task.STATUS.DONE,
            completed_at: new Date('2026-01-10T12:00:00Z'),
            due_date: new Date('2026-06-02T00:00:00Z'),
            order: 1,
        });
        await subtask.addTag(subtaskTag);

        const response = await ownerAgent
            .post(`/api/task/${parent.uid}/duplicate`)
            .expect(201);

        expect(response.body.uid).toBeDefined();
        expect(response.body.uid).not.toBe(parent.uid);
        expect(response.body.name).toBe('Original Parent');
        expect(response.body.note).toBe('Parent description');
        expect(response.body.project_id).toBe(project.id);
        expect(response.body.area_id).toBe(area.id);
        expect(response.body.priority).toBe(Task.PRIORITY.HIGH);
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.due_date).toBeNull();
        expect(response.body.defer_until).toBeNull();
        expect(response.body.reminder_at).toBeNull();
        expect(response.body.recurrence_type).toBe('none');
        expect(response.body.recurring_parent_id).toBeNull();
        expect(response.body.user_uid).toBe(ownerUser.uid);
        expect(response.body.tags.map((t) => t.name)).toContain('important');

        expect(response.body.subtasks).toHaveLength(1);
        const copiedSubtask = response.body.subtasks[0];
        expect(copiedSubtask.name).toBe('Original Subtask');
        expect(copiedSubtask.note).toBe('Subtask note');
        expect(copiedSubtask.status).toBe(Task.STATUS.NOT_STARTED);
        expect(copiedSubtask.completed_at).toBeNull();
        expect(copiedSubtask.due_date).toBeNull();
        expect(copiedSubtask.parent_task_id).toBe(response.body.id);
        expect(copiedSubtask.tags.map((t) => t.name)).toContain('subtag');

        // Original unchanged
        const original = await Task.findByPk(parent.id);
        expect(original.name).toBe('Original Parent');
        expect(original.status).toBe(Task.STATUS.DONE);
        expect(original.due_date).not.toBeNull();
        expect(original.recurrence_type).toBe('weekly');

        const originalSubtask = await Task.findByPk(subtask.id);
        expect(originalSubtask.status).toBe(Task.STATUS.DONE);
        expect(originalSubtask.parent_task_id).toBe(parent.id);
    });

    it('duplicates a subtask as a sibling under the same parent', async () => {
        const parent = await Task.create({
            name: 'Parent',
            user_id: ownerUser.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.LOW,
        });

        const siblingA = await Task.create({
            name: 'Sibling A',
            user_id: ownerUser.id,
            parent_task_id: parent.id,
            status: Task.STATUS.DONE,
            completed_at: new Date(),
            priority: Task.PRIORITY.HIGH,
            order: 1,
        });

        const siblingB = await Task.create({
            name: 'Sibling B',
            user_id: ownerUser.id,
            parent_task_id: parent.id,
            status: Task.STATUS.NOT_STARTED,
            priority: Task.PRIORITY.MEDIUM,
            order: 2,
        });

        const response = await ownerAgent
            .post(`/api/task/${siblingA.uid}/duplicate`)
            .expect(201);

        expect(response.body.name).toBe('Sibling A');
        expect(response.body.parent_task_id).toBe(parent.id);
        expect(response.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(response.body.completed_at).toBeNull();
        expect(response.body.uid).not.toBe(siblingA.uid);
        expect(response.body.order).toBe(3);

        // Does not copy parent's other children as nested subtasks
        expect(response.body.subtasks || []).toHaveLength(0);

        const children = await Task.findAll({
            where: { parent_task_id: parent.id },
            order: [['order', 'ASC']],
        });
        expect(children).toHaveLength(3);
        expect(children.map((c) => c.name)).toEqual([
            'Sibling A',
            'Sibling B',
            'Sibling A',
        ]);
        expect(children[2].id).toBe(response.body.id);
        expect(children[2].id).not.toBe(siblingB.id);
    });

    it('returns 403 when a project collaborator who is not the owner tries to duplicate', async () => {
        const sharedUser = await createTestUser({
            email: `shared_${Date.now()}@test.com`,
            name: 'Shared User',
            timezone: 'UTC',
        });

        const sharedAgent = request.agent(app);
        await sharedAgent.post('/api/login').send({
            email: sharedUser.email,
            password: 'password123',
        });

        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Shared Project',
        });
        const project = projectResponse.body;

        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: sharedUser.email,
            access_level: 'rw',
        });

        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Owned Task',
            project_id: project.id,
            priority: 1,
            status: 0,
        });
        const task = taskResponse.body;

        const countBefore = await Task.count({
            where: { user_id: ownerUser.id },
        });

        const response = await sharedAgent
            .post(`/api/task/${task.uid}/duplicate`)
            .expect(403);

        expect(response.body.error).toBe('Forbidden');

        const countAfter = await Task.count({
            where: { user_id: ownerUser.id },
        });
        expect(countAfter).toBe(countBefore);

        const sharedOwnedCopies = await Task.count({
            where: { user_id: sharedUser.id, name: 'Owned Task' },
        });
        expect(sharedOwnedCopies).toBe(0);
    });
});
