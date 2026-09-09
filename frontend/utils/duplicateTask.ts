import { Task } from '../entities/Task';
import { Tag } from '../entities/Tag';

/**
 * Build a create payload that duplicates a task as a fresh starting point.
 * Allowlists fields explicitly — never spreads the source task.
 */
export const buildDuplicateTaskPayload = (source: Task): Task => {
    const baseName = (source.original_name || source.name || '').trim();
    const name = baseName ? `${baseName} (copy)` : '(copy)';

    const tags: Tag[] | undefined = source.tags
        ?.filter((tag) => tag?.name?.trim())
        .map((tag) => ({ name: tag.name.trim() }));

    const subtasks: Task[] | undefined = source.subtasks
        ?.filter((subtask) => subtask?.name?.trim())
        .map((subtask) => ({
            name: subtask.name.trim(),
            priority: subtask.priority,
            status: 'not_started' as const,
            completed_at: null,
        }));

    const payload: Task = {
        name,
        status: 'not_started',
        completed_at: null,
    };

    if (source.note !== undefined && source.note !== null) {
        payload.note = source.note;
    }

    if (source.priority !== undefined && source.priority !== null) {
        payload.priority = source.priority;
    }

    if (source.size !== undefined && source.size !== null) {
        payload.size = source.size;
    }

    if (source.project_uid) {
        payload.project_uid = source.project_uid;
    } else if (source.project_id) {
        payload.project_id = source.project_id;
    }

    if (source.area_uid) {
        payload.area_uid = source.area_uid;
    } else if (source.area_id) {
        payload.area_id = source.area_id;
    }

    if (tags && tags.length > 0) {
        payload.tags = tags;
    }

    if (source.assigned_to !== undefined) {
        payload.assigned_to = source.assigned_to;
    }

    if (source.involves !== undefined) {
        payload.involves = source.involves;
    }

    if (source.recurrence_type !== undefined) {
        payload.recurrence_type = source.recurrence_type;
    }
    if (source.recurrence_interval !== undefined) {
        payload.recurrence_interval = source.recurrence_interval;
    }
    if (source.recurrence_end_date !== undefined) {
        payload.recurrence_end_date = source.recurrence_end_date;
    }
    if (source.recurrence_weekday !== undefined) {
        payload.recurrence_weekday = source.recurrence_weekday;
    }
    if (source.recurrence_weekdays !== undefined) {
        payload.recurrence_weekdays = source.recurrence_weekdays;
    }
    if (source.recurrence_month_day !== undefined) {
        payload.recurrence_month_day = source.recurrence_month_day;
    }
    if (source.recurrence_week_of_month !== undefined) {
        payload.recurrence_week_of_month = source.recurrence_week_of_month;
    }
    if (source.completion_based !== undefined) {
        payload.completion_based = source.completion_based;
    }

    if (source.parent_task_id !== undefined && source.parent_task_id !== null) {
        payload.parent_task_id = source.parent_task_id;
    }

    if (subtasks && subtasks.length > 0) {
        payload.subtasks = subtasks;
    }

    return payload;
};
