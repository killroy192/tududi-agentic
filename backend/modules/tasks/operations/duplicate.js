const taskRepository = require('../repository');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('../utils/constants');
const {
    validateProjectAccess,
    validateAreaAccess,
} = require('../utils/validation');

const COPY_SUFFIX = ' (copy)';

function buildCopyName(originalName) {
    const name = originalName.endsWith(COPY_SUFFIX)
        ? originalName.slice(0, -COPY_SUFFIX.length)
        : originalName;
    return name + COPY_SUFFIX;
}

async function resolveWritableProjectId(projectId, userId) {
    try {
        return await validateProjectAccess(projectId, userId);
    } catch {
        return null;
    }
}

async function resolveWritableAreaId(areaId, userId) {
    try {
        return await validateAreaAccess(areaId, userId);
    } catch {
        return null;
    }
}

async function duplicateTask(sourceTask, userId) {
    const projectId = await resolveWritableProjectId(
        sourceTask.project_id,
        userId
    );
    const areaId = await resolveWritableAreaId(sourceTask.area_id, userId);

    const attributes = {
        name: buildCopyName(sourceTask.name),
        note: sourceTask.note,
        priority: sourceTask.priority,
        due_date: sourceTask.due_date,
        defer_until: sourceTask.defer_until,
        project_id: projectId,
        area_id: areaId,
        assigned_to: sourceTask.assigned_to,
        involves: sourceTask.involves,
        user_id: userId,
        status: 0,
        completed_at: null,
        reminder_at: null,
        recurrence_type: 'none',
        recurrence_interval: null,
        recurrence_end_date: null,
        recurrence_weekday: null,
        recurrence_weekdays: null,
        recurrence_month_day: null,
        recurrence_week_of_month: null,
        completion_based: false,
        ai_insights: null,
        parent_task_id: null,
        recurring_parent_id: null,
    };

    const newTask = await taskRepository.create(attributes);

    const tags = await sourceTask.getTags();
    await newTask.setTags(tags);

    const reloaded = await taskRepository.findById(newTask.id, {
        include: TASK_INCLUDES_WITH_SUBTASKS,
    });

    return reloaded;
}

module.exports = {
    duplicateTask,
    buildCopyName,
};
