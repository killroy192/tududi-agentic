import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TaskItem from '../TaskItem';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback || _key,
    }),
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en', t: (k: string) => k },
}));

jest.mock('../../../utils/dateUtils', () => ({
    isTaskOverdueInTodayPlan: () => false,
    getTodayDateString: () => '2026-10-19',
    getTomorrowDateString: () => '2026-10-20',
    getYesterdayDateString: () => '2026-10-18',
    parseDateString: (s: string) => new Date(s),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
        showSuccessToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/userUtils', () => ({
    getCurrentUser: jest.fn(),
}));

jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: jest.fn(),
    updateTask: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue([]),
    duplicateTask: jest.fn(),
}));

import { getCurrentUser } from '../../../utils/userUtils';

const baseTask: Task = {
    id: 1,
    uid: 'taskuid1234567',
    user_uid: 'owner-uid',
    name: 'Test Task',
    status: 'not_started',
    priority: 'medium',
    completed_at: null,
};

const renderTaskItem = (overrides: Partial<Task> = {}, showDuplicate = true) => {
    return render(
        <MemoryRouter>
            <TaskItem
                task={{ ...baseTask, ...overrides }}
                onTaskUpdate={jest.fn()}
                onTaskDelete={jest.fn()}
                projects={[]}
                showDuplicate={showDuplicate}
            />
        </MemoryRouter>
    );
};

describe('TaskItem duplicate button', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getCurrentUser as jest.Mock).mockReturnValue({
            uid: 'owner-uid',
            email: 'owner@test.com',
            language: 'en',
            appearance: 'light',
            timezone: 'UTC',
        });
    });

    it('renders Duplicate when showDuplicate is true and viewer is the owner', () => {
        renderTaskItem();
        expect(
            screen.getAllByTestId('task-duplicate-button').length
        ).toBeGreaterThan(0);
    });

    it('does not render Duplicate when viewer is not the owner', () => {
        (getCurrentUser as jest.Mock).mockReturnValue({
            uid: 'other-uid',
            email: 'other@test.com',
            language: 'en',
            appearance: 'light',
            timezone: 'UTC',
        });
        renderTaskItem();
        expect(
            screen.queryByTestId('task-duplicate-button')
        ).not.toBeInTheDocument();
    });

    it('does not render Duplicate when showDuplicate is false', () => {
        renderTaskItem({}, false);
        expect(
            screen.queryByTestId('task-duplicate-button')
        ).not.toBeInTheDocument();
    });
});
