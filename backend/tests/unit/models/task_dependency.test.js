const { Task, TaskDependency, User } = require('../../../models');

describe('TaskDependency Model', () => {
    let user;
    let taskA;
    let taskB;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        taskA = await Task.create({ name: 'Task A', user_id: user.id });
        taskB = await Task.create({ name: 'Task B', user_id: user.id });
    });

    it('should create a dependency record linking blocker and blocked tasks', async () => {
        const dependency = await TaskDependency.create({
            blocker_task_id: taskA.id,
            blocked_task_id: taskB.id,
        });

        expect(dependency.blocker_task_id).toBe(taskA.id);
        expect(dependency.blocked_task_id).toBe(taskB.id);
    });

    it('should require blocker_task_id and blocked_task_id', async () => {
        await expect(TaskDependency.create({})).rejects.toThrow();
    });

    it('should read a dependency record back from the database', async () => {
        await TaskDependency.create({
            blocker_task_id: taskA.id,
            blocked_task_id: taskB.id,
        });

        const found = await TaskDependency.findOne({
            where: { blocker_task_id: taskA.id, blocked_task_id: taskB.id },
        });

        expect(found).not.toBeNull();
    });

    it('should delete a dependency record', async () => {
        const dependency = await TaskDependency.create({
            blocker_task_id: taskA.id,
            blocked_task_id: taskB.id,
        });

        await dependency.destroy();

        const found = await TaskDependency.findOne({
            where: { blocker_task_id: taskA.id, blocked_task_id: taskB.id },
        });

        expect(found).toBeNull();
    });

    it('should eager-load BlockerTasks and BlockingTasks associations', async () => {
        await TaskDependency.create({
            blocker_task_id: taskA.id,
            blocked_task_id: taskB.id,
        });

        const loadedA = await Task.findByPk(taskA.id, {
            include: [{ model: Task, as: 'BlockingTasks' }],
        });
        const loadedB = await Task.findByPk(taskB.id, {
            include: [{ model: Task, as: 'BlockerTasks' }],
        });

        expect(loadedA.BlockingTasks).toHaveLength(1);
        expect(loadedA.BlockingTasks[0].id).toBe(taskB.id);

        expect(loadedB.BlockerTasks).toHaveLength(1);
        expect(loadedB.BlockerTasks[0].id).toBe(taskA.id);
    });
});
