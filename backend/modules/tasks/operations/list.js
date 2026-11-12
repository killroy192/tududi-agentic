const { groupTasksByDay } = require('./grouping');
const { serializeTasks } = require('../core/serializers');
const { computeTaskMetrics } = require('../queries/metrics-computation');
const permissionsService = require('../../../services/permissionsService');

async function handleRecurringTasks(userId, queryType) {
    return;
}

async function buildGroupedTasks(
    tasks,
    queryType,
    groupBy,
    maxDays,
    orderBy,
    timezone,
    language = 'en'
) {
    if (queryType !== 'upcoming' || groupBy !== 'day') {
        return null;
    }

    const days = maxDays ? parseInt(maxDays, 10) : 7;
    const dayGroupingOrderBy = orderBy || 'due_date:asc';

    return await groupTasksByDay(
        tasks,
        timezone,
        days,
        dayGroupingOrderBy,
        language
    );
}

async function serializeGroupedTasks(groupedTasks, timezone, options = {}) {
    if (!groupedTasks) return null;

    const serialized = {};
    for (const [groupName, groupTasks] of Object.entries(groupedTasks)) {
        serialized[groupName] = await serializeTasks(
            groupTasks,
            timezone,
            options
        );
    }
    return serialized;
}

async function addDashboardLists(
    response,
    userId,
    timezone,
    queryType,
    includeLists,
    serializationOptions
) {
    if (queryType !== 'today' || includeLists !== 'true') {
        return;
    }

    const metricsData = await computeTaskMetrics(userId, timezone);

    const listKeys = [
        'tasks_in_progress',
        'tasks_today_plan',
        'tasks_due_today',
        'tasks_overdue',
        'suggested_tasks',
        'tasks_completed_today',
    ];

    const sourceLists = {};
    const allMetricTasks = [];
    for (const key of listKeys) {
        const metricsKey =
            key === 'tasks_today_plan' ? 'today_plan_tasks' : key;
        sourceLists[key] = metricsData[metricsKey] || [];
        allMetricTasks.push(...sourceLists[key]);
    }
    const accessMap = await permissionsService.getTaskAccessMap(
        userId,
        allMetricTasks
    );
    const listOptions = { ...serializationOptions, accessMap };

    const serializedLists = {};

    for (const key of listKeys) {
        serializedLists[key] = await serializeTasks(
            sourceLists[key],
            timezone,
            listOptions
        );
    }

    Object.assign(response, serializedLists);
    response.dashboard_lists = serializedLists;
}

function addPerformanceHeaders(res, startTime, queryStats) {
    const totalTime = Date.now() - startTime;
    res.set('X-Response-Time', `${totalTime}ms`);
    res.set('X-Query-Count', queryStats.count.toString());
}

module.exports = {
    handleRecurringTasks,
    buildGroupedTasks,
    serializeGroupedTasks,
    addDashboardLists,
    addPerformanceHeaders,
};
