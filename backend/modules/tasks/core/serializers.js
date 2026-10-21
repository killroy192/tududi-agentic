const { User } = require('../../../models');
const {
    getSafeTimezone,
    processDueDateForResponse,
    processDeferUntilForResponse,
} = require('../../../utils/timezone-utils');
const {
    getTaskTodayMoveCount,
    getTaskTodayMoveCounts,
} = require('../taskEventService');
const taskRepository = require('../repository');

// Sort tags alphabetically by name (case-insensitive)
function sortTags(tags) {
    if (!tags || !Array.isArray(tags)) return [];
    return [...tags].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
}

function collectOwnerIds(taskJson, subtasks) {
    const ids = new Set();
    if (taskJson.user_id) {
        ids.add(taskJson.user_id);
    }
    for (const subtask of subtasks || []) {
        if (subtask.user_id) {
            ids.add(subtask.user_id);
        }
    }
    return ids;
}

async function loadOwnerUids(ids) {
    if (!ids || ids.size === 0) {
        return new Map();
    }
    const users = await User.findAll({
        where: { id: [...ids] },
        attributes: ['id', 'uid'],
    });
    return new Map(users.map((user) => [user.id, user.uid]));
}

async function serializeTask(
    task,
    userTimezone = 'UTC',
    options = {},
    moveCountMap = null,
    ownerUids = null
) {
    if (!task) {
        throw new Error('Task is null or undefined');
    }
    const taskJson = task.toJSON ? task.toJSON() : task;

    const todayMoveCount = taskJson.is_virtual_occurrence
        ? 0
        : moveCountMap
          ? moveCountMap[task.id] || 0
          : await getTaskTodayMoveCount(task.id);

    const safeTimezone = getSafeTimezone(userTimezone);

    const { Subtasks, User: taskOwner, ...taskWithoutSubtasks } = taskJson;
    const resolvedOwnerUids =
        ownerUids || (await loadOwnerUids(collectOwnerIds(taskJson, Subtasks)));

    let displayName = taskJson.name;
    if (
        !options.skipDisplayNameTransform &&
        !options.preserveOriginalName &&
        taskJson.recurrence_type &&
        taskJson.recurrence_type !== 'none' &&
        !taskJson.recurring_parent_id
    ) {
        switch (taskJson.recurrence_type) {
            case 'daily':
                displayName = 'Daily';
                break;
            case 'weekly':
                displayName = 'Weekly';
                break;
            case 'monthly':
                displayName = 'Monthly';
                break;
            case 'yearly':
                displayName = 'Yearly';
                break;
            default:
                displayName =
                    taskJson.recurrence_type.charAt(0).toUpperCase() +
                    taskJson.recurrence_type.slice(1);
        }
    }

    let recurringParentUid = null;
    if (taskJson.recurring_parent_id) {
        const parentTask = await taskRepository.findById(
            taskJson.recurring_parent_id,
            {
                attributes: ['uid'],
            }
        );
        recurringParentUid = parentTask?.uid || null;
    }

    return {
        ...taskWithoutSubtasks,
        name: displayName,
        original_name: taskJson.name,
        uid: task.uid,
        user_uid:
            taskOwner?.uid ||
            resolvedOwnerUids.get(taskJson.user_id) ||
            taskJson.user_uid ||
            null,
        project_uid: taskJson.Project?.uid || null,
        area_uid: taskJson.Area?.uid || null,
        recurring_parent_uid: recurringParentUid,
        due_date: processDueDateForResponse(taskJson.due_date, safeTimezone),
        defer_until: processDeferUntilForResponse(
            taskJson.defer_until,
            safeTimezone
        ),
        tags: sortTags(taskJson.Tags),
        Project: taskJson.Project
            ? {
                  ...taskJson.Project,
                  uid: taskJson.Project.uid,
              }
            : null,
        Area: taskJson.Area
            ? {
                  ...taskJson.Area,
                  uid: taskJson.Area.uid,
              }
            : null,
        subtasks: Subtasks
            ? Subtasks.map((subtask) => {
                  const { User: subtaskOwner, ...subtaskRest } = subtask;
                  return {
                      ...subtaskRest,
                      uid: subtask.uid,
                      user_uid:
                      subtaskOwner?.uid ||
                      resolvedOwnerUids.get(subtask.user_id) ||
                      subtask.user_uid ||
                      null,
                      tags: sortTags(subtask.Tags),
                      due_date: processDueDateForResponse(
                          subtask.due_date,
                          safeTimezone
                      ),
                      defer_until: processDeferUntilForResponse(
                          subtask.defer_until,
                          safeTimezone
                      ),
                      completed_at: subtask.completed_at
                          ? subtask.completed_at instanceof Date
                              ? subtask.completed_at.toISOString()
                              : new Date(subtask.completed_at).toISOString()
                          : null,
                  };
              })
            : [],
        completed_at: task.completed_at
            ? task.completed_at instanceof Date
                ? task.completed_at.toISOString()
                : new Date(task.completed_at).toISOString()
            : null,
        today_move_count: todayMoveCount,
    };
}

async function serializeTasks(tasks, userTimezone = 'UTC', options = {}) {
    if (!tasks || tasks.length === 0) {
        return [];
    }

    const taskIds = tasks.map((task) => task.id);
    const moveCountMap = await getTaskTodayMoveCounts(taskIds);
    const ownerIds = new Set();
    tasks.forEach((task) => {
        const taskJson = task.toJSON ? task.toJSON() : task;
        collectOwnerIds(taskJson, taskJson.Subtasks).forEach((id) =>
            ownerIds.add(id)
        );
    });
    const ownerUids = await loadOwnerUids(ownerIds);

    return await Promise.all(
        tasks.map((task) =>
            serializeTask(task, userTimezone, options, moveCountMap, ownerUids)
        )
    );
}

async function buildMetricsResponse(metrics) {
    return {
        total_open_tasks: metrics.total_open_tasks,
        tasks_pending_over_month: metrics.tasks_pending_over_month,
        tasks_in_progress_count: metrics.tasks_in_progress_count,
        tasks_due_today_count: metrics.tasks_due_today.length,
        today_plan_tasks_count: metrics.today_plan_tasks.length,
        suggested_tasks_count: metrics.suggested_tasks.length,
        tasks_completed_today_count: metrics.tasks_completed_today.length,
        weekly_completions: metrics.weekly_completions,
    };
}

module.exports = {
    serializeTask,
    serializeTasks,
    buildMetricsResponse,
    sortTags,
};
