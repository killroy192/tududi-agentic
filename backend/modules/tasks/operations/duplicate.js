const { Op } = require('sequelize');
const { Task, Tag, sequelize } = require('../../../models');
const { updateTaskTags } = require('./tags');
const {
    validateProjectAccess,
    validateAreaAccess,
} = require('../utils/validation');

const COPIED_FIELDS = [
    'name',
    'note',
    'priority',
    'project_id',
    'area_id',
    'habit_mode',
    'habit_target_count',
    'habit_frequency_period',
    'habit_streak_mode',
    'habit_flexibility_mode',
];

const tagInclude = {
    model: Tag,
    attributes: ['id', 'name', 'uid'],
    through: { attributes: [] },
};

function fail(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function buildCopyAttributes(source, userId, placement) {
    const attributes = {
        user_id: userId,
        status: Task.STATUS.NOT_STARTED,
        completed_at: null,
        due_date: null,
        defer_until: null,
        reminder_at: null,
        recurrence_type: Task.RECURRENCE_TYPE.NONE,
        recurrence_interval: null,
        recurrence_end_date: null,
        recurrence_weekday: null,
        recurrence_weekdays: null,
        recurrence_month_day: null,
        recurrence_week_of_month: null,
        completion_based: false,
        recurring_parent_id: null,
        assigned_to: null,
        involves: [],
        ai_insights: null,
        habit_current_streak: 0,
        habit_best_streak: 0,
        habit_total_completions: 0,
        habit_last_completion_at: null,
        parent_task_id: placement.parentTaskId,
        order: placement.order,
    };

    for (const field of COPIED_FIELDS) {
        attributes[field] = source.getDataValue(field);
    }

    return attributes;
}

async function assertProjectAndAreaAccess(task, userId) {
    try {
        if (task.project_id) {
            await validateProjectAccess(task.project_id, userId);
        }
    } catch (error) {
        throw fail(error.message, error.message === 'Forbidden' ? 403 : 400);
    }

    try {
        if (task.area_id) {
            await validateAreaAccess(task.area_id, userId);
        }
    } catch (error) {
        throw fail(error.message, 400);
    }
}

function sortDirectSubtasks(subtasks) {
    return [...subtasks].sort((left, right) => {
        const leftOrder =
            left.order == null ? Number.POSITIVE_INFINITY : Number(left.order);
        const rightOrder =
            right.order == null
                ? Number.POSITIVE_INFINITY
                : Number(right.order);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;

        const leftCreated = new Date(left.created_at).getTime();
        const rightCreated = new Date(right.created_at).getTime();
        return leftCreated - rightCreated;
    });
}

async function resolvePlacement(source, transaction) {
    if (!source.parent_task_id) {
        return { parentTaskId: null, order: null };
    }

    const sourceOrder = source.getDataValue('order');
    if (sourceOrder == null || !Number.isFinite(Number(sourceOrder))) {
        const maxOrder = await Task.max('order', {
            where: { parent_task_id: source.parent_task_id },
            transaction,
        });
        const nextOrder =
            (Number.isFinite(Number(maxOrder)) ? Number(maxOrder) : 0) + 1;
        return { parentTaskId: source.parent_task_id, order: nextOrder };
    }

    const nextOrder = Number(sourceOrder) + 1;
    await Task.increment(
        { order: 1 },
        {
            where: {
                parent_task_id: source.parent_task_id,
                order: { [Op.gte]: nextOrder },
            },
            transaction,
        }
    );

    return { parentTaskId: source.parent_task_id, order: nextOrder };
}

async function copyTags(source, target, userId, transaction) {
    const tags = source.Tags || [];
    if (tags.length === 0) return;

    await updateTaskTags(
        target,
        tags.map((tag) => ({ name: tag.name })),
        userId,
        { transaction }
    );
}

async function duplicateTask(uid, userId) {
    return sequelize.transaction(async (transaction) => {
        const source = await Task.findOne({
            where: { uid },
            include: [
                tagInclude,
                {
                    model: Task,
                    as: 'Subtasks',
                    required: false,
                    include: [tagInclude],
                    separate: true,
                    order: [
                        ['order', 'ASC'],
                        ['created_at', 'ASC'],
                    ],
                },
            ],
            transaction,
        });

        if (!source) {
            throw fail('Task not found.', 404);
        }

        const children = sortDirectSubtasks(source.Subtasks || []);
        await assertProjectAndAreaAccess(source, userId);
        for (const child of children) {
            await assertProjectAndAreaAccess(child, userId);
        }

        const placement = await resolvePlacement(source, transaction);
        const copy = await Task.create(
            buildCopyAttributes(source, userId, placement),
            { transaction }
        );
        await copyTags(source, copy, userId, transaction);

        for (const child of children) {
            const childCopy = await Task.create(
                buildCopyAttributes(child, userId, {
                    parentTaskId: copy.id,
                    order: child.order == null ? null : Number(child.order),
                }),
                { transaction }
            );
            await copyTags(child, childCopy, userId, transaction);
        }

        return copy;
    });
}

module.exports = {
    duplicateTask,
};
