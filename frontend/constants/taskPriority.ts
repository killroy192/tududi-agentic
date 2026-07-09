import { PriorityType } from '../entities/Task';

export const TASK_PRIORITY = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
} as const;

export const TASK_PRIORITY_STRINGS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
} as const;

export type TaskPriorityValue = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];
export type TaskPriorityString =
    (typeof TASK_PRIORITY_STRINGS)[keyof typeof TASK_PRIORITY_STRINGS];

const PRIORITY_NAMES: TaskPriorityString[] = ['low', 'medium', 'high'];

/**
 * Converts a dual-form (string or number) priority to its string form.
 * Returns null for "no priority" (null/undefined/empty string/out-of-range number),
 * matching how the UI treats missing priority as "none" rather than "low".
 */
export function getPriorityString(
    priority: PriorityType | number | string | undefined | null
): TaskPriorityString | null {
    if (priority === null || priority === undefined || priority === '') {
        return null;
    }

    if (typeof priority === 'string') {
        return priority as TaskPriorityString;
    }

    return PRIORITY_NAMES[priority] ?? null;
}

/**
 * Converts a dual-form (string or number) priority to its numeric form.
 * Returns null for "no priority", mirroring getPriorityString.
 */
export function getPriorityValue(
    priority: PriorityType | number | string | undefined | null
): TaskPriorityValue | null {
    if (priority === null || priority === undefined || priority === '') {
        return null;
    }

    if (typeof priority === 'number') {
        return priority as TaskPriorityValue;
    }

    const priorityMap: Record<string, TaskPriorityValue> = {
        low: TASK_PRIORITY.LOW,
        medium: TASK_PRIORITY.MEDIUM,
        high: TASK_PRIORITY.HIGH,
    };

    return priorityMap[priority] ?? null;
}

export function getPriorityLabel(
    priority: PriorityType | number | undefined | null
): string {
    const priorityString = getPriorityString(priority);

    const labels: Record<TaskPriorityString, string> = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
    };

    return (priorityString && labels[priorityString]) || 'None';
}

export function isLowPriority(
    priority: PriorityType | number | undefined | null
): boolean {
    return getPriorityString(priority) === TASK_PRIORITY_STRINGS.LOW;
}

export function isMediumPriority(
    priority: PriorityType | number | undefined | null
): boolean {
    return getPriorityString(priority) === TASK_PRIORITY_STRINGS.MEDIUM;
}

export function isHighPriority(
    priority: PriorityType | number | undefined | null
): boolean {
    return getPriorityString(priority) === TASK_PRIORITY_STRINGS.HIGH;
}
