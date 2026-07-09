import {
    TASK_STATUS,
    TASK_STATUS_STRINGS,
    getStatusString,
    getStatusValue,
    getStatusLabel,
    isTaskDone,
    isTaskInProgress,
    isTaskNotStarted,
    isTaskArchived,
    isTaskWaiting,
    isTaskCancelled,
    isTaskPlanned,
    isTaskActive,
    isTaskCompleted,
    isTaskActionable,
    isHabitArchived,
} from './taskStatus';

describe('TASK_STATUS / TASK_STATUS_STRINGS', () => {
    it('maps each numeric status to its expected value', () => {
        expect(TASK_STATUS.NOT_STARTED).toBe(0);
        expect(TASK_STATUS.IN_PROGRESS).toBe(1);
        expect(TASK_STATUS.DONE).toBe(2);
        expect(TASK_STATUS.ARCHIVED).toBe(3);
        expect(TASK_STATUS.WAITING).toBe(4);
        expect(TASK_STATUS.CANCELLED).toBe(5);
        expect(TASK_STATUS.PLANNED).toBe(6);
    });

    it('maps each string status to its expected value', () => {
        expect(TASK_STATUS_STRINGS.NOT_STARTED).toBe('not_started');
        expect(TASK_STATUS_STRINGS.IN_PROGRESS).toBe('in_progress');
        expect(TASK_STATUS_STRINGS.DONE).toBe('done');
        expect(TASK_STATUS_STRINGS.ARCHIVED).toBe('archived');
        expect(TASK_STATUS_STRINGS.WAITING).toBe('waiting');
        expect(TASK_STATUS_STRINGS.CANCELLED).toBe('cancelled');
        expect(TASK_STATUS_STRINGS.PLANNED).toBe('planned');
    });
});

describe('getStatusString', () => {
    it('returns the string unchanged when given a string', () => {
        expect(getStatusString('done')).toBe('done');
        expect(getStatusString('in_progress')).toBe('in_progress');
    });

    it.each([
        [0, 'not_started'],
        [1, 'in_progress'],
        [2, 'done'],
        [3, 'archived'],
        [4, 'waiting'],
        [5, 'cancelled'],
        [6, 'planned'],
    ])('converts numeric status %i to %s', (num, expected) => {
        expect(getStatusString(num)).toBe(expected);
    });

    it('falls back to not_started for an unknown numeric status', () => {
        expect(getStatusString(99)).toBe('not_started');
    });
});

describe('getStatusValue', () => {
    it('returns the number unchanged when given a number', () => {
        expect(getStatusValue(2)).toBe(2);
        expect(getStatusValue(0)).toBe(0);
    });

    it.each([
        ['not_started', 0],
        ['in_progress', 1],
        ['done', 2],
        ['archived', 3],
        ['waiting', 4],
        ['cancelled', 5],
        ['planned', 6],
    ])('converts string status %s to %i', (str, expected) => {
        expect(getStatusValue(str as any)).toBe(expected);
    });

    it('falls back to NOT_STARTED for an unknown string status', () => {
        expect(getStatusValue('bogus' as any)).toBe(TASK_STATUS.NOT_STARTED);
    });
});

describe('getStatusLabel', () => {
    it.each([
        ['not_started', 'Not Started'],
        [0, 'Not Started'],
        ['in_progress', 'In Progress'],
        [1, 'In Progress'],
        ['done', 'Completed'],
        [2, 'Completed'],
        ['archived', 'Archived'],
        [3, 'Archived'],
        ['waiting', 'Waiting'],
        [4, 'Waiting'],
        ['cancelled', 'Cancelled'],
        [5, 'Cancelled'],
        ['planned', 'Planned'],
        [6, 'Planned'],
    ])('labels %s as %s', (status, expected) => {
        expect(getStatusLabel(status as any)).toBe(expected);
    });
});

