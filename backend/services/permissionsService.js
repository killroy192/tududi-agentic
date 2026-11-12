const { Op } = require('sequelize');
const { Project, Task, Note, Permission } = require('../models');
const { isAdmin } = require('./rolesService');

const ACCESS = { NONE: 'none', RO: 'ro', RW: 'rw', ADMIN: 'admin' };

async function getSharedUidsForUser(resourceType, userId) {
    const rows = await Permission.findAll({
        where: { user_id: userId, resource_type: resourceType },
        attributes: ['resource_uid'],
        raw: true,
    });
    const set = new Set(rows.map((r) => r.resource_uid));
    return Array.from(set);
}

async function getAccess(userId, resourceType, resourceUid) {
    if (await isAdmin(userId)) return ACCESS.ADMIN;

    // ownership via model
    if (resourceType === 'project') {
        const proj = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!proj) return ACCESS.NONE;
        if (proj.user_id === userId) return ACCESS.RW;
    } else if (resourceType === 'task') {
        const t = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });
        if (!t) return ACCESS.NONE;
        if (t.user_id === userId) return ACCESS.RW;

        // Check if user has access through the parent project
        if (t.project_id) {
            const project = await Project.findOne({
                where: { id: t.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    userId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess; // Inherit access from project
                }
            }
        }
    } else if (resourceType === 'note') {
        const n = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });
        if (!n) return ACCESS.NONE;
        if (n.user_id === userId) return ACCESS.RW;

        // Check if user has access through the parent project
        if (n.project_id) {
            const project = await Project.findOne({
                where: { id: n.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    userId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess; // Inherit access from project
                }
            }
        }
    }

    // shared
    const perm = await Permission.findOne({
        where: {
            user_id: userId,
            resource_type: resourceType,
            resource_uid: resourceUid,
        },
        attributes: ['access_level'],
        raw: true,
    });
    return perm ? perm.access_level : ACCESS.NONE;
}

function collectTaskRecords(tasks, bucket) {
    if (!tasks) return;
    const list = Array.isArray(tasks) ? tasks : [tasks];
    for (const task of list) {
        if (!task || (task.uid == null && task.id == null)) continue;
        bucket.push(task);
        const nested = task.Subtasks || task.subtasks;
        if (Array.isArray(nested) && nested.length > 0) {
            collectTaskRecords(nested, bucket);
        }
    }
}

function rememberAccess(map, task, level) {
    if (task.uid != null) map.set(task.uid, level);
    if (task.id != null) map.set(task.id, level);
}

/**
 * Viewer access for many tasks, identical to getAccess(userId, 'task', uid)
 * for each task. Query count stays constant for the request: one admin check,
 * one project load, one project-permission load, and one task-permission load.
 * Nested Subtasks / subtasks on the given records are included.
 */
