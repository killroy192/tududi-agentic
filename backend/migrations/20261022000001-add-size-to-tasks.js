'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'size',
                definition: {
                    type: Sequelize.STRING(2),
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        const tableInfo = await queryInterface.describeTable('tasks');
        if ('size' in tableInfo) {
            await queryInterface.removeColumn('tasks', 'size');
        }
    },
};