describe('dual-form status predicates', () => {
    const predicateCases: Array<{
        fn: (s: any) => boolean;
        name: string;
        trueString: string;
        trueNumber: number;
    }> = [
        { fn: isTaskDone, name: 'isTaskDone', trueString: 'done', trueNumber: 2 },
        {
            fn: isTaskInProgress,
            name: 'isTaskInProgress',
            trueString: 'in_progress',
            trueNumber: 1,
        },
        {
            fn: isTaskNotStarted,
            name: 'isTaskNotStarted',
            trueString: 'not_started',
            trueNumber: 0,
        },
        {
            fn: isTaskArchived,
            name: 'isTaskArchived',
            trueString: 'archived',
            trueNumber: 3,
        },
        {
            fn: isTaskWaiting,
            name: 'isTaskWaiting',
            trueString: 'waiting',
            trueNumber: 4,
        },
        {
            fn: isTaskCancelled,
            name: 'isTaskCancelled',
            trueString: 'cancelled',
            trueNumber: 5,
        },
        {
            fn: isTaskPlanned,
            name: 'isTaskPlanned',
            trueString: 'planned',
            trueNumber: 6,
        },
    ];

    predicateCases.forEach(({ fn, name, trueString, trueNumber }) => {
        describe(name, () => {
            it(`returns true for string '${trueString}'`, () => {
                expect(fn(trueString)).toBe(true);
            });

            it(`returns true for number ${trueNumber}`, () => {
                expect(fn(trueNumber)).toBe(true);
            });

            it('returns false for null', () => {
                expect(fn(null)).toBe(false);
            });

            it('returns false for undefined', () => {
                expect(fn(undefined)).toBe(false);
            });

            it('returns false for an unrelated status', () => {
                const other = trueString === 'planned' ? 'done' : 'planned';
                expect(fn(other)).toBe(false);
            });
        });
    });
});

describe('isTaskActive', () => {
    it('is true for not_started, in_progress, waiting, planned (string or number)', () => {
        expect(isTaskActive('not_started')).toBe(true);
        expect(isTaskActive(0)).toBe(true);
        expect(isTaskActive('in_progress')).toBe(true);
        expect(isTaskActive(1)).toBe(true);
        expect(isTaskActive('waiting')).toBe(true);
        expect(isTaskActive(4)).toBe(true);
        expect(isTaskActive('planned')).toBe(true);
        expect(isTaskActive(6)).toBe(true);
    });

    it('is false for done, archived, cancelled (string or number)', () => {
        expect(isTaskActive('done')).toBe(false);
        expect(isTaskActive(2)).toBe(false);
        expect(isTaskActive('archived')).toBe(false);
        expect(isTaskActive(3)).toBe(false);
        expect(isTaskActive('cancelled')).toBe(false);
        expect(isTaskActive(5)).toBe(false);
    });

    it('is true for null/undefined (nothing marks it done/archived/cancelled)', () => {
        expect(isTaskActive(null)).toBe(true);
        expect(isTaskActive(undefined)).toBe(true);
    });
});

describe('isTaskCompleted', () => {
    it('is true only for done or archived (string or number)', () => {
        expect(isTaskCompleted('done')).toBe(true);
        expect(isTaskCompleted(2)).toBe(true);
        expect(isTaskCompleted('archived')).toBe(true);
        expect(isTaskCompleted(3)).toBe(true);
    });

    it('is false for all other statuses', () => {
        expect(isTaskCompleted('not_started')).toBe(false);
        expect(isTaskCompleted('in_progress')).toBe(false);
        expect(isTaskCompleted('waiting')).toBe(false);
        expect(isTaskCompleted('cancelled')).toBe(false);
        expect(isTaskCompleted('planned')).toBe(false);
        expect(isTaskCompleted(null)).toBe(false);
        expect(isTaskCompleted(undefined)).toBe(false);
    });
});

describe('isTaskActionable', () => {
    it('excludes done, archived, cancelled, and waiting', () => {
        expect(isTaskActionable('done')).toBe(false);
        expect(isTaskActionable('archived')).toBe(false);
        expect(isTaskActionable('cancelled')).toBe(false);
        expect(isTaskActionable('waiting')).toBe(false);
    });

    it('includes not_started, in_progress, planned', () => {
        expect(isTaskActionable('not_started')).toBe(true);
        expect(isTaskActionable('in_progress')).toBe(true);
        expect(isTaskActionable('planned')).toBe(true);
    });

    it('is true for null/undefined', () => {
        expect(isTaskActionable(null)).toBe(true);
        expect(isTaskActionable(undefined)).toBe(true);
    });
});

describe('isHabitArchived', () => {
    it('is true for archived or cancelled (string or number)', () => {
        expect(isHabitArchived('archived')).toBe(true);
        expect(isHabitArchived(3)).toBe(true);
        expect(isHabitArchived('cancelled')).toBe(true);
        expect(isHabitArchived(5)).toBe(true);
    });

    it('is false for other statuses including null/undefined', () => {
        expect(isHabitArchived('not_started')).toBe(false);
        expect(isHabitArchived('done')).toBe(false);
        expect(isHabitArchived(null)).toBe(false);
        expect(isHabitArchived(undefined)).toBe(false);
    });
});
