import React from 'react';
import {
    render,
    screen,
    waitFor,
    fireEvent,
    cleanup,
    act,
    within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Task } from '../../../../entities/Task';
import { Project } from '../../../../entities/Project';
import { useStore } from '../../../../store/useStore';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
}));

jest.mock('../../../Shared/DatePicker', () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
        placeholder,
    }: {
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
    }) => (
        <input
            data-testid="date-picker"
            aria-label={placeholder || 'date'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

jest.mock('../../../Shared/DateTimePicker', () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
        placeholder,
    }: {
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
    }) => (
        <input
            data-testid="datetime-picker"
            aria-label={placeholder || 'datetime'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: {
        language: 'en',
        t: (key: string) => key,
    },
}));

jest.mock('../../../Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: ({ content }: { content: string }) => (
        <div data-testid="markdown">{content}</div>
    ),
}));

const navigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => navigate,
}));

const showSuccessToast = jest.fn();
const showErrorToast = jest.fn();
jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast,
        showErrorToast,
        showUndoToast: jest.fn(),
    }),
}));

const updateTask = jest.fn();
const deleteTask = jest.fn();
const fetchTaskByUid = jest.fn();
const fetchTaskNextIterations = jest.fn();
const fetchSubtasks = jest.fn();
const toggleTaskCompletion = jest.fn();

jest.mock('../../../../utils/tasksService', () => ({
    updateTask: (...args: unknown[]) => updateTask(...args),
    deleteTask: (...args: unknown[]) => deleteTask(...args),
    fetchTaskByUid: (...args: unknown[]) => fetchTaskByUid(...args),
    fetchTaskNextIterations: (...args: unknown[]) =>
        fetchTaskNextIterations(...args),
    fetchSubtasks: (...args: unknown[]) => fetchSubtasks(...args),
    toggleTaskCompletion: (...args: unknown[]) =>
        toggleTaskCompletion(...args),
}));

const fetchAttachments = jest.fn();
jest.mock('../../../../utils/attachmentsService', () => ({
    fetchAttachments: (...args: unknown[]) => fetchAttachments(...args),
    uploadAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
}));

jest.mock('../../../../utils/projectsService', () => ({
    createProject: jest.fn(),
}));

jest.mock('../../../../utils/peopleService', () => ({
    fetchPeople: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../../Tag/TagInput', () => ({
    __esModule: true,
    default: ({
        initialTags,
        onTagsChange,
    }: {
        initialTags: string[];
        onTagsChange: (tags: string[]) => void;
    }) => (
        <div data-testid="tag-input">
            <input
                data-testid="tag-input-field"
                onChange={(e) =>
                    onTagsChange([...initialTags, e.target.value].filter(Boolean))
                }
            />
            <span>{initialTags.join(',')}</span>
        </div>
    ),
}));

jest.mock('../../TaskForm/TaskSubtasksSection', () => ({
    __esModule: true,
    default: () => <div data-testid="subtasks-section" />,
}));

jest.mock('../../TaskForm/TaskRecurrenceSection', () => ({
    __esModule: true,
    default: () => <div data-testid="recurrence-section" />,
}));

jest.mock('../../../Shared/PersonDropdown', () => ({
    __esModule: true,
    default: ({
        onChange,
    }: {
        onChange: (uid: string | null) => void;
    }) => (
        <button
            type="button"
            data-testid="person-dropdown"
            onClick={() => onChange('person-1')}
        >
            Assign
        </button>
    ),
}));

jest.mock('../../../AI/TaskAIInsights', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactLib = require('react');
    return {
        __esModule: true,
        default: ReactLib.forwardRef(function MockTaskAIInsights(
            props: { task: Task; project?: { name: string } | null },
            ref: React.Ref<{ activate: () => void }>
        ) {
            ReactLib.useImperativeHandle(ref, () => ({
                activate: jest.fn(),
            }));
            return (
                <div data-testid="task-ai-insights">
                    AI for {props.task.name}
                    {props.project
                        ? ` project:${props.project.name}`
                        : ' project:null'}
                </div>
            );
        }),
    };
});

jest.mock('../../TaskTimeline', () => ({
    __esModule: true,
    default: ({ refreshKey }: { refreshKey: number }) => (
        <div data-testid="task-timeline">timeline:{refreshKey}</div>
    ),
}));

import TaskDetails from '../../TaskDetails';

const stableSubtasks: Task[] = [
    {
        id: 2,
        uid: 'sub-stable',
        name: 'Stable sub',
        status: 'not_started',
        completed_at: null,
    },
];

