const { Task, User } = require('../../../models');

describe('Task Model', () => {
    let user;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('validation', () => {
        it('should create a task with valid data', async () => {
            const taskData = {
                name: 'Test Task',
                user_id: user.id,
            };

            const task = await Task.create(taskData);

            expect(task.name).toBe(taskData.name);
            expect(task.user_id).toBe(user.id);
            expect(task.priority).toBe(0);
            expect(task.status).toBe(0);
            expect(task.recurrence_type).toBe('none');
        });

        it('should require name', async () => {
            const taskData = {
                user_id: user.id,
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const taskData = {
                name: 'Test Task',
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });

        it('should validate priority range', async () => {
            const taskData = {
                name: 'Test Task',
                user_id: user.id,
                priority: 5,
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });

        it('should validate status range', async () => {
            const taskData = {
                name: 'Test Task',
                user_id: user.id,
                status: 10,
            };

            await expect(Task.create(taskData)).rejects.toThrow();
        });
    });

    describe('constants', () => {
        it('should have correct priority constants', () => {
            expect(Task.PRIORITY.LOW).toBe(0);
            expect(Task.PRIORITY.MEDIUM).toBe(1);
            expect(Task.PRIORITY.HIGH).toBe(2);
        });

        it('should have correct size constants', () => {
            expect(Task.SIZE.S).toBe(1);
            expect(Task.SIZE.M).toBe(2);
            expect(Task.SIZE.L).toBe(3);
            expect(Task.SIZE.XL).toBe(4);
        });

        it('should have correct status constants', () => {
            expect(Task.STATUS.NOT_STARTED).toBe(0);
            expect(Task.STATUS.IN_PROGRESS).toBe(1);
            expect(Task.STATUS.DONE).toBe(2);
            expect(Task.STATUS.ARCHIVED).toBe(3);
            expect(Task.STATUS.WAITING).toBe(4);
        });
    });

    describe('size converters', () => {
        it('should map size values to names', () => {
            expect(Task.getSizeName(Task.SIZE.S)).toBe('S');
            expect(Task.getSizeName(Task.SIZE.M)).toBe('M');
            expect(Task.getSizeName(Task.SIZE.L)).toBe('L');
            expect(Task.getSizeName(Task.SIZE.XL)).toBe('XL');
        });

        it('should map size names to values', () => {
            expect(Task.getSizeValue('S')).toBe(1);
            expect(Task.getSizeValue('M')).toBe(2);
            expect(Task.getSizeValue('L')).toBe(3);
            expect(Task.getSizeValue('XL')).toBe(4);
            expect(Task.getSizeValue('m')).toBe(2);
        });

        it('should reject unknown size values and names', () => {
            expect(() => Task.getSizeName(0)).toThrow(/size/i);
            expect(() => Task.getSizeName(5)).toThrow(/size/i);
            expect(() => Task.getSizeValue('foo')).toThrow(/size/i);
            expect(() => Task.getSizeValue('XS')).toThrow(/size/i);
        });
    });

    describe('size field', () => {
        it('should create without size as null', async () => {
            const task = await Task.create({
                name: 'Unset size task',
                user_id: user.id,
            });

            await task.reload();
            expect(task.size).toBeNull();
        });

        it('should accept size values 1-4', async () => {
            for (const size of [1, 2, 3, 4]) {
                const task = await Task.create({
                    name: `Size ${size}`,
                    user_id: user.id,
                    size,
                });
                expect(task.size).toBe(size);
            }
        });

        it('should reject size 0, 5, and invalid values', async () => {
            await expect(
                Task.create({
                    name: 'Bad size 0',
                    user_id: user.id,
                    size: 0,
                })
            ).rejects.toThrow();

            await expect(
                Task.create({
                    name: 'Bad size 5',
                    user_id: user.id,
                    size: 5,
                })
            ).rejects.toThrow();
        });
    });

    describe('instance methods', () => {
        let task;

        beforeEach(async () => {
            task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
            });
        });

        it('should return correct priority name', async () => {
            task.priority = Task.PRIORITY.LOW;
            expect(Task.getPriorityName(task.priority)).toBe('low');

            task.priority = Task.PRIORITY.MEDIUM;
            expect(Task.getPriorityName(task.priority)).toBe('medium');

            task.priority = Task.PRIORITY.HIGH;
            expect(Task.getPriorityName(task.priority)).toBe('high');
        });

        it('should return correct status name', async () => {
            task.status = Task.STATUS.NOT_STARTED;
            expect(Task.getStatusName(task.status)).toBe('not_started');

            task.status = Task.STATUS.IN_PROGRESS;
            expect(Task.getStatusName(task.status)).toBe('in_progress');

            task.status = Task.STATUS.DONE;
            expect(Task.getStatusName(task.status)).toBe('done');

            task.status = Task.STATUS.ARCHIVED;
            expect(Task.getStatusName(task.status)).toBe('archived');

            task.status = Task.STATUS.WAITING;
            expect(Task.getStatusName(task.status)).toBe('waiting');
        });
    });

    describe('default values', () => {
        it('should set correct default values', async () => {
            const task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
            });

            expect(task.priority).toBe(0);
            expect(task.status).toBe(0);
            expect(task.recurrence_type).toBe('none');
        });
    });

    describe('optional fields', () => {
        it('should allow optional fields to be null', async () => {
            const task = await Task.create({
                name: 'Test Task',
                user_id: user.id,
                due_date: null,
                note: null,
                recurrence_interval: null,
                recurrence_end_date: null,
                project_id: null,
            });

            expect(task.due_date).toBeNull();
            expect(task.note).toBeNull();
            expect(task.recurrence_interval).toBeNull();
            expect(task.recurrence_end_date).toBeNull();
            expect(task.project_id).toBeNull();
        });

        it('should accept optional field values', async () => {
            const dueDate = new Date();
            const task = await Task.create({
                name: 'Test Task',
                due_date: dueDate,
                priority: Task.PRIORITY.HIGH,
                status: Task.STATUS.IN_PROGRESS,
                note: 'Test Note',
                user_id: user.id,
            });

            expect(task.due_date).toEqual(dueDate);
            expect(task.priority).toBe(Task.PRIORITY.HIGH);
            expect(task.status).toBe(Task.STATUS.IN_PROGRESS);
            expect(task.note).toBe('Test Note');
        });
    });
});
