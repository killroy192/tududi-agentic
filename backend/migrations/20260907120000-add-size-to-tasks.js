'use strict';

const { safeAddColumns, safeRemoveColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'size',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    // No default — existing rows remain SQL NULL
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'tasks', 'size');
    },
};
