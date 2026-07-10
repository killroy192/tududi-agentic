'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

// Adds an index by exact name if it doesn't already exist. `safeAddIndex`
// from migration-utils treats any pre-existing index sharing a field as a
// match, which would incorrectly skip the composite unique index below once
// either single-column index has been created (and vice versa).
async function addIndexIfMissing(queryInterface, tableName, fields, options) {
    const indexes = await queryInterface.showIndex(tableName);
    const indexName =
        options?.name ||
        `${tableName}_${fields.join('_')}`;
    const exists = indexes.some((index) => index.name === indexName);
    if (!exists) {
        await queryInterface.addIndex(tableName, fields, options);
    }
}

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'task_dependencies', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            blocker_task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            blocked_task_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'CASCADE',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await addIndexIfMissing(queryInterface, 'task_dependencies', [
            'blocker_task_id',
        ]);
        await addIndexIfMissing(queryInterface, 'task_dependencies', [
            'blocked_task_id',
        ]);
        await addIndexIfMissing(
            queryInterface,
            'task_dependencies',
            ['blocker_task_id', 'blocked_task_id'],
            { unique: true, name: 'task_dependencies_blocker_blocked_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('task_dependencies');
    },
};
