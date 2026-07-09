import {
    TASK_PRIORITY,
    TASK_PRIORITY_STRINGS,
    getPriorityString,
    getPriorityValue,
    getPriorityLabel,
    isLowPriority,
    isMediumPriority,
    isHighPriority,
} from './taskPriority';

describe('TASK_PRIORITY / TASK_PRIORITY_STRINGS', () => {
    it('maps each numeric priority to its expected value', () => {
        expect(TASK_PRIORITY.LOW).toBe(0);
        expect(TASK_PRIORITY.MEDIUM).toBe(1);
        expect(TASK_PRIORITY.HIGH).toBe(2);
    });

    it('maps each string priority to its expected value', () => {
        expect(TASK_PRIORITY_STRINGS.LOW).toBe('low');
        expect(TASK_PRIORITY_STRINGS.MEDIUM).toBe('medium');
        expect(TASK_PRIORITY_STRINGS.HIGH).toBe('high');
    });
});

describe('getPriorityString', () => {
    it('returns the string unchanged when given a string', () => {
        expect(getPriorityString('low')).toBe('low');
        expect(getPriorityString('medium')).toBe('medium');
        expect(getPriorityString('high')).toBe('high');
    });

    it.each([
        [0, 'low'],
        [1, 'medium'],
        [2, 'high'],
    ])('converts numeric priority %i to %s', (num, expected) => {
        expect(getPriorityString(num)).toBe(expected);
    });

    it('returns null for null, undefined, and empty string', () => {
        expect(getPriorityString(null)).toBeNull();
        expect(getPriorityString(undefined)).toBeNull();
        expect(getPriorityString('' as any)).toBeNull();
    });

    it('returns null for an out-of-range numeric priority', () => {
        expect(getPriorityString(99)).toBeNull();
    });
});

describe('getPriorityValue', () => {
    it('returns the number unchanged when given a number', () => {
        expect(getPriorityValue(0)).toBe(0);
        expect(getPriorityValue(2)).toBe(2);
    });

    it.each([
        ['low', 0],
        ['medium', 1],
        ['high', 2],
    ])('converts string priority %s to %i', (str, expected) => {
        expect(getPriorityValue(str as any)).toBe(expected);
    });

    it('returns null for null, undefined, and empty string', () => {
        expect(getPriorityValue(null)).toBeNull();
        expect(getPriorityValue(undefined)).toBeNull();
        expect(getPriorityValue('' as any)).toBeNull();
    });

    it('returns null for an unknown string priority', () => {
        expect(getPriorityValue('bogus' as any)).toBeNull();
    });
});

describe('getPriorityLabel', () => {
    it.each([
        ['low', 'Low'],
        [0, 'Low'],
        ['medium', 'Medium'],
        [1, 'Medium'],
        ['high', 'High'],
        [2, 'High'],
        [null, 'None'],
        [undefined, 'None'],
    ])('labels %s as %s', (priority, expected) => {
        expect(getPriorityLabel(priority as any)).toBe(expected);
    });
});

describe('dual-form priority predicates', () => {
    const cases: Array<{
        fn: (p: any) => boolean;
        name: string;
        trueString: string;
        trueNumber: number;
    }> = [
        { fn: isLowPriority, name: 'isLowPriority', trueString: 'low', trueNumber: 0 },
        {
            fn: isMediumPriority,
            name: 'isMediumPriority',
            trueString: 'medium',
            trueNumber: 1,
        },
        {
            fn: isHighPriority,
            name: 'isHighPriority',
            trueString: 'high',
            trueNumber: 2,
        },
    ];

    cases.forEach(({ fn, name, trueString, trueNumber }) => {
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

            it('returns false for an unrelated priority', () => {
                const other = trueString === 'high' ? 'low' : 'high';
                expect(fn(other)).toBe(false);
            });
        });
    });

    it('none (null/undefined) is not low, medium, or high', () => {
        expect(isLowPriority(null)).toBe(false);
        expect(isMediumPriority(null)).toBe(false);
        expect(isHighPriority(null)).toBe(false);
        expect(isLowPriority(undefined)).toBe(false);
        expect(isMediumPriority(undefined)).toBe(false);
        expect(isHighPriority(undefined)).toBe(false);
    });
});
