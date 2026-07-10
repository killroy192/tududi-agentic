const { Task, TaskDependency, User } = require('../../../../models');
const {
    addDependency,
    removeDependency,
    getDependencies,
    hasCycle,
    isRecurringTemplate,
    removeAllDependenciesForTask,
} = require('../../../../modules/tasks/operations/dependencies');

describe('Task Dependency Operations', () => {
    let user;
    let otherUser;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'owner@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
        otherUser = await User.create({
            email: 'other@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    const createTask = (overrides = {}) =>
        Task.create({ name: 'Task', user_id: user.id, ...overrides });

    describe('isRecurringTemplate', () => {
        it('returns true for a recurring template task', () => {
            expect(
                isRecurringTemplate({
                    recurrence_type: 'daily',
                    recurring_parent_id: null,
                })
            ).toBe(true);
        });

        it('returns false for a non-recurring task', () => {
            expect(
                isRecurringTemplate({
                    recurrence_type: 'none',
                    recurring_parent_id: null,
                })
            ).toBe(false);
        });

        it('returns false for a recurring instance (has a recurring_parent_id)', () => {
            expect(
                isRecurringTemplate({
                    recurrence_type: 'daily',
                    recurring_parent_id: 5,
                })
            ).toBe(false);
        });
    });

    describe('addDependency', () => {
        it('creates a dependency between two owned tasks', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });

            await addDependency(taskA.id, taskB.id, user.id);

            const found = await TaskDependency.findOne({
                where: { blocker_task_id: taskA.id, blocked_task_id: taskB.id },
            });
            expect(found).not.toBeNull();
        });

        it('rejects a self-referencing dependency', async () => {
            const taskA = await createTask({ name: 'A' });

            await expect(
                addDependency(taskA.id, taskA.id, user.id)
            ).rejects.toThrow('A task cannot depend on itself.');
        });

        it('rejects blocking a recurring template task', async () => {
            const taskA = await createTask({ name: 'A' });
            const recurringTemplate = await createTask({
                name: 'Recurring',
                recurrence_type: 'daily',
            });

            await expect(
                addDependency(taskA.id, recurringTemplate.id, user.id)
            ).rejects.toThrow('A recurring task cannot be blocked.');
        });

        it('allows a recurring template task to be a blocker', async () => {
            const recurringTemplate = await createTask({
                name: 'Recurring',
                recurrence_type: 'daily',
            });
            const taskB = await createTask({ name: 'B' });

            await expect(
                addDependency(recurringTemplate.id, taskB.id, user.id)
            ).resolves.toBeDefined();
        });

        it('rejects a dependency that would create a cycle', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });
            const taskC = await createTask({ name: 'C' });

            await addDependency(taskA.id, taskB.id, user.id); // A blocks B
            await addDependency(taskB.id, taskC.id, user.id); // B blocks C

            await expect(
                addDependency(taskC.id, taskA.id, user.id) // C blocks A -> cycle
            ).rejects.toThrow(
                'This dependency would create a circular relationship.'
            );
        });

        it('rejects when the blocker task does not belong to the user', async () => {
            const taskA = await createTask({ name: 'A' });
            const foreignTask = await Task.create({
                name: 'Foreign',
                user_id: otherUser.id,
            });

            await expect(
                addDependency(foreignTask.id, taskA.id, user.id)
            ).rejects.toThrow('Blocker task not found.');
        });

        it('rejects when the blocked task does not belong to the user', async () => {
            const taskA = await createTask({ name: 'A' });
            const foreignTask = await Task.create({
                name: 'Foreign',
                user_id: otherUser.id,
            });

            await expect(
                addDependency(taskA.id, foreignTask.id, user.id)
            ).rejects.toThrow('Blocked task not found.');
        });

        it('is idempotent when adding the same dependency twice', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });

            await addDependency(taskA.id, taskB.id, user.id);
            await addDependency(taskA.id, taskB.id, user.id);

            const count = await TaskDependency.count({
                where: { blocker_task_id: taskA.id, blocked_task_id: taskB.id },
            });
            expect(count).toBe(1);
        });
    });

    describe('hasCycle', () => {
        it('detects a direct cycle', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });

            await addDependency(taskA.id, taskB.id, user.id);

            expect(await hasCycle(taskB.id, taskA.id)).toBe(true);
        });

        it('detects a transitive cycle', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });
            const taskC = await createTask({ name: 'C' });

            await addDependency(taskA.id, taskB.id, user.id);
            await addDependency(taskB.id, taskC.id, user.id);

            expect(await hasCycle(taskC.id, taskA.id)).toBe(true);
        });

        it('returns false when no cycle would be formed', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });
            const taskC = await createTask({ name: 'C' });

            await addDependency(taskA.id, taskB.id, user.id);

            expect(await hasCycle(taskA.id, taskC.id)).toBe(false);
        });
    });

    describe('removeDependency', () => {
        it('removes an existing dependency', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });

            await addDependency(taskA.id, taskB.id, user.id);
            await removeDependency(taskA.id, taskB.id, user.id);

            const found = await TaskDependency.findOne({
                where: { blocker_task_id: taskA.id, blocked_task_id: taskB.id },
            });
            expect(found).toBeNull();
        });
    });

    describe('getDependencies', () => {
        it('returns both blockers and blocking tasks', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });
            const taskC = await createTask({ name: 'C' });

            await addDependency(taskA.id, taskB.id, user.id); // A blocks B
            await addDependency(taskC.id, taskB.id, user.id); // C blocks B

            const dependencies = await getDependencies(taskB.id);

            expect(dependencies.blockers).toHaveLength(2);
            expect(dependencies.blockers.map((t) => t.uid).sort()).toEqual(
                [taskA.uid, taskC.uid].sort()
            );
            expect(dependencies.blocking).toHaveLength(0);
        });

        it('returns empty arrays for a task with no dependencies', async () => {
            const taskA = await createTask({ name: 'A' });

            const dependencies = await getDependencies(taskA.id);

            expect(dependencies.blockers).toEqual([]);
            expect(dependencies.blocking).toEqual([]);
        });
    });

    describe('removeAllDependenciesForTask', () => {
        it('removes all dependencies where the task is a blocker or blocked', async () => {
            const taskA = await createTask({ name: 'A' });
            const taskB = await createTask({ name: 'B' });
            const taskC = await createTask({ name: 'C' });

            await addDependency(taskA.id, taskB.id, user.id); // A blocks B
            await addDependency(taskC.id, taskA.id, user.id); // C blocks A

            await removeAllDependenciesForTask(taskA.id);

            const remaining = await TaskDependency.count({});
            expect(remaining).toBe(0);
        });
    });
});
