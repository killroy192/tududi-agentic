const { Task } = require('../../../models');
const { ValidationError } = require('../../../shared/errors');

function parsePriority(priority) {
    if (priority === undefined) return null;
    return typeof priority === 'string'
        ? Task.getPriorityValue(priority)
        : priority;
}

function parseStatus(status, defaultStatus = Task.STATUS.NOT_STARTED) {
    if (status === undefined) return defaultStatus;
    return typeof status === 'string' ? Task.getStatusValue(status) : status;
}

/**
 * Normalize a task size from a request body.
 *
 * - `undefined` (key omitted) → `undefined`, so callers can keep the stored value
 * - `null` → `null` (explicit clear)
 * - `S` / `M` / `L` / `XL` (case-insensitive) → normalized uppercase value
 * - anything else → throws ValidationError (400)
 */
function parseSize(size) {
    if (size === undefined) return undefined;
    if (size === null) return null;

    const normalized =
        typeof size === 'string' ? size.trim().toUpperCase() : size;

    if (!Task.SIZES.includes(normalized)) {
        throw new ValidationError(
            `Invalid task size. Allowed values: ${Task.SIZES.join(', ')} or null.`
        );
    }

    return normalized;
}

module.exports = {
    parsePriority,
    parseStatus,
    parseSize,
};
