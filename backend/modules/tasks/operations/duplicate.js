const { Task } = require('../../../models');
const taskRepository = require('../repository');
const { updateTaskTags } = require('./tags');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('../utils/constants');

function buildDuplicateAttributes(sourceTask, userId) {
    const source = sourceTask.toJSON ? sourceTask.toJSON() : sourceTask;

    return {
        name: `${source.name} (copy)`,
        note: source.note,
        priority: source.priority,
        due_date: source.due_date,
        defer_until: source.defer_until,
        reminder_at: source.reminder_at,
        project_id: source.project_id,
        area_id: source.area_id,
        recurrence_type: source.recurrence_type,
        recurrence_interval: source.recurrence_interval,
        recurrence_end_date: source.recurrence_end_date,
        recurrence_weekday: source.recurrence_weekday,
        recurrence_weekdays: source.recurrence_weekdays,
        recurrence_month_day: source.recurrence_month_day,
        recurrence_week_of_month: source.recurrence_week_of_month,
        completion_based: source.completion_based || false,
        assigned_to: source.assigned_to,
        involves: source.involves,
        habit_mode: source.habit_mode || false,
        habit_target_count: source.habit_target_count,
        habit_frequency_period: source.habit_frequency_period,
        habit_streak_mode: source.habit_streak_mode,
        habit_flexibility_mode: source.habit_flexibility_mode,
        status: Task.STATUS.NOT_STARTED,
        completed_at: null,
        recurring_parent_id: null,
        parent_task_id: null,
        order: null,
        habit_current_streak: 0,
        habit_best_streak: 0,
        habit_total_completions: 0,
        habit_last_completion_at: null,
        ai_insights: null,
        user_id: userId,
    };
}

async function duplicateTask(sourceTask, userId) {
    const attrs = buildDuplicateAttributes(sourceTask, userId);
    const task = await taskRepository.create(attrs);

    const tagsData = sourceTask.Tags || sourceTask.tags || [];
    await updateTaskTags(task, tagsData, userId);

    const taskWithAssociations = await taskRepository.findById(task.id, {
        include: TASK_INCLUDES_WITH_SUBTASKS,
    });

    return taskWithAssociations;
}

module.exports = {
    buildDuplicateAttributes,
    duplicateTask,
};
