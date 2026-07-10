import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TaskDependenciesCard from '../TaskDependenciesCard';
import { Task } from '../../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));

const mockSearchUniversal = jest.fn();
jest.mock('../../../../utils/searchService', () => ({
    searchUniversal: (...args: any[]) => mockSearchUniversal(...args),
}));

const baseTask: Task = {
    uid: 'task-1',
    name: 'Main Task',
    status: 'not_started',
    completed_at: null,
};

const renderCard = (
    overrides: Partial<React.ComponentProps<typeof TaskDependenciesCard>> = {}
) => {
    const onAddDependency = jest.fn().mockResolvedValue(undefined);
    const onRemoveDependency = jest.fn().mockResolvedValue(undefined);

    const props = {
        task: baseTask,
        blockers: [],
        blocking: [],
        onAddDependency,
        onRemoveDependency,
        ...overrides,
    };

    render(
        <MemoryRouter>
            <TaskDependenciesCard {...props} />
        </MemoryRouter>
    );

    return { onAddDependency, onRemoveDependency };
};

describe('TaskDependenciesCard', () => {
    beforeEach(() => {
        mockSearchUniversal.mockReset();
        mockSearchUniversal.mockResolvedValue({ results: [] });
    });

    it('shows empty state for both sections when there are no dependencies', () => {
        renderCard();

        const emptyMessages = screen.getAllByText('No dependencies');
        expect(emptyMessages).toHaveLength(2);
    });

    it('renders blocker and blocking task rows', () => {
        renderCard({
            blockers: [
                {
                    uid: 'blocker-1',
                    name: 'Blocker Task',
                    status: 'not_started',
                },
            ],
            blocking: [
                {
                    uid: 'blocked-1',
                    name: 'Blocked Task',
                    status: 'done',
                },
            ],
        });

        expect(screen.getByText('Blocker Task')).toBeInTheDocument();
        expect(screen.getByText('Blocked Task')).toBeInTheDocument();
    });

    it('hides the "Blocked by" section for recurring template tasks', () => {
        renderCard({
            task: {
                ...baseTask,
                recurrence_type: 'daily',
                recurring_parent_id: undefined,
            },
        });

        expect(screen.queryByText('Blocked by')).not.toBeInTheDocument();
        expect(screen.getByText('Blocks')).toBeInTheDocument();
    });

    it('calls onRemoveDependency with "blocked_by" when removing a blocker', () => {
        const { onRemoveDependency } = renderCard({
            blockers: [
                {
                    uid: 'blocker-1',
                    name: 'Blocker Task',
                    status: 'not_started',
                },
            ],
        });

        fireEvent.click(
            screen.getByTitle('Remove dependency')
        );

        expect(onRemoveDependency).toHaveBeenCalledWith(
            'blocker-1',
            'blocked_by'
        );
    });

    it('calls onRemoveDependency with "blocks" when removing a blocked task', () => {
        const { onRemoveDependency } = renderCard({
            blocking: [
                {
                    uid: 'blocked-1',
                    name: 'Blocked Task',
                    status: 'not_started',
                },
            ],
        });

        fireEvent.click(screen.getByTitle('Remove dependency'));

        expect(onRemoveDependency).toHaveBeenCalledWith(
            'blocked-1',
            'blocks'
        );
    });

    it('searches for tasks and adds a "blocks" dependency on selection', async () => {
        mockSearchUniversal.mockResolvedValue({
            results: [
                { type: 'Task', id: 2, uid: 'task-2', name: 'Other Task' },
            ],
        });

        const { onAddDependency } = renderCard();

        fireEvent.click(screen.getByText('Add task'));
        fireEvent.change(screen.getByPlaceholderText('Search tasks…'), {
            target: { value: 'Other' },
        });

        await waitFor(() =>
            expect(mockSearchUniversal).toHaveBeenCalled()
        );

        const option = await screen.findByText('Other Task');
        fireEvent.click(option);

        await waitFor(() =>
            expect(onAddDependency).toHaveBeenCalledWith(
                'task-2',
                'blocks'
            )
        );
    });

    it('excludes the current task and existing dependencies from search results', async () => {
        mockSearchUniversal.mockResolvedValue({
            results: [
                { type: 'Task', id: 1, uid: 'task-1', name: 'Main Task' },
                {
                    type: 'Task',
                    id: 3,
                    uid: 'blocked-1',
                    name: 'Blocked Task',
                },
                { type: 'Task', id: 2, uid: 'task-2', name: 'Other Task' },
            ],
        });

        renderCard({
            blocking: [
                {
                    uid: 'blocked-1',
                    name: 'Blocked Task',
                    status: 'not_started',
                },
            ],
        });

        fireEvent.click(screen.getByText('Add task'));
        fireEvent.change(screen.getByPlaceholderText('Search tasks…'), {
            target: { value: 'Task' },
        });

        await waitFor(() =>
            expect(mockSearchUniversal).toHaveBeenCalled()
        );

        await screen.findByText('Other Task');
        expect(
            screen.queryByText('No matching tasks')
        ).not.toBeInTheDocument();

        // "Main Task" only appears as the search result exclusion target,
        // and "Blocked Task" is already listed above in the blocking section,
        // so within the dropdown only "Other Task" should be selectable.
        const dropdownOptions = screen.getAllByRole('button', {
            name: /Task$/,
        });
        const dropdownOptionTexts = dropdownOptions.map((el) => el.textContent);
        expect(dropdownOptionTexts).toContain('Other Task');
        expect(dropdownOptionTexts).not.toContain('Main Task');
    });
});
