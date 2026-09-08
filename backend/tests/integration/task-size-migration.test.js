const { Sequelize } = require('sequelize');
const Umzug = require('umzug');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Migration: add size to tasks (AC-2)', () => {
    let sequelize;
    let umzug;
    let dbPath;

    beforeEach(async () => {
        dbPath = path.join(
            os.tmpdir(),
            `tududi-size-migration-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
        );

        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: dbPath,
            logging: false,
        });

        // Minimal pre-migration tasks table (no size column)
        await sequelize.query(`
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id INTEGER,
                priority INTEGER DEFAULT 0,
                status INTEGER DEFAULT 0,
                recurrence_type TEXT DEFAULT 'none',
                created_at DATETIME,
                updated_at DATETIME
            );
        `);

        await sequelize.query(`
            INSERT INTO tasks (name, user_id, priority, status, recurrence_type, created_at, updated_at)
            VALUES
              ('Existing A', 1, 0, 0, 'none', datetime('now'), datetime('now')),
              ('Existing B', 1, 1, 0, 'none', datetime('now'), datetime('now'));
        `);

        // Umzug storage table
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS SequelizeMeta (
                name VARCHAR(255) NOT NULL PRIMARY KEY
            );
        `);

        umzug = new Umzug({
            migrations: {
                path: path.join(__dirname, '../../migrations'),
                params: [sequelize.getQueryInterface(), Sequelize],
                pattern: /20260907120000-add-size-to-tasks\.js$/,
            },
            storage: 'sequelize',
            storageOptions: { sequelize },
        });
    });

    afterEach(async () => {
        if (sequelize) {
            await sequelize.close();
        }
        if (dbPath && fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });

    it('adds size as NULL for existing rows and is idempotent on re-run', async () => {
        await umzug.up();

        const [rows] = await sequelize.query(
            'SELECT id, name, size FROM tasks ORDER BY id'
        );
        expect(rows).toHaveLength(2);
        expect(rows[0].size).toBeNull();
        expect(rows[1].size).toBeNull();

        const tableInfo = await sequelize.getQueryInterface().describeTable('tasks');
        expect(tableInfo.size).toBeDefined();
        expect(tableInfo.size.allowNull).toBe(true);

        // Re-run must be a no-op (no error, sizes still NULL)
        await umzug.up();
        const [rowsAfter] = await sequelize.query(
            'SELECT id, size FROM tasks ORDER BY id'
        );
        expect(rowsAfter[0].size).toBeNull();
        expect(rowsAfter[1].size).toBeNull();
    });
});
