const { Op } = require('sequelize');
const { Project, Task, Note, Permission } = require('../models');
const { isAdmin } = require('./rolesService');

const ACCESS = { NONE: 'none', RO: 'ro', RW: 'rw', ADMIN: 'admin' };
const ACCESS_LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };

function canWrite(accessLevel) {
    return (ACCESS_LEVELS[accessLevel] || 0) >= ACCESS_LEVELS[ACCESS.RW];
}

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

/**
 * Build a predicate that answers "may this user edit this task?" for any task
 * already loaded in memory. It mirrors the precedence of getAccess('task'):
 * admin → task owner → access inherited from the parent project (owner or
 * shared) → direct task share. Unlike getAccess it runs a fixed number of
 * queries up front, so it can be applied to every row of a task list.
 *
 * @param {number} userId
 * @returns {Promise<(task: {user_id:number, project_id?:number|null, uid?:string}) => boolean>}
 */
async function createTaskEditResolver(userId) {
    if (await isAdmin(userId)) return () => true;

    const [taskPermissions, projectPermissions, ownedProjects] =
        await Promise.all([
            Permission.findAll({
                where: { user_id: userId, resource_type: 'task' },
                attributes: ['resource_uid', 'access_level'],
                raw: true,
            }),
            Permission.findAll({
                where: { user_id: userId, resource_type: 'project' },
                attributes: ['resource_uid', 'access_level'],
                raw: true,
            }),
            Project.findAll({
                where: { user_id: userId },
                attributes: ['id'],
                raw: true,
            }),
        ]);

    const taskAccessByUid = new Map(
        taskPermissions.map((p) => [p.resource_uid, p.access_level])
    );
    const projectAccessByUid = new Map(
        projectPermissions.map((p) => [p.resource_uid, p.access_level])
    );

    const projectAccessById = new Map(
        ownedProjects.map((p) => [p.id, ACCESS.RW])
    );
    if (projectAccessByUid.size > 0) {
        const sharedProjects = await Project.findAll({
            where: { uid: { [Op.in]: Array.from(projectAccessByUid.keys()) } },
            attributes: ['id', 'uid'],
            raw: true,
        });
        sharedProjects.forEach((p) => {
            if (!projectAccessById.has(p.id)) {
                projectAccessById.set(p.id, projectAccessByUid.get(p.uid));
            }
        });
    }

    return (task) => {
        if (!task) return false;
        if (task.user_id === userId) return true;

        const projectAccess = task.project_id
            ? projectAccessById.get(task.project_id)
            : undefined;
        if (projectAccess && projectAccess !== ACCESS.NONE) {
            return canWrite(projectAccess);
        }

        const taskAccess = task.uid ? taskAccessByUid.get(task.uid) : undefined;
        return taskAccess ? canWrite(taskAccess) : false;
    };
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
    canWrite,
    createTaskEditResolver,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
};
