const { Task, TaskDependency } = require('../../../models');
const taskRepository = require('../repository');

const MAX_CYCLE_CHECK_DEPTH = 50;

/**
 * Determines whether a recurring template task (recurrence_type !== 'none'
 * and no recurring_parent_id) is being referenced. Recurring templates may
 * block other tasks, but may not themselves be blocked.
 */
function isRecurringTemplate(task) {
    return (
        !!task.recurrence_type &&
        task.recurrence_type !== 'none' &&
        !task.recurring_parent_id
    );
}

/**
 * Detects whether creating an edge blockerTaskId -> blockedTaskId would
 * introduce a cycle, i.e. whether blockedTaskId already (transitively)
 * blocks blockerTaskId.
 */
async function hasCycle(blockerTaskId, blockedTaskId) {
    if (blockerTaskId === blockedTaskId) {
        return true;
    }

    const visited = new Set([blockedTaskId]);
    let frontier = [blockedTaskId];
    let depth = 0;

    while (frontier.length > 0 && depth < MAX_CYCLE_CHECK_DEPTH) {
        const edges = await TaskDependency.findAll({
            where: { blocker_task_id: frontier },
            attributes: ['blocked_task_id'],
            raw: true,
        });

        const nextFrontier = [];
        for (const edge of edges) {
            if (edge.blocked_task_id === blockerTaskId) {
                return true;
            }
            if (!visited.has(edge.blocked_task_id)) {
                visited.add(edge.blocked_task_id);
                nextFrontier.push(edge.blocked_task_id);
            }
        }

        frontier = nextFrontier;
        depth += 1;
    }

    return false;
}

async function findOwnedTask(taskId, userId) {
    return await taskRepository.findByIdAndUser(taskId, userId);
}

async function addDependency(blockerTaskId, blockedTaskId, userId) {
    if (String(blockerTaskId) === String(blockedTaskId)) {
        throw new Error('A task cannot depend on itself.');
    }

    const blockerTask = await findOwnedTask(blockerTaskId, userId);
    if (!blockerTask) {
        throw new Error('Blocker task not found.');
    }

    const blockedTask = await findOwnedTask(blockedTaskId, userId);
    if (!blockedTask) {
        throw new Error('Blocked task not found.');
    }

    if (isRecurringTemplate(blockedTask)) {
        throw new Error('A recurring task cannot be blocked.');
    }

    const existing = await TaskDependency.findOne({
        where: {
            blocker_task_id: blockerTask.id,
            blocked_task_id: blockedTask.id,
        },
    });
    if (existing) {
        return existing;
    }

    if (await hasCycle(blockerTask.id, blockedTask.id)) {
        throw new Error(
            'This dependency would create a circular relationship.'
        );
    }

    return await TaskDependency.create({
        blocker_task_id: blockerTask.id,
        blocked_task_id: blockedTask.id,
    });
}

async function removeDependency(blockerTaskId, blockedTaskId, userId) {
    const blockerTask = await findOwnedTask(blockerTaskId, userId);
    if (!blockerTask) {
        throw new Error('Blocker task not found.');
    }

    const blockedTask = await findOwnedTask(blockedTaskId, userId);
    if (!blockedTask) {
        throw new Error('Blocked task not found.');
    }

    return await TaskDependency.destroy({
        where: {
            blocker_task_id: blockerTask.id,
            blocked_task_id: blockedTask.id,
        },
    });
}

function toDependencyRef(task) {
    return {
        uid: task.uid,
        name: task.name,
        status: task.status,
        due_date: task.due_date,
    };
}

async function getDependencies(taskId) {
    const task = await Task.findByPk(taskId, {
        include: [
            { model: Task, as: 'BlockerTasks', attributes: ['uid', 'name', 'status', 'due_date'] },
            { model: Task, as: 'BlockingTasks', attributes: ['uid', 'name', 'status', 'due_date'] },
        ],
    });

    if (!task) {
        return { blockers: [], blocking: [] };
    }

    return {
        blockers: (task.BlockerTasks || []).map(toDependencyRef),
        blocking: (task.BlockingTasks || []).map(toDependencyRef),
    };
}

async function removeAllDependenciesForTask(taskId) {
    await TaskDependency.destroy({
        where: { blocker_task_id: taskId },
    });
    await TaskDependency.destroy({
        where: { blocked_task_id: taskId },
    });
}

module.exports = {
    addDependency,
    removeDependency,
    getDependencies,
    hasCycle,
    isRecurringTemplate,
    removeAllDependenciesForTask,
};
