const { Task } = require('../../../models');
const taskRepository = require('../repository');
const { updateTaskTags } = require('./tags');
const { createSubtasks } = require('./subtasks');
const { serializeTask } = require('../core/serializers');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('../utils/constants');

const appendCopySuffix = (name) => {
    const trimmed = (name || '').trim();
    return trimmed ? `${trimmed} copy` : 'copy';
};

/**
 * Duplicates a task with confirmed copy/reset rules.
 * Returns the serialized clone or { error, status } on failure.
 */
async function duplicateTask(sourceUid, userId, timezone) {
    const source = await taskRepository.findByUid(sourceUid, {
        include: TASK_INCLUDES_WITH_SUBTASKS,
    });

    if (!source) {
        return { error: 'Task not found.', status: 404 };
    }

    const cloneAttributes = {
        name: appendCopySuffix(source.name),
        note: source.note,
        priority: source.priority,
        project_id: source.project_id,
        area_id: source.area_id,
        user_id: userId,
        status: Task.STATUS.NOT_STARTED,
        completed_at: null,
        due_date: null,
        defer_until: null,
        reminder_at: null,
        assigned_to: null,
        involves: null,
        parent_task_id: null,
        recurring_parent_id: null,
        recurrence_type: Task.RECURRENCE_TYPE.NONE,
        recurrence_interval: null,
        recurrence_end_date: null,
        recurrence_weekday: null,
        recurrence_weekdays: null,
        recurrence_month_day: null,
        recurrence_week_of_month: null,
        completion_based: false,
        ai_insights: null,
        habit_mode: false,
        habit_target_count: null,
        habit_frequency_period: null,
        habit_streak_mode: Task.HABIT_STREAK_MODE.CALENDAR,
        habit_flexibility_mode: Task.HABIT_FLEXIBILITY_MODE.FLEXIBLE,
        habit_current_streak: 0,
        habit_best_streak: 0,
        habit_total_completions: 0,
        habit_last_completion_at: null,
    };

    const clone = await taskRepository.create(cloneAttributes);

    const sourceTags = source.Tags || source.tags || [];
    if (sourceTags.length > 0) {
        await updateTaskTags(
            clone,
            sourceTags.map((tag) => ({ name: tag.name })),
            userId
        );
    }

    const sourceSubtasks = source.Subtasks || [];
    if (sourceSubtasks.length > 0) {
        const sortedSubtasks = [...sourceSubtasks].sort((a, b) => {
            const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(a.created_at) - new Date(b.created_at);
        });

        await createSubtasks(
            clone.id,
            sortedSubtasks.map((subtask) => ({
                name: appendCopySuffix(subtask.name),
                priority: subtask.priority,
                status: Task.STATUS.NOT_STARTED,
                completed_at: null,
            })),
            userId
        );
    }

    const cloneWithAssociations = await taskRepository.findById(clone.id, {
        include: TASK_INCLUDES_WITH_SUBTASKS,
    });

    const serializedTask = await serializeTask(
        cloneWithAssociations || clone,
        timezone,
        { skipDisplayNameTransform: true }
    );

    return { task: serializedTask, status: 201 };
}

module.exports = {
    duplicateTask,
    appendCopySuffix,
};
