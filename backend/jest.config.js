const sharedProjectConfig = {
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
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    moduleNameMapper: {
        '^jose$': '<rootDir>/tests/mocks/jose.js',
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js',
    },
};

module.exports = {
    // These must be root-level in a multi-project config (ignored inside projects)
    testTimeout: 30000,
    forceExit: true,
    projects: [
        {
            ...sharedProjectConfig,
            displayName: 'unit',
            testMatch: [
                '<rootDir>/tests/unit/**/*.test.js',
                '<rootDir>/tests/unit/**/*.spec.js',
            ],
            maxWorkers: '100%',
        },
        {
            ...sharedProjectConfig,
            displayName: 'integration',
            testMatch: [
                '<rootDir>/tests/integration/**/*.test.js',
                '<rootDir>/tests/integration/**/*.spec.js',
            ],
            maxWorkers: 1,
        },
    ],
};
