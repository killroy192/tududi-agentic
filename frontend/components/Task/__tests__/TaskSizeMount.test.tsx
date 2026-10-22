import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { Task } from '../../../entities/Task';
import { ToastProvider } from '../../Shared/ToastContext';
import TaskHeader from '../TaskHeader';
import TaskItem from '../TaskItem';
import TaskDetailsHeader from '../TaskDetails/TaskDetailsHeader';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import NewTask from '../NewTask';
import NextTaskSuggestion from '../NextTaskSuggestion';
import SearchResults from '../../UniversalSearch/SearchResults';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: {
        language: 'en',
        t: (key: string) => key,
    },
}));

jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: jest.fn(),
    updateTask: jest.fn(),
    fetchSubtasks: jest.fn(),
    createTask: jest.fn(),
    fetchTasks: jest.fn(),
}));

jest.mock('../../../utils/profileService', () => ({
    getTaskIntelligenceEnabled: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../utils/searchService', () => ({
    searchUniversal: jest.fn().mockResolvedValue({ results: [] }),
}));

const task: Task = {
    id: 1,
    uid: 'task-1',
    name: 'Write the spec',
    status: 'done',
    completed_at: null,
    user_uid: 'user-1',
    size: null,
};

const renderWithProviders = (ui: React.ReactElement) =>
    render(
        <MemoryRouter>
            <ToastProvider>{ui}</ToastProvider>
        </MemoryRouter>
    );

describe('task size mount points', () => {
    it('shows a size dropdown on the shared task row', () => {
        renderWithProviders(
            <TaskHeader
                task={task}
                onTaskClick={jest.fn()}
                onToggleCompletion={jest.fn()}
            />
        );

        expect(screen.getAllByTestId('size-dropdown').length).toBeGreaterThan(
            0
        );
        expect(screen.getAllByTestId('size-dropdown')[0]).toHaveTextContent(
            'Unset'
        );
    });

    it('shows a size dropdown in the task details header for a completed task', () => {
        renderWithProviders(
            <TaskDetailsHeader
                task={task}
                onTitleUpdate={jest.fn(async () => undefined)}
                onStatusUpdate={jest.fn(async () => undefined)}
                onPriorityUpdate={jest.fn(async () => undefined)}
                onDelete={jest.fn()}
                activePill="overview"
                onPillChange={jest.fn()}
            />
        );

        expect(screen.getByTestId('size-dropdown')).toBeInTheDocument();
        expect(screen.getByTestId('size-dropdown')).toHaveTextContent('Unset');
    });

    it('shows a size dropdown on an expanded subtask row', () => {
        renderWithProviders(
            <TaskItem
                task={{
                    ...task,
                    status: 'not_started',
                    subtasks: [
                        {
                            id: 2,
                            uid: 'sub-1',
                            name: 'Draft notes',
                            status: 'not_started',
                            completed_at: null,
                            user_uid: 'user-1',
                            size: 'L',
                        },
                    ],
                }}
                onTaskUpdate={jest.fn(async () => undefined)}
                onTaskDelete={jest.fn()}
                projects={[]}
            />
        );

        fireEvent.click(screen.getAllByTitle('Show subtasks')[0]);

        expect(
            screen
                .getAllByTestId('size-dropdown')
                .some((dropdown) => dropdown.textContent === 'L')
        ).toBe(true);
    });

    it('shows a size dropdown on an existing subtask and not on the add row', () => {
        renderWithProviders(
            <TaskSubtasksSection
                parentTaskId={1}
                subtasks={[
                    {
                        id: 2,
                        uid: 'sub-1',
                        name: 'Draft notes',
                        status: 'not_started',
                        completed_at: null,
                        size: 'S',
                        user_uid: 'user-1',
                    },
                    {
                        name: 'Not saved yet',
                        status: 'not_started',
                        completed_at: null,
                        isNew: true,
                        _isNew: true,
                    } as Task,
                ]}
                onSubtasksChange={jest.fn()}
            />
        );

        expect(screen.getByTestId('size-dropdown')).toHaveTextContent('S');

        const addInput = screen.getByPlaceholderText('Add a subtask...');
        expect(
            addInput.parentElement?.querySelector(
                '[data-testid="size-dropdown"]'
            )
        ).toBeNull();
    });

    it('does not show a size dropdown on the create-task form', () => {
        renderWithProviders(
            <NewTask onTaskCreate={jest.fn(async () => undefined)} />
        );

        expect(screen.getByTestId('new-task-input')).toBeInTheDocument();
        expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
    });

    it('does not show a size dropdown on the next-task suggestion', () => {
        renderWithProviders(
            <NextTaskSuggestion
                metrics={{
                    tasks_due_today: [{ ...task, status: 'not_started' }],
                    suggested_tasks: [],
                    tasks_in_progress: [],
                }}
                projects={[]}
                onTaskUpdate={jest.fn(async () => undefined)}
            />
        );

        expect(screen.getByText('Write the spec')).toBeInTheDocument();
        expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
    });

    it('does not show a size dropdown in search results', () => {
        const view = renderWithProviders(
            <SearchResults
                searchQuery=""
                selectedFilters={[]}
                selectedPriority={null}
                selectedDue={null}
                selectedDefer={null}
                selectedTags={[]}
                selectedExtras={[]}
                onClose={jest.fn()}
            />
        );

        expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument();
        view.unmount();
    });
});
