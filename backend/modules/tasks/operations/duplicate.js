const { Tag, Task, sequelize } = require('../../../models');
const taskRepository = require('../repository');
const { serializeTask } = require('../core/serializers');
const { TASK_INCLUDES_WITH_SUBTASKS } = require('../utils/constants');

/**
 * Build attributes for a duplicated task row.
 * Copies main details; resets status, schedule, recurrence, and habit streak data.
 */
function buildDuplicateAttributes(source, { parentTaskId = null, order = null } = {}) {
    return {
        name: source.name,
        note: source.note,
        priority: source.priority,
        project_id: source.project_id,
        area_id: source.area_id,
        user_id: source.user_id,
        parent_task_id: parentTaskId,
        order,
        status: Task.STATUS.NOT_STARTED,
        completed_at: null,
        due_date: null,
        defer_until: null,
        reminder_at: null,
        recurrence_type: 'none',
        recurrence_interval: null,
        recurrence_end_date: null,
        recurrence_weekday: null,
        recurrence_weekdays: null,
        recurrence_month_day: null,
        recurrence_week_of_month: null,
        completion_based: false,
        recurring_parent_id: null,
        habit_mode: false,
        habit_target_count: null,
        habit_frequency_period: null,
        habit_streak_mode: 'calendar',
        habit_flexibility_mode: 'flexible',
        habit_current_streak: 0,
        habit_best_streak: 0,
        habit_total_completions: 0,
        habit_last_completion_at: null,
        assigned_to: null,
        involves: null,
        ai_insights: null,
    };
}

async function attachTags(task, tags, transaction) {
    if (!tags || tags.length === 0) {
        return;
    }
    await task.setTags(tags, { transaction });
}

/**
 * Duplicate a task for its owner.
 * Top-level tasks also get copies of their direct subtasks.
 * Subtasks become siblings under the same parent.
 *
 * @param {object} sourceTask - Source task (already loaded; may include Tags/Subtasks)
 * @param {number} userId - Current user id (must be the owner)
 * @param {string} timezone - User timezone for serialization
 * @returns {Promise<{error: string|null, status?: number, task?: object}>}
 */
async function duplicateTask(sourceTask, userId, timezone) {
    if (sourceTask.user_id !== userId) {
        return { error: 'Forbidden', status: 403 };
    }

    const isSubtask = sourceTask.parent_task_id != null;

    const duplicated = await sequelize.transaction(async (transaction) => {
        let parentTaskId = null;
        let order = null;

        if (isSubtask) {
            parentTaskId = sourceTask.parent_task_id;
            const existingSiblings = await taskRepository.findAll(
                { parent_task_id: parentTaskId },
                {
                    attributes: ['order'],
                    order: [['order', 'DESC']],
                    limit: 1,
                    transaction,
                }
            );
            order = (existingSiblings[0]?.order ?? 0) + 1;
        }

        const newTask = await Task.create(
            buildDuplicateAttributes(sourceTask, { parentTaskId, order }),
            { transaction }
        );

        const sourceTags = sourceTask.Tags || [];
        await attachTags(newTask, sourceTags, transaction);

        if (!isSubtask) {
            const subtasks =
                sourceTask.Subtasks ||
                (await taskRepository.findAll(
                    { parent_task_id: sourceTask.id },
                    {
                        include: [
                            {
                                model: Tag,
                                attributes: ['id', 'name', 'uid', 'color'],
                                through: { attributes: [] },
                            },
                        ],
                        order: [
                            ['order', 'ASC'],
                            ['created_at', 'ASC'],
                        ],
                        transaction,
                    }
                ));

            for (const subtask of subtasks) {
                const newSubtask = await Task.create(
                    buildDuplicateAttributes(subtask, {
                        parentTaskId: newTask.id,
                        order: subtask.order,
                    }),
                    { transaction }
                );
                await attachTags(newSubtask, subtask.Tags || [], transaction);
            }
        }

        return newTask;
    });

    const taskWithAssociations = await taskRepository.findById(duplicated.id, {
        include: TASK_INCLUDES_WITH_SUBTASKS,
    });

    const serializedTask = await serializeTask(
        taskWithAssociations,
        timezone,
        { skipDisplayNameTransform: true }
    );

    return { error: null, task: serializedTask };
}

module.exports = {
    duplicateTask,
    buildDuplicateAttributes,
};
