const {
    getAccess,
    getSharedUidsForUser,
    getTaskAccessMap,
    ownershipOrPermissionWhere,
    ACCESS,
} = require('../../../services/permissionsService');
const {
    User,
    Project,
    Task,
    Note,
    Permission,
    sequelize,
} = require('../../../models');
const bcrypt = require('bcrypt');

describe('permissionsService', () => {
    let owner, otherUser, adminUser;

    beforeEach(async () => {
        await sequelize.query('DELETE FROM permissions');
        await sequelize.query('DELETE FROM roles');
        const hash = await bcrypt.hash('pass', 10);
        // First user created gets admin role automatically via afterCreate hook
        adminUser = await User.create({
            email: 'admin@test.com',
            password_digest: hash,
        });
        owner = await User.create({
            email: 'owner@test.com',
            password_digest: hash,
        });
        otherUser = await User.create({
            email: 'other@test.com',
            password_digest: hash,
        });
    });

    describe('getAccess', () => {
        // --- Projects ---

        it('should return rw for project owner', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            const access = await getAccess(owner.id, 'project', project.uid);
            expect(access).toBe('rw');
        });

        it('should return none for non-owner without permission', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            const access = await getAccess(
                otherUser.id,
                'project',
                project.uid
            );
            expect(access).toBe('none');
        });

        it('should return admin for admin user', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            const access = await getAccess(
                adminUser.uid,
                'project',
                project.uid
            );
            expect(access).toBe('admin');
        });

        it('should return none for non-existent project', async () => {
            const access = await getAccess(
                owner.id,
                'project',
                'nonexistent-uid'
            );
            expect(access).toBe('none');
        });

        it('should return shared permission level for project', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(
                otherUser.id,
                'project',
                project.uid
            );
            expect(access).toBe('ro');
        });

        // --- Tasks ---

        it('should return rw for task owner', async () => {
            const task = await Task.create({ name: 'T1', user_id: owner.id });
            const access = await getAccess(owner.id, 'task', task.uid);
            expect(access).toBe('rw');
        });

        it('should return none for non-owner task without permission', async () => {
            const task = await Task.create({ name: 'T1', user_id: owner.id });
            const access = await getAccess(otherUser.id, 'task', task.uid);
            expect(access).toBe('none');
        });

        it('should return none for non-existent task', async () => {
            const access = await getAccess(owner.id, 'task', 'no-such-task');
            expect(access).toBe('none');
        });

        it('should inherit task access from parent project permission', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            const task = await Task.create({
                name: 'T1',
                user_id: owner.id,
                project_id: project.id,
            });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'task', task.uid);
            expect(access).toBe('rw');
        });

        it('should return shared permission for directly shared task', async () => {
            const task = await Task.create({ name: 'T1', user_id: owner.id });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'task',
                resource_uid: task.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'task', task.uid);
            expect(access).toBe('ro');
        });

        // --- Notes ---

        it('should return rw for note owner', async () => {
            const note = await Note.create({ title: 'N1', user_id: owner.id });
            const access = await getAccess(owner.id, 'note', note.uid);
            expect(access).toBe('rw');
        });

        it('should return none for non-owner note without permission', async () => {
            const note = await Note.create({ title: 'N1', user_id: owner.id });
            const access = await getAccess(otherUser.id, 'note', note.uid);
            expect(access).toBe('none');
        });

        it('should inherit note access from parent project permission', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            const note = await Note.create({
                title: 'N1',
                user_id: owner.id,
                project_id: project.id,
            });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const access = await getAccess(otherUser.id, 'note', note.uid);
            expect(access).toBe('ro');
        });
    });

    describe('getSharedUidsForUser', () => {
        it('should return empty array when no permissions exist', async () => {
            const uids = await getSharedUidsForUser('project', otherUser.id);
            expect(uids).toEqual([]);
        });

        it('should return shared resource uids', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const uids = await getSharedUidsForUser('project', otherUser.id);
            expect(uids).toContain(project.uid);
        });

        it('should deduplicate uids', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            // Create two permissions for the same resource (different propagation)
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'ro',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
            const uids = await getSharedUidsForUser('project', otherUser.id);
            const uniqueUids = [...new Set(uids)];
            expect(uids.length).toBe(uniqueUids.length);
        });
    });

    describe('ownershipOrPermissionWhere', () => {
        it('should include user_id condition for owned resources', async () => {
            const where = await ownershipOrPermissionWhere('project', owner.id);
            expect(where).toBeDefined();
            // Should contain an Op.or with user_id condition
            const orKey = Object.getOwnPropertySymbols(where)[0];
            expect(orKey).toBeDefined();
            const conditions = where[orKey];
            expect(conditions.some((c) => c.user_id === owner.id)).toBe(true);
        });

        it('should include shared resource uids when permissions exist', async () => {
            const project = await Project.create({
                name: 'Shared',
                user_id: owner.id,
            });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });

            const where = await ownershipOrPermissionWhere(
                'project',
                otherUser.id
            );
            const orKey = Object.getOwnPropertySymbols(where)[0];
            const conditions = where[orKey];
            // Should have a uid IN condition with the shared project uid
            const uidCondition = conditions.find((c) => c.uid);
            expect(uidCondition).toBeDefined();
        });

        it('should use cache when provided', async () => {
            const cache = new Map();
            const where1 = await ownershipOrPermissionWhere(
                'project',
                owner.id,
                cache
            );
            const where2 = await ownershipOrPermissionWhere(
                'project',
                owner.id,
                cache
            );
            expect(where1).toBe(where2); // same reference from cache
        });

        it('should include tasks from shared projects for task resource type', async () => {
            const project = await Project.create({
                name: 'P1',
                user_id: owner.id,
            });
            await Task.create({
                name: 'T1',
                user_id: owner.id,
                project_id: project.id,
            });
            await Permission.create({
                user_id: otherUser.id,
                resource_type: 'project',
                resource_uid: project.uid,
                access_level: 'rw',
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });

            const where = await ownershipOrPermissionWhere(
                'task',
                otherUser.id
            );
            const orKey = Object.getOwnPropertySymbols(where)[0];
            const conditions = where[orKey];
            // Should have a project_id IN condition
            const projectCondition = conditions.find((c) => c.project_id);
            expect(projectCondition).toBeDefined();
        });
    });

    describe('ACCESS constants', () => {
        it('should export expected access levels', () => {
            expect(ACCESS.NONE).toBe('none');
            expect(ACCESS.RO).toBe('ro');
            expect(ACCESS.RW).toBe('rw');
            expect(ACCESS.ADMIN).toBe('admin');
        });
    });

    describe('getTaskAccessMap', () => {
        async function share(user, resourceType, resourceUid, accessLevel) {
            await Permission.create({
                user_id: user.id,
                resource_type: resourceType,
                resource_uid: resourceUid,
                access_level: accessLevel,
                propagation: 'direct',
                granted_by_user_id: owner.id,
            });
        }

        it('matches getAccess for owner, direct shares, project shares, no access, and system admin', async () => {
            const owned = await Task.create({
                name: 'Owned',
                user_id: owner.id,
            });
            const directRo = await Task.create({
                name: 'Direct ro',
                user_id: owner.id,
            });
            const directRw = await Task.create({
                name: 'Direct rw',
                user_id: owner.id,
            });
            const projectRo = await Project.create({
                name: 'Project ro',
                user_id: owner.id,
            });
            const taskProjectRo = await Task.create({
                name: 'Task in ro project',
                user_id: owner.id,
                project_id: projectRo.id,
            });
            const projectRw = await Project.create({
                name: 'Project rw',
                user_id: owner.id,
            });
            const taskProjectRw = await Task.create({
                name: 'Task in rw project',
                user_id: owner.id,
                project_id: projectRw.id,
            });
            const untouched = await Task.create({
                name: 'No access',
                user_id: owner.id,
            });
            const child = await Task.create({
                name: 'Subtask',
                user_id: owner.id,
                parent_task_id: owned.id,
                project_id: projectRo.id,
            });
            const projectAndDirect = await Task.create({
                name: 'Project ro beats direct rw',
                user_id: owner.id,
                project_id: projectRo.id,
            });

            await share(otherUser, 'task', directRo.uid, 'ro');
            await share(otherUser, 'task', directRw.uid, 'rw');
            await share(otherUser, 'task', projectAndDirect.uid, 'rw');
            await share(otherUser, 'project', projectRo.uid, 'ro');
            await share(otherUser, 'project', projectRw.uid, 'rw');

            const cases = [
                ['owner', owner.id, owned, 'rw'],
                [
                    'owner inside a shared project',
                    owner.id,
                    taskProjectRo,
                    'rw',
                ],
                ['direct ro share', otherUser.id, directRo, 'ro'],
                ['direct rw share', otherUser.id, directRw, 'rw'],
                ['project ro share', otherUser.id, taskProjectRo, 'ro'],
                ['project rw share', otherUser.id, taskProjectRw, 'rw'],
                [
                    'project share before direct share',
                    otherUser.id,
                    projectAndDirect,
                    'ro',
                ],
                ['no access', otherUser.id, untouched, 'none'],
                ['system admin', adminUser.uid, untouched, 'admin'],
                [
                    'nested subtask in a shared project',
                    otherUser.id,
                    child,
                    'ro',
                ],
            ];

            for (const [label, userId, task, expected] of cases) {
                const direct = await getAccess(userId, 'task', task.uid);
                expect({ label, access: direct }).toEqual({
                    label,
                    access: expected,
                });
                const map = await getTaskAccessMap(userId, [task]);
                expect(map.get(task.uid)).toBe(expected);
                expect(map.get(task.id)).toBe(expected);
            }

            const parentWithNested = owned.toJSON();
            parentWithNested.Subtasks = [child.toJSON()];
            const mixed = await getTaskAccessMap(otherUser.id, [
                parentWithNested,
                directRo,
                directRw,
                taskProjectRo,
                taskProjectRw,
                projectAndDirect,
                untouched,
            ]);
            expect(mixed.get(owned.uid)).toBe('none');
            expect(mixed.get(child.uid)).toBe('ro');
            expect(mixed.get(directRo.uid)).toBe('ro');
            expect(mixed.get(directRw.uid)).toBe('rw');
            expect(mixed.get(taskProjectRo.uid)).toBe('ro');
            expect(mixed.get(taskProjectRw.uid)).toBe('rw');
            expect(mixed.get(projectAndDirect.uid)).toBe('ro');
            expect(mixed.get(untouched.uid)).toBe('none');
        });

        it('keeps the query count constant as the task list grows', async () => {
            const project = await Project.create({
                name: 'Bulk project',
                user_id: owner.id,
            });
            await share(otherUser, 'project', project.uid, 'ro');

            const buildTasks = async (count) => {
                const tasks = [];
                for (let i = 0; i < count; i++) {
                    tasks.push(
                        await Task.create({
                            name: `Bulk ${count}-${i}`,
                            user_id: owner.id,
                            project_id: i % 5 === 0 ? null : project.id,
                        })
                    );
                }
                const direct = tasks.find((task) => task.project_id == null);
                await share(otherUser, 'task', direct.uid, 'rw');
                return tasks;
            };

            const countQueries = async (tasks) => {
                const previous = sequelize.options.logging;
                let queries = 0;
                sequelize.options.logging = () => {
                    queries += 1;
                };
                try {
                    const map = await getTaskAccessMap(otherUser.id, tasks);
                    expect(map.get(tasks[0].uid)).toBe(
                        tasks[0].project_id ? 'ro' : 'rw'
                    );
                    return queries;
                } finally {
                    sequelize.options.logging = previous;
                }
            };

            const small = await buildTasks(4);
            const large = await buildTasks(40);
            const smallQueries = await countQueries(small);
            const largeQueries = await countQueries(large);

            expect(smallQueries).toBeGreaterThan(0);
            expect(largeQueries).toBe(smallQueries);
            expect(largeQueries).toBeLessThanOrEqual(6);
        });
    });
});
