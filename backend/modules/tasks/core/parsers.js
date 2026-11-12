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

function isValidTaskSize(value) {
    if (value === null) {
        return true;
    }
    return typeof value === 'string' && Task.SIZES.includes(value);
}

module.exports = {
    parsePriority,
    parseStatus,
    isValidTaskSize,
};
