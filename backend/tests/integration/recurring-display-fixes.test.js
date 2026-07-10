const request = require('supertest');
const app = require('../../app');
const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Recurring Task Display Fixes', () => {
    let user, project, agent, userEmail;

    beforeEach(async () => {
        userEmail = `recurring-display-${Date.now()}@example.com`;
        user = await createTestUser({
            email: userEmail,
        });

        project = await Project.create({
            name: 'Test Project',
            user_id: user.id,
        });

        agent = request.agent(app);
        const loginResponse = await agent.post('/api/login').send({
            email: userEmail,
            password: 'password123',
        });
        expect(loginResponse.status).toBe(200);
    });

    async function fetchProjectTasks() {
        const response = await agent.get(`/api/tasks?project_id=${project.id}`);
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.tasks)).toBe(true);
        return response.body.tasks;
    }

    function findTaskByUid(tasks, task) {
        return tasks.find((t) => t.uid === task.uid);
    }

    describe('Recurrence Type Display Names', () => {
        it('should show "Daily" instead of recurring task template name', async () => {
            const recurringTemplate = await Task.create({
                name: 'Daily Workout Original Name',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await recurringTemplate.reload();

            const tasks = await fetchProjectTasks();
            const task = findTaskByUid(tasks, recurringTemplate);

            expect(task).toBeDefined();
            expect(task.name).toBe('Daily');
            expect(task.original_name).toBe('Daily Workout Original Name');
            expect(task.recurrence_type).toBe('daily');
        });

        it('should show "Weekly" for weekly recurring tasks', async () => {
            const weeklyTask = await Task.create({
                name: 'Weekly Review Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await weeklyTask.reload();

            const tasks = await fetchProjectTasks();
            const task = findTaskByUid(tasks, weeklyTask);

            expect(task).toBeDefined();
            expect(task.name).toBe('Weekly');
            expect(task.original_name).toBe('Weekly Review Task');
        });

        it('should show "Monthly" for monthly recurring tasks', async () => {
            const monthlyTask = await Task.create({
                name: 'Monthly Report',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'monthly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await monthlyTask.reload();

            const tasks = await fetchProjectTasks();
            const task = findTaskByUid(tasks, monthlyTask);

            expect(task).toBeDefined();
            expect(task.name).toBe('Monthly');
            expect(task.original_name).toBe('Monthly Report');
        });

        it('should show "Yearly" for yearly recurring tasks', async () => {
            const yearlyTask = await Task.create({
                name: 'Annual Tax Filing',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'yearly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await yearlyTask.reload();

            const tasks = await fetchProjectTasks();
            const task = findTaskByUid(tasks, yearlyTask);

            expect(task).toBeDefined();
            expect(task.name).toBe('Yearly');
            expect(task.original_name).toBe('Annual Tax Filing');
        });

        it('should not modify names of non-recurring tasks', async () => {
            const regularTask = await Task.create({
                name: 'Regular Task Name',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await regularTask.reload();

            const tasks = await fetchProjectTasks();
            const task = findTaskByUid(tasks, regularTask);

            expect(task).toBeDefined();
            expect(task.name).toBe('Regular Task Name');
            expect(task.original_name).toBe('Regular Task Name');
        });

        it('should not modify names of recurring task instances', async () => {
            const template = await Task.create({
                name: 'Template Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const instance = await Task.create({
                name: 'Daily Instance - Aug 23',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: template.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await template.reload();
            await instance.reload();

            const tasks = await fetchProjectTasks();
            const templateTask = findTaskByUid(tasks, template);
            const instanceTask = findTaskByUid(tasks, instance);

            expect(templateTask).toBeDefined();
            expect(templateTask.name).toBe('Daily');
            expect(instanceTask).toBeUndefined();
        });
    });

    describe('Past Missed Recurring Tasks Filtering', () => {
        it('should hide recurring templates with past due dates', async () => {
            const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

            const pastRecurring = await Task.create({
                name: 'Past Daily Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                due_date: pastDate,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const futureRecurring = await Task.create({
                name: 'Future Daily Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                due_date: futureDate,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const pastRegular = await Task.create({
                name: 'Past Regular Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'none',
                recurring_parent_id: null,
                due_date: pastDate,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await pastRecurring.reload();
            await futureRecurring.reload();
            await pastRegular.reload();

            const tasks = await fetchProjectTasks();
            const taskUids = tasks.map((t) => t.uid);
            const taskNames = tasks.map((t) => t.name);

            expect(taskUids).not.toContain(pastRecurring.uid);
            expect(taskUids).toContain(futureRecurring.uid);
            expect(taskNames).toContain('Daily');
            expect(taskUids).toContain(pastRegular.uid);
            expect(taskNames).toContain('Past Regular Task');
        });

        it('should show recurring templates with no due date', async () => {
            const recurringNoDueDate = await Task.create({
                name: 'No Due Date Recurring',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                due_date: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await recurringNoDueDate.reload();

            const tasks = await fetchProjectTasks();
            const taskUids = tasks.map((t) => t.uid);
            const taskNames = tasks.map((t) => t.name);

            expect(taskUids).toContain(recurringNoDueDate.uid);
            expect(taskNames).toContain('Weekly');
        });

        it('should show recurring templates due today', async () => {
            const today = new Date();
            today.setHours(12, 0, 0, 0);

            const todayRecurring = await Task.create({
                name: 'Today Recurring Task',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                due_date: today,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await todayRecurring.reload();

            const tasks = await fetchProjectTasks();
            const taskUids = tasks.map((t) => t.uid);
            const taskNames = tasks.map((t) => t.name);

            expect(taskUids).toContain(todayRecurring.uid);
            expect(taskNames).toContain('Daily');
        });
    });

    describe('Task By UID Endpoint', () => {
        it('should return actual task name when fetching recurring task by UID', async () => {
            const recurringTask = await Task.create({
                name: 'My Weekly Review',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await recurringTask.reload();

            const response = await agent.get(`/api/task/${recurringTask.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('My Weekly Review');
            expect(response.body.original_name).toBe('My Weekly Review');
            expect(response.body.recurrence_type).toBe('weekly');
        });

        it('should return actual task name for monthly recurring task by UID', async () => {
            const monthlyTask = await Task.create({
                name: 'Monthly Budget Review',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'monthly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await monthlyTask.reload();

            const response = await agent.get(`/api/task/${monthlyTask.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Monthly Budget Review');
            expect(response.body.original_name).toBe('Monthly Budget Review');
            expect(response.body.recurrence_type).toBe('monthly');
        });
    });

    describe('Issue #1123: Updating Recurring Task Status', () => {
        it('should preserve task name when changing status of a daily recurring task', async () => {
            const recurringTask = await Task.create({
                name: 'Daily Exercise Routine',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'daily',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await recurringTask.reload();

            const updateResponse = await agent
                .patch(`/api/task/${recurringTask.uid}`)
                .send({
                    status: Task.STATUS.IN_PROGRESS,
                });

            expect(updateResponse.status).toBe(200);

            const fetchResponse = await agent.get(
                `/api/task/${recurringTask.uid}`
            );

            expect(fetchResponse.status).toBe(200);
            expect(fetchResponse.body.name).toBe('Daily Exercise Routine');
            expect(fetchResponse.body.status).toBe(Task.STATUS.IN_PROGRESS);
            expect(fetchResponse.body.recurrence_type).toBe('daily');
        });

        it('should preserve task name when changing status of a weekly recurring task', async () => {
            const weeklyTask = await Task.create({
                name: 'Weekly Team Meeting',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'weekly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.HIGH,
            });
            await weeklyTask.reload();

            const updateResponse = await agent
                .patch(`/api/task/${weeklyTask.uid}`)
                .send({
                    status: Task.STATUS.PLANNED,
                });

            expect(updateResponse.status).toBe(200);

            const fetchResponse = await agent.get(
                `/api/task/${weeklyTask.uid}`
            );

            expect(fetchResponse.status).toBe(200);
            expect(fetchResponse.body.name).toBe('Weekly Team Meeting');
            expect(fetchResponse.body.status).toBe(Task.STATUS.PLANNED);
        });

        it('should preserve task name when changing status of a monthly recurring task', async () => {
            const monthlyTask = await Task.create({
                name: 'Monthly Budget Review',
                user_id: user.id,
                project_id: project.id,
                recurrence_type: 'monthly',
                recurring_parent_id: null,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });
            await monthlyTask.reload();

            const updateResponse = await agent
                .patch(`/api/task/${monthlyTask.uid}`)
                .send({
                    status: Task.STATUS.CANCELLED,
                });

            expect(updateResponse.status).toBe(200);

            const fetchResponse = await agent.get(
                `/api/task/${monthlyTask.uid}`
            );

            expect(fetchResponse.status).toBe(200);
            expect(fetchResponse.body.name).toBe('Monthly Budget Review');
            expect(fetchResponse.body.status).toBe(Task.STATUS.CANCELLED);
        });
    });
});