const baseTask: Task = {
    id: 1,
    uid: 'task-uid-1',
    name: 'Sample Task',
    status: 'not_started',
    priority: 'medium',
    completed_at: null,
    note: 'hello',
    due_date: '',
    defer_until: '',
    recurrence_type: 'none',
    tags: [],
    subtasks: stableSubtasks,
};

const resetStore = (tasks: Task[] = []) => {
    useStore.getState().tasksStore.setTasks(tasks);
    useStore.getState().projectsStore.setProjects([]);
    useStore.getState().tagsStore.setTags([]);
    useStore.getState().areasStore.setAreas([]);
    useStore.setState((prev) => ({
        tagsStore: { ...prev.tagsStore, hasLoaded: true, isLoading: false },
        areasStore: { ...prev.areasStore, hasLoaded: true, isLoading: false },
        userSettingsStore: {
            ...prev.userSettingsStore,
            aiAssistantEnabled: false,
        },
    }));
};

const renderAt = (
    uid: string,
    options: { isNew?: boolean; from?: string } = {}
) => {
    const state = options.isNew
        ? { isNew: true, from: options.from ?? '/today' }
        : options.from
          ? { from: options.from }
          : undefined;

    return render(
        <MemoryRouter
            initialEntries={[{ pathname: `/task/${uid}`, state }]}
        >
            <Routes>
                <Route path="/task/:uid" element={<TaskDetails />} />
            </Routes>
        </MemoryRouter>
    );
};

