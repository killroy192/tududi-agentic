const request = require('supertest');
const app = require('../../app');
const { Task, Project, Area, Tag, Permission, Role } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task access_level', () => {
    let owner, roUser, rwUser, adminUser, outsider;
    let ownerAgent, roAgent, rwAgent, adminAgent, outsiderAgent;
    let shared, adminOwned;

    async function login(user) {
        const agent = request.agent(app);
        const response = await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        expect(response.status).toBe(200);
        return agent;
    }

    async function setAdmin(user, isAdmin) {
        const [role] = await Role.findOrCreate({
            where: { user_id: user.id },
            defaults: { user_id: user.id, is_admin: isAdmin },
        });
        if (role.is_admin !== isAdmin) {
            await role.update({ is_admin: isAdmin });
        }
    }

    async function shareProject(project, user, accessLevel) {
        await Permission.create({
            user_id: user.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: accessLevel,
            propagation: 'direct',
            granted_by_user_id: project.user_id,
        });
    }

    async function makeTrackedTask(user, label) {
        const project = await Project.create({
            name: `${label} project`,
            user_id: user.id,
        });
        const area = await Area.create({
            name: `${label} area`,
            user_id: user.id,
        });
        const tag = await Tag.create({
            name: `${label}-tag`,
            user_id: user.id,
        });
        const due = new Date();
        due.setUTCHours(12, 0, 0, 0);
        const task = await Task.create({
            name: `${label} task`,
            user_id: user.id,
            project_id: project.id,
            area_id: area.id,
            status: Task.STATUS.IN_PROGRESS,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            due_date: due,
        });
        await task.addTag(tag);
        const subtask = await Task.create({
            name: `${label} subtask`,
            user_id: user.id,
            project_id: project.id,
            parent_task_id: task.id,
            status: Task.STATUS.NOT_STARTED,
        });
        return { task, subtask, project, area, tag, label };
    }

    function matches(tasks, uid) {
        return (tasks || []).filter((task) => task && task.uid === uid);
    }

    function expectLevel(tasks, uid, level) {
        const found = matches(tasks, uid);
        expect(found.length).toBeGreaterThan(0);
        found.forEach((task) => {
            expect(task.access_level).toBe(level);
        });
        return found;
    }

    beforeEach(async () => {
        const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        owner = await createTestUser({ email: `owner_${stamp}@example.com` });
        roUser = await createTestUser({ email: `ro_${stamp}@example.com` });
        rwUser = await createTestUser({ email: `rw_${stamp}@example.com` });
        adminUser = await createTestUser({
            email: `admin_${stamp}@example.com`,
        });
        outsider = await createTestUser({
            email: `outsider_${stamp}@example.com`,
        });

        await setAdmin(owner, false);
        await setAdmin(roUser, false);
        await setAdmin(rwUser, false);
        await setAdmin(outsider, false);
        await setAdmin(adminUser, true);

        ownerAgent = await login(owner);
        roAgent = await login(roUser);
        rwAgent = await login(rwUser);
        adminAgent = await login(adminUser);
        outsiderAgent = await login(outsider);

        shared = await makeTrackedTask(owner, `shared-${stamp}`);
        await shareProject(shared.project, roUser, 'ro');
        await shareProject(shared.project, rwUser, 'rw');
        adminOwned = await makeTrackedTask(adminUser, `admin-${stamp}`);
    });

    function viewers() {
        return [
            { name: 'owner', agent: ownerAgent, level: 'rw', subject: shared },
            {
                name: 'ro share',
                agent: roAgent,
                level: 'ro',
                subject: shared,
            },
            {
                name: 'rw share',
                agent: rwAgent,
                level: 'rw',
                subject: shared,
            },
            {
                name: 'admin',
                agent: adminAgent,
                level: 'rw',
                subject: adminOwned,
            },
        ];
    }

    it('sets access_level on GET /task/:uid, including nested subtasks', async () => {
        for (const viewer of viewers()) {
            const response = await viewer.agent.get(
                `/api/task/${viewer.subject.task.uid}`
            );
            expect(response.status).toBe(200);
            expect(response.body.access_level).toBe(viewer.level);
            const nested = response.body.subtasks.find(
                (subtask) => subtask.uid === viewer.subject.subtask.uid
            );
            expect(nested).toBeDefined();
            expect(nested.access_level).toBe(viewer.level);
        }
    });

    it('sets access_level on GET /tasks for default, today, tag, area, and project filters', async () => {
        for (const viewer of viewers()) {
            const { task, tag, area, project } = viewer.subject;
            const queries = [
                {},
                { type: 'today' },
                { tag: tag.name },
                { area_id: area.id },
                { project_id: project.id },
            ];
            for (const query of queries) {
                const response = await viewer.agent
                    .get('/api/tasks')
                    .query(query);
                expect(response.status).toBe(200);
                const found = expectLevel(
                    response.body.tasks,
                    task.uid,
                    viewer.level
                );
                const nested = found[0].subtasks.find(
                    (subtask) => subtask.uid === viewer.subject.subtask.uid
                );
                expect(nested).toBeDefined();
                expect(nested.access_level).toBe(viewer.level);
            }
        }
    });

    it('copies the parent access_level onto upcoming virtual occurrence rows', async () => {
        for (const viewer of viewers()) {
            const response = await viewer.agent.get('/api/tasks').query({
                type: 'upcoming',
                groupBy: 'day',
            });
            expect(response.status).toBe(200);
            const listed = expectLevel(
                response.body.tasks,
                viewer.subject.task.uid,
                viewer.level
            );
            expect(
                listed.some((task) => task.is_virtual_occurrence === true)
            ).toBe(true);

            const grouped = Object.values(
                response.body.groupedTasks || {}
            ).flat();
            const groupedRows = expectLevel(
                grouped,
                viewer.subject.task.uid,
                viewer.level
            );
            expect(
                groupedRows.some((task) => task.is_virtual_occurrence === true)
            ).toBe(true);
        }
    });

    it('sets access_level on today metrics lists', async () => {
        for (const viewer of viewers()) {
            const today = await viewer.agent.get('/api/tasks').query({
                type: 'today',
                include_lists: 'true',
            });
            expect(today.status).toBe(200);
            expectLevel(
                today.body.tasks_in_progress,
                viewer.subject.task.uid,
                viewer.level
            );

            const metrics = await viewer.agent.get('/api/tasks/metrics');
            expect(metrics.status).toBe(200);
            expectLevel(
                metrics.body.tasks_in_progress,
                viewer.subject.task.uid,
                viewer.level
            );
        }
    });

    it('sets access_level on project detail tasks and nested subtasks', async () => {
        for (const viewer of viewers()) {
            const response = await viewer.agent.get(
                `/api/project/${viewer.subject.project.uid}`
            );
            expect(response.status).toBe(200);
            const tasks = response.body.Tasks || response.body.tasks;
            const found = expectLevel(
                tasks,
                viewer.subject.task.uid,
                viewer.level
            );
            const nested = (found[0].subtasks || found[0].Subtasks || []).find(
                (subtask) => subtask.uid === viewer.subject.subtask.uid
            );
            expect(nested).toBeDefined();
            expect(nested.access_level).toBe(viewer.level);
        }
    });

    it('sets access_level on search results the viewer owns', async () => {
        const owners = viewers().filter(
            (viewer) =>
                viewer.agent === ownerAgent || viewer.agent === adminAgent
        );
        for (const viewer of owners) {
            const response = await viewer.agent.get('/api/search').query({
                q: viewer.subject.task.name,
                filters: 'Task',
            });
            expect(response.status).toBe(200);
            const hit = (response.body.results || []).find(
                (result) => result.uid === viewer.subject.task.uid
            );
            expect(hit).toBeDefined();
            expect(hit.access_level).toBe(viewer.level);
        }
    });

    it('does not return another user task from search for a project sharee', async () => {
        for (const agent of [roAgent, rwAgent]) {
            const response = await agent.get('/api/search').query({
                q: shared.task.name,
                filters: 'Task',
            });
            expect(response.status).toBe(200);
            const hit = (response.body.results || []).find(
                (result) => result.uid === shared.task.uid
            );
            expect(hit).toBeUndefined();
        }
    });

    it('sets access_level on GET /task/:uid/subtasks', async () => {
        for (const viewer of viewers()) {
            const response = await viewer.agent.get(
                `/api/task/${viewer.subject.task.uid}/subtasks`
            );
            expect(response.status).toBe(200);
            const subtask = response.body.find(
                (item) => item.uid === viewer.subject.subtask.uid
            );
            expect(subtask).toBeDefined();
            expect(subtask.access_level).toBe(viewer.level);
        }
    });

    it('returns the requester access_level from POST and PATCH', async () => {
        const created = await ownerAgent
            .post('/api/task')
            .send({ name: 'Created with access level' });
        expect(created.status).toBe(201);
        expect(created.body.access_level).toBe('rw');

        const updated = await rwAgent
            .patch(`/api/task/${shared.task.uid}`)
            .send({ name: 'Renamed by writer' });
        expect(updated.status).toBe(200);
        expect(updated.body.access_level).toBe('rw');
        expect(updated.body.name).toBe('Renamed by writer');
    });

    describe('AC-7 size permissions', () => {
        it('rejects a read-only size update with 403 and leaves size unchanged', async () => {
            await shared.task.update({ size: 'M' });

            const response = await roAgent
                .patch(`/api/task/${shared.task.uid}`)
                .send({ size: 'S', name: 'should not stick' });

            expect(response.status).toBe(403);
            const stored = await Task.findByPk(shared.task.id);
            expect(stored.size).toBe('M');
            expect(stored.name).toBe(shared.task.name);
        });

        it('lets a read-write share user set size', async () => {
            const response = await rwAgent
                .patch(`/api/task/${shared.task.uid}`)
                .send({ size: 'S' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('S');
            expect(response.body.access_level).toBe('rw');
            const stored = await Task.findByPk(shared.task.id);
            expect(stored.size).toBe('S');
        });

        it('lets a system admin set size on a task they can write', async () => {
            const response = await adminAgent
                .patch(`/api/task/${adminOwned.task.uid}`)
                .send({ size: 'XL' });

            expect(response.status).toBe(200);
            expect(response.body.size).toBe('XL');
            expect(response.body.access_level).toBe('rw');
            const stored = await Task.findByPk(adminOwned.task.id);
            expect(stored.size).toBe('XL');
        });

        it('returns 403 when patching a missing task uid', async () => {
            const response = await ownerAgent
                .patch('/api/task/missing-task-uid')
                .send({ size: 'S' });

            expect(response.status).toBe(403);
        });

        it('returns 403 when a user with no access reads the task', async () => {
            const response = await outsiderAgent.get(
                `/api/task/${shared.task.uid}`
            );

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });
    });
});
