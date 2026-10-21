import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewTask from '../NewTask';
import NextTaskSuggestion from '../NextTaskSuggestion';
import WeeklyCompletionChart from '../WeeklyCompletionChart';
import LifeBalance from '../LifeBalance';
import AreaBalanceBar from '../AreaBalanceBar';
import BurndownChart from '../BurndownChart';
import SearchResults from '../../UniversalSearch/SearchResults';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/profileService', () => ({
    getTaskIntelligenceEnabled: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../utils/areasService', () => ({
    fetchAreas: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/searchService', () => ({
    searchUniversal: jest.fn().mockResolvedValue({
        results: [
            {
                type: 'Task',
                id: 4,
                uid: 'task-4',
                name: 'Matched task',
            },
        ],
    }),
}));

const suggestedTask: Task = {
    id: 3,
    uid: 'task-3',
    name: 'Suggested task',
    status: 'not_started',
    completed_at: null,
    size: 'M',
    user_uid: 'owner-1',
};

describe('surfaces without a size control', () => {
    it('does not show a size control on the create-task form', () => {
        render(<NewTask onTaskCreate={jest.fn().mockResolvedValue(undefined)} />);

        expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
    });

    it('does not show a size control on the next-task suggestion', () => {
        render(
            <NextTaskSuggestion
                metrics={{
                    tasks_due_today: [],
                    suggested_tasks: [],
                    tasks_in_progress: [],
                    today_plan_tasks: [suggestedTask],
                }}
                projects={[]}
                onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
            />
        );

        expect(screen.getByText('Suggested task')).toBeInTheDocument();
        expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
    });

    it('does not show a size control in search results', async () => {
        render(
            <MemoryRouter>
                <SearchResults
                    searchQuery="matched"
                    selectedFilters={[]}
                    selectedPriority={null}
                    selectedDue={null}
                    selectedDefer={null}
                    selectedTags={[]}
                    selectedExtras={[]}
                    onClose={jest.fn()}
                />
            </MemoryRouter>
        );

        expect(await screen.findByText('Matched task')).toBeInTheDocument();
        expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
    });

    it('does not show a size control on chart or balance summaries', async () => {
        global.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ tasks: [suggestedTask] }),
        }) as unknown as typeof fetch;

        render(
            <MemoryRouter>
                <WeeklyCompletionChart
                    data={[{ date: '2026-10-19', count: 1, dayName: 'Mon' }]}
                />
                <LifeBalance projects={[]} />
                <AreaBalanceBar projects={[]} />
                <BurndownChart />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
        });
    });
});
