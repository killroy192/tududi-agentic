jest.mock('../../../../models', () => ({
    TaskEvent: {
        create: jest.fn(),
    },
    sequelize: {},
}));

const { TaskEvent } = require('../../../../models');
const {
    logEvent,
} = require('../../../../modules/tasks/taskEventService');

describe('taskEventService createValueObject', () => {
    beforeEach(() => {
        TaskEvent.create.mockReset();
        TaskEvent.create.mockImplementation(async (data) => data);
    });

    it('preserves null old/new values instead of dropping them', async () => {
        await logEvent({
            taskId: 1,
            userId: 1,
            eventType: 'size_changed',
            fieldName: 'size',
            oldValue: null,
            newValue: 1,
        });

        expect(TaskEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                old_value: { size: null },
                new_value: { size: 1 },
            })
        );
    });

    it('preserves zero values', async () => {
        await logEvent({
            taskId: 1,
            userId: 1,
            eventType: 'priority_changed',
            fieldName: 'priority',
            oldValue: 0,
            newValue: 1,
        });

        expect(TaskEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                old_value: { priority: 0 },
                new_value: { priority: 1 },
            })
        );
    });

    it('wraps null for both old and new when clearing a field', async () => {
        await logEvent({
            taskId: 1,
            userId: 1,
            eventType: 'size_changed',
            fieldName: 'size',
            oldValue: 1,
            newValue: null,
        });

        expect(TaskEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                old_value: { size: 1 },
                new_value: { size: null },
            })
        );
    });
});
