const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TaskDependency = sequelize.define(
        'TaskDependency',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            blocker_task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
            blocked_task_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'task_dependencies',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['blocker_task_id'] },
                { fields: ['blocked_task_id'] },
                {
                    unique: true,
                    fields: ['blocker_task_id', 'blocked_task_id'],
                    name: 'task_dependencies_blocker_blocked_unique',
                },
            ],
        }
    );

    TaskDependency.associate = function (models) {
        TaskDependency.belongsTo(models.Task, {
            foreignKey: 'blocker_task_id',
            as: 'BlockerTask',
        });
        TaskDependency.belongsTo(models.Task, {
            foreignKey: 'blocked_task_id',
            as: 'BlockedTask',
        });
    };

    return TaskDependency;
};
