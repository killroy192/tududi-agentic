const migration = require('../../../migrations/20260701000001-add-size-to-tasks');

describe('migration 20260701000001-add-size-to-tasks', () => {
    let queryInterface;
    let Sequelize;

    beforeEach(() => {
        Sequelize = { INTEGER: 'INTEGER' };
        queryInterface = {
            showAllTables: jest.fn().mockResolvedValue(['tasks']),
            describeTable: jest.fn(),
            addColumn: jest.fn().mockResolvedValue(undefined),
            removeColumn: jest.fn().mockResolvedValue(undefined),
        };
    });

    it('adds size column without defaultValue when missing', async () => {
        queryInterface.describeTable.mockResolvedValue({
            id: {},
            name: {},
        });

        await migration.up(queryInterface, Sequelize);

        expect(queryInterface.addColumn).toHaveBeenCalledWith(
            'tasks',
            'size',
            expect.objectContaining({
                type: 'INTEGER',
                allowNull: true,
            })
        );
        const definition = queryInterface.addColumn.mock.calls[0][2];
        expect(definition).not.toHaveProperty('defaultValue');
    });

    it('is idempotent when size column already exists', async () => {
        queryInterface.describeTable.mockResolvedValue({
            id: {},
            size: {},
        });

        await migration.up(queryInterface, Sequelize);

        expect(queryInterface.addColumn).not.toHaveBeenCalled();
    });

    it('removes size column on down when present', async () => {
        queryInterface.describeTable.mockResolvedValue({
            id: {},
            size: {},
        });

        await migration.down(queryInterface);

        expect(queryInterface.removeColumn).toHaveBeenCalledWith(
            'tasks',
            'size'
        );
    });
});