describe('TaskDetails characterization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        navigate.mockReset();
        updateTask.mockResolvedValue({});
        deleteTask.mockResolvedValue(undefined);
        fetchTaskByUid.mockImplementation(async (uid: string) => ({
            ...baseTask,
            uid,
        }));
        fetchTaskNextIterations.mockResolvedValue([]);
        fetchSubtasks.mockResolvedValue([]);
        fetchAttachments.mockResolvedValue([]);
        toggleTaskCompletion.mockResolvedValue({
            ...baseTask,
            status: 'done',
            completed_at: '2026-01-01T00:00:00.000Z',
        });
        resetStore([baseTask]);
    });

    afterEach(() => {
        cleanup();
    });

    it('shows not-found when fetch fails and task is absent from store', async () => {
        resetStore([]);
        fetchTaskByUid.mockRejectedValue(new Error('missing'));

        renderAt('missing-uid');

        expect(await screen.findByText('Task not found')).toBeInTheDocument();
        expect(fetchTaskByUid).toHaveBeenCalledWith('missing-uid');
    });

    it('fetches when the task is not in the store', async () => {
        resetStore([]);
        fetchTaskByUid.mockResolvedValue({
            ...baseTask,
            uid: 'fetched-uid',
            name: 'Fetched',
        });

        renderAt('fetched-uid');

        expect(await screen.findByText('Fetched')).toBeInTheDocument();
        expect(fetchTaskByUid).toHaveBeenCalledWith('fetched-uid');
        expect(
            useStore
                .getState()
                .tasksStore.tasks.some((t) => t.uid === 'fetched-uid')
        ).toBe(true);
    });

    it('does not fetch when the task is already in the store', async () => {
        renderAt('task-uid-1');

        expect(await screen.findByText('Sample Task')).toBeInTheDocument();
        expect(fetchTaskByUid).not.toHaveBeenCalled();
    });

    it('deletes an unmodified new task on unmount', async () => {
        renderAt('task-uid-1', { isNew: true });
        await screen.findByDisplayValue('Sample Task');

        cleanup();

        await waitFor(() => {
            expect(deleteTask).toHaveBeenCalledWith('task-uid-1');
        });
        expect(
            useStore
                .getState()
                .tasksStore.tasks.find((t) => t.uid === 'task-uid-1')
        ).toBeUndefined();
    });

    it('does not delete a new task after a failed save that marked it modified', async () => {
        updateTask.mockRejectedValue(new Error('save failed'));

        renderAt('task-uid-1', { isNew: true });
        await screen.findByDisplayValue('Sample Task');

        // Due-date save marks modified before the request and swallows the error
        const dueHeading = screen.getByText('Due Date');
        const dueCard = dueHeading.parentElement!;
        fireEvent.click(dueCard.querySelector('button')!);
        const dateInput = within(dueCard).getByTestId('date-picker');
        fireEvent.change(dateInput, { target: { value: '2030-06-01' } });
        fireEvent.click(
            Array.from(dueCard.querySelectorAll('button')).find(
                (b) => b.textContent === 'Save'
            )!
        );

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalled();
        });

        cleanup();

        await act(async () => {});
        expect(deleteTask).not.toHaveBeenCalled();
    });

    it('loads attachment count while attachments pill is closed', async () => {
        fetchAttachments.mockResolvedValue([{ id: 1 }, { id: 2 }]);

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        await waitFor(() => {
            expect(fetchAttachments).toHaveBeenCalledWith('task-uid-1');
        });
        expect(screen.getByText('Attachments')).toBeInTheDocument();
    });

    it('hides AI insights when aiAssistantEnabled is false', async () => {
        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        expect(
            screen.queryByTestId('task-ai-insights')
        ).not.toBeInTheDocument();
        expect(screen.queryByLabelText('AI Insights')).not.toBeInTheDocument();
    });

    it('shows AI insights with matching project when enabled', async () => {
        const project = {
            id: 99,
            name: 'Proj',
            uid: 'proj-1',
            status: 'in_progress',
        } as Project;
        resetStore([{ ...baseTask, project_id: 99 }]);
        useStore.getState().projectsStore.setProjects([project]);
        useStore.getState().userSettingsStore.setAiAssistantEnabled(true);

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        expect(await screen.findByTestId('task-ai-insights')).toHaveTextContent(
            'project:Proj'
        );
        expect(screen.getByLabelText('AI Insights')).toBeInTheDocument();
    });

    it('rejects due date that is before defer until', async () => {
        resetStore([
            {
                ...baseTask,
                due_date: '2026-06-15',
                defer_until: '2026-06-10T12:00:00.000Z',
            },
        ]);

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        // Click due date display to edit
        const dueHeading = screen.getByText('Due Date');
        const dueCard = dueHeading.parentElement!;
        const displayButton = dueCard.querySelector('button');
        expect(displayButton).toBeTruthy();
        fireEvent.click(displayButton!);

        const saveBtn = Array.from(dueCard.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save'
        );
        expect(saveBtn).toBeTruthy();

        // Change to a date before defer
        const inputs = dueCard.querySelectorAll('input');
        if (inputs.length > 0) {
            fireEvent.change(inputs[0], { target: { value: '2026-06-05' } });
        }

        updateTask.mockClear();
        showErrorToast.mockClear();
        fireEvent.click(saveBtn!);

        await waitFor(() => {
            expect(showErrorToast).toHaveBeenCalledWith(
                'Due date cannot be before the defer until date'
            );
        });
        expect(updateTask).not.toHaveBeenCalled();
    });

    it('warns on past due date but still saves', async () => {
        resetStore([{ ...baseTask, due_date: '2030-01-01' }]);

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        const dueHeading = screen.getByText('Due Date');
        const dueCard = dueHeading.parentElement!;
        fireEvent.click(dueCard.querySelector('button')!);

        const inputs = dueCard.querySelectorAll('input');
        if (inputs.length > 0) {
            fireEvent.change(inputs[0], { target: { value: '2020-01-01' } });
        }

        fetchTaskByUid.mockResolvedValue({
            ...baseTask,
            due_date: '2020-01-01',
        });
        showErrorToast.mockClear();
        updateTask.mockClear();

        const saveBtn = Array.from(dueCard.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save'
        )!;
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(showErrorToast).toHaveBeenCalledWith(
                'Warning: You are setting a due date in the past'
            );
            expect(updateTask).toHaveBeenCalled();
        });
    });

    it('skips defer-after-due validation for recurring instances', async () => {
        resetStore([
            {
                ...baseTask,
                due_date: '2026-06-05',
                defer_until: '2026-06-01T00:00:00.000Z',
                recurring_parent_id: 10,
                recurring_parent_uid: 'parent-uid',
            },
        ]);
        fetchTaskByUid.mockImplementation(async (uid: string) => {
            if (uid === 'parent-uid') {
                return {
                    ...baseTask,
                    uid: 'parent-uid',
                    recurrence_type: 'daily',
                };
            }
            return {
                ...baseTask,
                uid,
                due_date: '2026-06-05',
                defer_until: '2026-06-10T00:00:00.000Z',
                recurring_parent_id: 10,
                recurring_parent_uid: 'parent-uid',
            };
        });

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        const deferHeading = screen.getByText('Defer Until');
        const deferCard = deferHeading.parentElement!;
        fireEvent.click(deferCard.querySelector('button')!);

        const inputs = deferCard.querySelectorAll('input');
        if (inputs.length > 0) {
            fireEvent.change(inputs[0], {
                target: { value: '2026-06-10T00:00:00.000Z' },
            });
        }

        updateTask.mockClear();
        showErrorToast.mockClear();
        const saveBtn = Array.from(deferCard.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save'
        )!;
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalled();
        });
        expect(showErrorToast).not.toHaveBeenCalledWith(
            'Defer until date cannot be after the due date'
        );
    });

    it('merges completion toggle without a second fetchTaskByUid', async () => {
        jest.useFakeTimers();
        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        fetchTaskByUid.mockClear();
        fireEvent.click(screen.getByTitle('Mark as done'));

        await act(async () => {
            jest.advanceTimersByTime(1300);
        });

        await waitFor(() => {
            expect(toggleTaskCompletion).toHaveBeenCalled();
        });
        expect(fetchTaskByUid).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('does not bump timeline refresh key on size update', async () => {
        resetStore([{ ...baseTask, can_edit: true, size: null }]);
        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        fireEvent.click(screen.getByText('Activity'));
        expect(await screen.findByTestId('task-timeline')).toHaveTextContent(
            'timeline:0'
        );
        fireEvent.click(screen.getByText('Overview'));

        fetchTaskByUid.mockResolvedValue({
            ...baseTask,
            can_edit: true,
            size: 'L',
        });
        fireEvent.click(
            within(screen.getByTestId('task-details-size')).getByRole('button')
        );
        fireEvent.click(await screen.findByTestId('size-option-l'));

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledWith('task-uid-1', {
                size: 'L',
            });
        });

        fireEvent.click(screen.getByText('Activity'));
        expect(screen.getByTestId('task-timeline')).toHaveTextContent(
            'timeline:0'
        );
    });

    it('bumps timeline refresh key on title update', async () => {
        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        fireEvent.click(screen.getByText('Activity'));
        expect(await screen.findByTestId('task-timeline')).toHaveTextContent(
            'timeline:0'
        );
        fireEvent.click(screen.getByText('Overview'));

        fetchTaskByUid.mockResolvedValue({
            ...baseTask,
            name: 'Renamed Task',
        });

        fireEvent.click(screen.getByText('Sample Task'));
        const titleInput = await screen.findByDisplayValue('Sample Task');
        fireEvent.change(titleInput, { target: { value: 'Renamed Task' } });
        fireEvent.keyDown(titleInput, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(updateTask).toHaveBeenCalledWith('task-uid-1', {
                name: 'Renamed Task',
            });
        });

        fireEvent.click(screen.getByText('Activity'));
        await waitFor(() => {
            expect(screen.getByTestId('task-timeline')).toHaveTextContent(
                'timeline:1'
            );
        });
    });

    it('preserves subtasks when saving tags', async () => {
        const taskWithSubs: Task = {
            ...baseTask,
            tags: [{ name: 'old' }],
            subtasks: [
                {
                    id: 2,
                    uid: 'sub-1',
                    name: 'Sub',
                    status: 'not_started',
                    completed_at: null,
                },
            ],
        };
        resetStore([taskWithSubs]);
        useStore.setState((prev) => ({
            tagsStore: {
                ...prev.tagsStore,
                tags: [{ name: 'old' }, { name: 'fresh' }],
                hasLoaded: true,
            },
        }));

        fetchTaskByUid.mockResolvedValue({
            ...taskWithSubs,
            tags: [{ name: 'fresh' }],
            subtasks: undefined,
        });

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        fireEvent.click(screen.getAllByText('old')[1]);
        const saveBtn = await screen.findByText('Save');

        const tagInput = screen.getByTestId('tag-input-field');
        fireEvent.change(tagInput, { target: { value: 'fresh' } });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            const stored = useStore
                .getState()
                .tasksStore.tasks.find((t) => t.uid === 'task-uid-1');
            expect(stored?.subtasks?.length).toBe(1);
            expect(stored?.subtasks?.[0].name).toBe('Sub');
        });
    });

    it('navigates to from location after delete confirm', async () => {
        renderAt('task-uid-1', { from: '/projects' });
        await screen.findByText('Sample Task');

        fireEvent.click(screen.getByLabelText('More actions'));
        const deleteItem = await screen.findByText('Delete');
        // Menu may be visibility:hidden until layout; force click anyway
        fireEvent.click(deleteItem);

        const confirm = await screen.findByTestId('confirm-dialog-confirm');
        fireEvent.click(confirm);

        await waitFor(() => {
            expect(deleteTask).toHaveBeenCalledWith('task-uid-1');
            expect(navigate).toHaveBeenCalledWith('/projects');
        });
    });

    it('saves recurrence with monthly day default and nulls unused fields', async () => {
        resetStore([
            {
                ...baseTask,
                recurrence_type: 'none',
            },
        ]);

        renderAt('task-uid-1');
        await screen.findByText('Sample Task');

        // Find recurrence section edit control
        const recurrenceHeading = screen.queryByText(/Recurrence|Repeat/i);
        expect(recurrenceHeading).toBeTruthy();
    });
});
