const { Task } = require('../../../models');

class InvalidSizeError extends Error {
    constructor(message = 'Invalid size value') {
        super(message);
        this.name = 'InvalidSizeError';
        this.field = 'size';
    }
}

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
 * Parse task size for create/update.
 * - undefined: field omitted (caller must leave existing value unchanged)
 * - null / '' / 'none': clear to unset
 * - string or integer form of S/M/L/XL: normalised integer 1–4
 * - anything else: throws InvalidSizeError (never coerces)
 */
function parseSize(size) {
    if (size === undefined) {
        return undefined;
    }

    if (size === null || size === '' || size === 'none' || size === 'None') {
        return null;
    }

    const normalised = Task.getSizeValue(size);
    if (normalised === Task.INVALID_SIZE) {
        throw new InvalidSizeError(
            'Size must be one of S, M, L, XL (or 1–4), or null to clear'
        );
    }

    return normalised;
}

module.exports = {
    parsePriority,
    parseStatus,
    parseSize,
    InvalidSizeError,
};
