const sharedConfig = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
    collectCoverageFrom: [
        'routes/**/*.js',
        'models/**/*.js',
        'middleware/**/*.js',
        'services/**/*.js',
        '!models/index.js',
        '!**/*.test.js',
        '!**/*.spec.js',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: false,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
    moduleNameMapper: {
        '^jose$': '<rootDir>/tests/mocks/jose.js',
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js',
    },
};

module.exports = {
    projects: [
        {
            ...sharedConfig,
            displayName: 'unit',
            testMatch: [
                '<rootDir>/tests/unit/**/*.test.js',
                '<rootDir>/tests/unit/**/*.spec.js',
            ],
            maxWorkers: '100%',
        },
        {
            ...sharedConfig,
            displayName: 'integration',
            testMatch: [
                '<rootDir>/tests/integration/**/*.test.js',
                '<rootDir>/tests/integration/**/*.spec.js',
            ],
            maxWorkers: 1,
            retryTimes: 2,
        },
    ],
};
