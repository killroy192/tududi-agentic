const {
    calculateInitialDueDate,
    buildTaskAttributes,
    buildUpdateAttributes,
} = require('../../../../modules/tasks/core/builders');

describe('calculateInitialDueDate', () => {
    describe('Weekly recurrence with multiple weekdays', () => {
        it('should find next occurrence when today is Monday and target is Tue/Thu', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [2, 4],
            });

            expect(result).toBe('2026-03-24');
            global.Date = RealDate;
        });

        it('should find next occurrence among three weekdays (Mon/Wed/Fri)', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [1, 3, 5],
            });

            expect(result).toBe('2026-03-25');
            global.Date = RealDate;
        });

        it('should wrap to first day of next week when today is after all weekdays', () => {
            const saturday = new Date(Date.UTC(2026, 2, 28, 0, 0, 0, 0));
            expect(saturday.getUTCDay()).toBe(6);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(saturday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => saturday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [1, 3, 5],
            });

            expect(result).toBe('2026-03-30');
            global.Date = RealDate;
        });

        it('should handle unsorted weekdays array', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [5, 1, 3],
            });

            expect(result).toBe('2026-03-25');
            global.Date = RealDate;
        });

        it('should work with single-element array like single weekday', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: [5],
            });

            expect(result).toBe('2026-03-27');
            global.Date = RealDate;
        });

        it('should parse JSON string for recurrence_weekdays', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekdays: '[2, 4]',
            });

            expect(result).toBe('2026-03-24');
            global.Date = RealDate;
        });

        it('should prioritize recurrence_weekdays over recurrence_weekday', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekday: 0,
                recurrence_weekdays: [2, 4],
            });

            expect(result).toBe('2026-03-24');
            global.Date = RealDate;
        });
    });

    describe('Weekly recurrence with single weekday (backward compatibility)', () => {
        it('should calculate correct due date for single weekday', () => {
            const monday = new Date(Date.UTC(2026, 2, 23, 0, 0, 0, 0));
            expect(monday.getUTCDay()).toBe(1);

            const RealDate = Date;
            global.Date = class extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(monday);
                    } else {
                        super(...args);
                    }
                }
                static [Symbol.hasInstance](instance) {
                    return instance instanceof RealDate;
                }
            };
            global.Date.UTC = RealDate.UTC;
            global.Date.parse = RealDate.parse;
            global.Date.now = () => monday.getTime();

            const result = calculateInitialDueDate({
                recurrence_type: 'weekly',
                recurrence_weekday: 5,
            });

            expect(result).toBe('2026-03-27');
            global.Date = RealDate;
        });
    });
});

function storedTask(overrides = {}) {
    return {
        name: 'Stored name',
        priority: 1,
        status: 0,
        note: 'Stored note',
        recurrence_type: 'none',
        recurrence_interval: null,
        recurrence_end_date: null,
        recurrence_weekday: null,
        recurrence_weekdays: null,
        recurrence_month_day: null,
        recurrence_week_of_month: null,
        completion_based: false,
        size: 'M',
        ...overrides,
    };
}

describe('task size attributes', () => {
    describe('buildUpdateAttributes', () => {
        it('includes size when the body has the key', () => {
            const attrs = buildUpdateAttributes(
                { size: 'L' },
                storedTask(),
                'UTC'
            );

            expect(attrs.size).toBe('L');
            expect(attrs.name).toBe('Stored name');
            expect(attrs.priority).toBe(1);
        });

        it('includes null when the body sets size to null', () => {
            const attrs = buildUpdateAttributes(
                { size: null },
                storedTask(),
                'UTC'
            );

            expect(attrs).toHaveProperty('size', null);
        });

        it('omits size when the body does not have the key', () => {
            const attrs = buildUpdateAttributes(
                { name: 'Renamed', priority: 2 },
                storedTask(),
                'UTC'
            );

            expect(attrs).not.toHaveProperty('size');
            expect(attrs.name).toBe('Renamed');
            expect(attrs.priority).toBe(2);
        });

        it('ignores an inherited size property', () => {
            const body = Object.create({ size: 'S' });
            body.note = 'Touched';

            const attrs = buildUpdateAttributes(body, storedTask(), 'UTC');

            expect(attrs).not.toHaveProperty('size');
            expect(attrs.note).toBe('Touched');
        });
    });

    describe('buildTaskAttributes', () => {
        it.each([
            ['omitted', undefined],
            ['null', null],
            ['S', 'S'],
            ['XXL', 'XXL'],
        ])(
            'never sets size when the create body has size %s',
            (_label, size) => {
                const body = { name: 'New task', priority: 1 };
                if (size !== undefined) {
                    body.size = size;
                }

                const attrs = buildTaskAttributes(body, 7, 'UTC');

                expect(attrs).not.toHaveProperty('size');
                expect(attrs.name).toBe('New task');
                expect(attrs.user_id).toBe(7);
            }
        );
    });
});
