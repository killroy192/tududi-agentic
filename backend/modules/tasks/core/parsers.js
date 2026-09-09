const { Task } = require('../../../models');

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

function parseSize(size) {
    if (size === null || size === '') return null;

    if (typeof size === 'string') {
        return Task.getSizeValue(size);
    }

    if (typeof size === 'number' && Number.isInteger(size)) {
        Task.getSizeName(size);
        return size;
    }

    throw new Error('Invalid size value');
}

module.exports = {
    parsePriority,
    parseStatus,
    parseSize,
};
