const request = require('supertest');
const app = require('../../app');
const { Task, Tag, Project, Area, Person } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/task/:uid/duplicate', () => {
    let testUser;
    let agent;

    beforeEach(async () => {
        testUser = await createTestUser();

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: testUser.email,
            password: 'password123',
        });
    });

    describe('Happy path', () => {
        it('should duplicate a task with copied and reset fields', async () => {
            const project = await Project.create({
                name: 'Test Project',
                user_id: testUser.id,
            });

            const area = await Area.create({
                name: 'Test Area',
                user_id: testUser.id,
            });

            const assignee = await Person.create({
                name: 'Assignee Person',
                user_id: testUser.id,
            });

            const involvedPerson = await Person.create({
                name: 'Involved Person',
                user_id: testUser.id,
            });

            const sourceTask = await Task.create({
                name: 'Original Task',
                note: 'Some notes here',
                priority: 2,
                due_date: '2025-06-15',
                defer_until: '2025-06-10',
                status: Task.STATUS.IN_PROGRESS,
                completed_at: new Date(),
                project_id: project.id,
                area_id: area.id,
                assigned_to: assignee.uid,
                involves: [involvedPerson.uid],
                user_id: testUser.id,
                recurrence_type: 'none',
            });

            const sourceResponse = await agent
                .get(`/api/task/${sourceTask.uid}`)
                .expect(200);

            const response = await agent
                .post(`/api/task/${sourceTask.uid}/duplicate`)
                .expect(201);

            expect(response.body.name).toBe('Original Task (copy)');
            expect(response.body.note).toBe('Some notes here');
            expect(response.body.priority).toBe(2);
            expect(response.body.due_date).toBe(sourceResponse.body.due_date);
            expect(response.body.due_date).toBeTruthy();
            expect(response.body.defer_until).toBe(
                sourceResponse.body.defer_until
            );
            expect(response.body.defer_until).toBeTruthy();
            expect(response.body.project_uid).toBe(project.uid);
            expect(response.body.area_uid).toBe(area.uid);
            expect(response.body.assigned_to).toBe(assignee.uid);
            expect(response.body.involves).toEqual([involvedPerson.uid]);

            // Reset fields
            expect(response.body.status).toBe(0);
            expect(response.body.completed_at).toBeNull();
            expect(response.body.uid).not.toBe(sourceTask.uid);
            expect(response.body.id).not.toBe(sourceTask.id);
        });
    });

    describe('Tags', () => {
        it('should re-link tags to the duplicate', async () => {
            const sourceTask = await Task.create({
                name: 'Tagged Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const tag1 = await Tag.create({
                name: 'urgent',
                user_id: testUser.id,
            });
            const tag2 = await Tag.create({
                name: 'work',
                user_id: testUser.id,
            });
            await sourceTask.setTags([tag1, tag2]);

            const response = await agent
                .post(`/api/task/${sourceTask.uid}/duplicate`)
                .expect(201);

            const tagNames = response.body.tags.map((t) => t.name).sort();
            expect(tagNames).toEqual(['urgent', 'work']);
        });
    });

    describe('Copy suffix', () => {
        it('should not stack "(copy)" suffix', async () => {
            const sourceTask = await Task.create({
                name: 'Task (copy)',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const response = await agent
                .post(`/api/task/${sourceTask.uid}/duplicate`)
                .expect(201);

            expect(response.body.name).toBe('Task (copy)');
        });
    });

    describe('Habit task', () => {
        it('should return 400 for habit tasks', async () => {
            const habitTask = await Task.create({
                name: 'Habit Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                habit_mode: true,
                habit_target_count: 3,
                habit_frequency_period: 'daily',
            });

            const response = await agent
                .post(`/api/task/${habitTask.uid}/duplicate`)
                .expect(400);

            expect(response.body.error).toBe(
                'Habit tasks cannot be duplicated.'
            );
        });
    });

    describe('Recurring task', () => {
        it('should strip recurrence fields from duplicate', async () => {
            const recurringTask = await Task.create({
                name: 'Recurring Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 1,
                completion_based: true,
            });

            const response = await agent
                .post(`/api/task/${recurringTask.uid}/duplicate`)
                .expect(201);

            expect(response.body.name).toBe('Recurring Task (copy)');
            expect(response.body.recurrence_type).toBe('none');
            expect(response.body.recurrence_interval).toBeNull();
            expect(response.body.recurrence_weekday).toBeNull();
            expect(response.body.completion_based).toBe(false);
        });
    });

    describe('Authentication', () => {
        it('should return 401 for unauthenticated requests', async () => {
            const task = await Task.create({
                name: 'Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const response = await request(app)
                .post(`/api/task/${task.uid}/duplicate`)
                .expect(401);

            expect(response.status).toBe(401);
        });
    });

    describe('Not found', () => {
        it('should return 403 for non-existent task (access middleware)', async () => {
            const response = await agent
                .post('/api/task/nonexistent12345/duplicate')
                .expect(403);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('Cross-user access', () => {
        it("should return 403 when duplicating another user's task with no shared access", async () => {
            const otherUser = await createTestUser({
                email: `other_${Date.now()}@test.com`,
            });

            const otherUsersTask = await Task.create({
                name: "Other User's Task",
                user_id: otherUser.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const response = await agent
                .post(`/api/task/${otherUsersTask.uid}/duplicate`)
                .expect(403);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('Write-access gap on project/area inheritance', () => {
        it('should drop project_id when duplicating user only has read access to the shared project', async () => {
            const ownerUser = await createTestUser({
                email: `owner_${Date.now()}@test.com`,
            });

            const ownerAgent = request.agent(app);
            await ownerAgent.post('/api/login').send({
                email: ownerUser.email,
                password: 'password123',
            });

            const projectResponse = await ownerAgent
                .post('/api/project')
                .send({ name: 'Owner Project' });
            const project = projectResponse.body;

            // Share the project READ-ONLY with the duplicating user (testUser)
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: testUser.email,
                access_level: 'ro',
            });

            const sourceTask = await Task.create({
                name: 'Task in shared project',
                user_id: ownerUser.id,
                project_id: project.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const response = await agent
                .post(`/api/task/${sourceTask.uid}/duplicate`)
                .expect(201);

            expect(response.body.name).toBe('Task in shared project (copy)');
            expect(response.body.project_id).toBeNull();
            expect(response.body.project_uid).toBeNull();
        });
    });
});