async function getTaskAccessMap(userId, tasks) {
    const map = new Map();
    const records = [];
    collectTaskRecords(tasks, records);
    if (records.length === 0) return map;

    if (await isAdmin(userId)) {
        for (const task of records) rememberAccess(map, task, ACCESS.ADMIN);
        return map;
    }

    const pendingProject = [];
    const pendingDirect = [];

    for (const task of records) {
        if (task.user_id === userId) {
            rememberAccess(map, task, ACCESS.RW);
            continue;
        }
        if (task.project_id) {
            pendingProject.push(task);
        } else {
            pendingDirect.push(task);
        }
    }

    if (pendingProject.length > 0) {
        const projectIds = [
            ...new Set(pendingProject.map((task) => task.project_id)),
        ];
        const projects = await Project.findAll({
            where: { id: { [Op.in]: projectIds } },
            attributes: ['id', 'uid', 'user_id'],
            raw: true,
        });
        const projectsById = new Map(
            projects.map((project) => [project.id, project])
        );

        const tasksByProjectUid = new Map();
        for (const task of pendingProject) {
            const project =
                projectsById.get(task.project_id) ||
                projectsById.get(Number(task.project_id));
            if (!project) {
                pendingDirect.push(task);
                continue;
            }
            if (project.user_id === userId) {
                rememberAccess(map, task, ACCESS.RW);
                continue;
            }
            if (!tasksByProjectUid.has(project.uid)) {
                tasksByProjectUid.set(project.uid, []);
            }
            tasksByProjectUid.get(project.uid).push(task);
        }

        if (tasksByProjectUid.size > 0) {
            const projectPerms = await Permission.findAll({
                where: {
                    user_id: userId,
                    resource_type: 'project',
                    resource_uid: { [Op.in]: [...tasksByProjectUid.keys()] },
                },
                attributes: ['resource_uid', 'access_level'],
                raw: true,
            });
            const projectLevelByUid = new Map();
            for (const perm of projectPerms) {
                if (!projectLevelByUid.has(perm.resource_uid)) {
                    projectLevelByUid.set(perm.resource_uid, perm.access_level);
                }
            }
            for (const [projectUid, projectTasks] of tasksByProjectUid) {
                const level = projectLevelByUid.get(projectUid);
                if (level && level !== ACCESS.NONE) {
                    for (const task of projectTasks) {
                        rememberAccess(map, task, level);
                    }
                } else {
                    pendingDirect.push(...projectTasks);
                }
            }
        }
    }

    if (pendingDirect.length > 0) {
        const uids = [
            ...new Set(
                pendingDirect
                    .map((task) => task.uid)
                    .filter((uid) => uid != null)
            ),
        ];
        const taskLevelByUid = new Map();
        if (uids.length > 0) {
            const taskPerms = await Permission.findAll({
                where: {
                    user_id: userId,
                    resource_type: 'task',
                    resource_uid: { [Op.in]: uids },
                },
                attributes: ['resource_uid', 'access_level'],
                raw: true,
            });
            for (const perm of taskPerms) {
                if (!taskLevelByUid.has(perm.resource_uid)) {
                    taskLevelByUid.set(perm.resource_uid, perm.access_level);
                }
            }
        }
        for (const task of pendingDirect) {
            rememberAccess(
                map,
                task,
                taskLevelByUid.get(task.uid) || ACCESS.NONE
            );
        }
    }

    return map;
}

async function ownershipOrPermissionWhere(resourceType, userId, cache = null) {
    // Check cache first (request-scoped)
    const cacheKey = `permission_${resourceType}_${userId}`;
    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    // Build WHERE clause for resource queries based on ownership and sharing permissions
    // Note: isAdmin expects a UID, but we might receive a numeric ID
    // Get the user's UID if we received a numeric ID
    let userUid = userId;
    if (typeof userId === 'number' || !isNaN(parseInt(userId))) {
        const { User } = require('../models');
        const user = await User.findByPk(userId, {
            attributes: ['uid', 'email'],
        });
        if (user) {
            userUid = user.uid;
        }
    }

    const isUserAdmin = await isAdmin(userUid);

    // Admin users should NOT see all resources automatically
    // They should only see their own resources and shared resources, like regular users
    // If admin-level system-wide visibility is needed, it should be via dedicated admin endpoints

    const sharedUids = await getSharedUidsForUser(resourceType, userId);

    // For tasks and notes, also include items from shared projects
    if (resourceType === 'task' || resourceType === 'note') {
        const sharedProjectUids = await getSharedUidsForUser('project', userId);

        // Get the project IDs for shared projects
        let sharedProjectIds = [];
        if (sharedProjectUids.length > 0) {
            const projects = await Project.findAll({
                where: { uid: { [Op.in]: sharedProjectUids } },
                attributes: ['id'],
                raw: true,
            });
            sharedProjectIds = projects.map((p) => p.id);
        }

        const conditions = [
            { user_id: userId }, // Items owned by user
        ];

        if (sharedUids.length > 0) {
            conditions.push({ uid: { [Op.in]: sharedUids } }); // Items directly shared with user
        }

        if (sharedProjectIds.length > 0) {
            conditions.push({ project_id: { [Op.in]: sharedProjectIds } }); // Items in shared projects
        }

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For other resource types (projects, etc.), use the original logic
    const result = {
        [Op.or]: [
            { user_id: userId },
            sharedUids.length
                ? { uid: { [Op.in]: sharedUids } }
                : { uid: null },
        ],
    };
    if (cache) cache.set(cacheKey, result);
    return result;
}

module.exports = {
    ACCESS,
    getAccess,
    getTaskAccessMap,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
};
