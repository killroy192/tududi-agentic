import React from 'react';
import {
    render,
    screen,
    waitFor,
    fireEvent,
    act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskDetails from '../../TaskDetails';
import { useStore } from '../../../../store/useStore';
import { makeTask, makeProject, makeTag } from './fixtures';
import { Task } from '../../../../entities/Task';

const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: jest.fn(),
    },
}));

jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: {
        language: 'en',
        t: (key: string, fallback?: string) =>
            typeof fallback === 'string' ? fallback : key,
        changeLanguage: jest.fn(),
        use: jest.fn().mockReturnThis(),
        init: jest.fn(),
    },
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: mockShowSuccessToast,
        showErrorToast: mockShowErrorToast,
        showUndoToast: jest.fn(),
    }),
}));

jest.mock('../../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    fetchTaskByUid: jest.fn(),
    fetchTaskNextIterations: jest.fn(),
    fetchSubtasks: jest.fn(),
    toggleTaskCompletion: jest.fn(),
}));

jest.mock('../../../../utils/attachmentsService', () => ({
    fetchAttachments: jest.fn(),
    uploadAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
    downloadAttachment: jest.fn(),
    validateFile: jest.fn(),
    getAttachmentType: jest.fn(),
}));

jest.mock('../../../../utils/projectsService', () => ({
    createProject: jest.fn(),
}));

jest.mock('../../../Shared/DatePicker', () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
        placeholder,
    }: {
        value: string;
        onChange: (v: string) => void;
        placeholder?: string;
    }) => (
        <input
            type="text"
            value={value || ''}
            placeholder={placeholder}
            data-testid="date-picker-input"
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

jest.mock('../../../../utils/peopleService', () => ({
    fetchPeople: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../Shared/MarkdownRenderer', () => ({
    __esModule: true,
    default: ({ content }: { content: string }) => (
        <div data-testid="markdown">{content}</div>
    ),
}));

jest.mock('../../TaskTimeline', () => ({
    __esModule: true,
    default: ({
        taskUid,
        refreshKey,
    }: {
        taskUid?: string;
        refreshKey?: number;
    }) => (
        <div data-testid="task-timeline">
            {taskUid}:{refreshKey}
        </div>
    ),
}));

jest.mock('../../../AI/TaskAIInsights', () => {
    const { forwardRef, useImperativeHandle } = jest.requireActual('react');
    return {
        __esModule: true,
        default: forwardRef(function MockTaskAIInsights(
            {
                task,
                project,
                onActiveChange,
            }: {
                task: Task;
                project?: { id?: number } | null;
                onActiveChange?: (active: boolean) => void;
            },
            ref: React.Ref<{ activate: () => void }>
        ) {
            useImperativeHandle(ref, () => ({
                activate: () => onActiveChange?.(true),
            }));
            return (
                <div data-testid="task-ai-insights">
                    ai-for-{task.uid}:project-{project?.id ?? 'null'}
                </div>
            );
        }),
    };
});

import {
    updateTask,
    deleteTask,
    fetchTaskByUid,
    fetchTaskNextIterations,
    fetchSubtasks,
    toggleTaskCompletion,
} from '../../../../utils/tasksService';
import { fetchAttachments } from '../../../../utils/attachmentsService';

const mockedUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;
const mockedDeleteTask = deleteTask as jest.MockedFunction<typeof deleteTask>;
const mockedFetchTaskByUid = fetchTaskByUid as jest.MockedFunction<
    typeof fetchTaskByUid
>;
const mockedFetchSubtasks = fetchSubtasks as jest.MockedFunction<
    typeof fetchSubtasks
>;
const mockedFetchAttachments = fetchAttachments as jest.MockedFunction<
    typeof fetchAttachments
>;
const mockedFetchIterations = fetchTaskNextIterations as jest.MockedFunction<
    typeof fetchTaskNextIterations
>;
const mockedToggleCompletion = toggleTaskCompletion as jest.MockedFunction<
    typeof toggleTaskCompletion
>;

const resetStore = () => {
    useStore.setState((state) => ({
        ...state,
        tasksStore: {
            ...state.tasksStore,
            tasks: [],
        },
        projectsStore: {
            ...state.projectsStore,
            projects: [],
            hasLoaded: true,
            isLoading: false,
        },
        tagsStore: {
            ...state.tagsStore,
            tags: [],
            hasLoaded: true,
            isLoading: false,
        },
        areasStore: {
            ...state.areasStore,
            areas: [],
            hasLoaded: true,
            isLoading: false,
        },
        userSettingsStore: {
            ...state.userSettingsStore,
            aiAssistantEnabled: false,
        },
    }));
};

const renderTaskDetails = (
    uid: string,
    state?: Record<string, unknown>
) => {
    return render(
        <MemoryRouter
            initialEntries={[
                {
                    pathname: `/task/${uid}`,
                    state,
                },
            ]}
        >
            <Routes>
                <Route path="/task/:uid" element={<TaskDetails />} />
                <Route path="/today" element={<div>Today page</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('TaskDetails characterization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetStore();
        mockedFetchAttachments.mockResolvedValue([]);
        mockedFetchSubtasks.mockResolvedValue([]);
        mockedFetchIterations.mockResolvedValue([]);
        mockedUpdateTask.mockImplementation(async (_uid, data) =>
            makeTask({ ...data })
        );
        mockedFetchTaskByUid.mockImplementation(async (uid) =>
            makeTask({ uid })
        );
        mockedDeleteTask.mockResolvedValue(undefined);
        mockedToggleCompletion.mockImplementation(async (_uid, task) =>
            makeTask({
                ...task,
                status: task?.status === 'done' ? 'not_started' : 'done',
            })
        );
    });

    it('shows not-found when fetch fails', async () => {
        mockedFetchTaskByUid.mockRejectedValue(new Error('missing'));

        renderTaskDetails('missing-uid');

        await waitFor(() => {
            expect(screen.getByText('Task not found')).toBeInTheDocument();
        });
        expect(screen.getByText('Go to Today')).toBeInTheDocument();
    });

    it('fetches and appends task when missing from store', async () => {
        const fetched = makeTask({ uid: 'fetched-uid', name: 'Fetched Task' });
        mockedFetchTaskByUid.mockResolvedValue(fetched);

        renderTaskDetails('fetched-uid');

        await waitFor(() => {
            expect(screen.getByText('Fetched Task')).toBeInTheDocument();
        });
        expect(mockedFetchTaskByUid).toHaveBeenCalledWith('fetched-uid');
        expect(
            useStore
                .getState()
                .tasksStore.tasks.some((t) => t.uid === 'fetched-uid')
        ).toBe(true);
    });

    it('loads attachment count on overview before attachments pill', async () => {
        const task = makeTask();
        useStore.getState().tasksStore.setTasks([task]);
        mockedFetchAttachments.mockResolvedValue([
            { uid: 'a1' } as never,
            { uid: 'a2' } as never,
        ]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(mockedFetchAttachments).toHaveBeenCalledWith(task.uid);
        });
        expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    it('fetches subtasks when task has an empty subtasks list', async () => {
        const task = makeTask({ subtasks: [] });
        useStore.getState().tasksStore.setTasks([task]);
        mockedFetchSubtasks.mockResolvedValue([
            makeTask({ id: 2, uid: 'sub-1', name: 'Child' }),
        ]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(mockedFetchSubtasks).toHaveBeenCalledWith(task.uid);
        });
    });

    it('replaces isNew navigation state and deletes abandoned new task on unmount', async () => {
        const task = makeTask({ uid: 'new-task-uid', name: 'New Task' });
        useStore.getState().tasksStore.setTasks([task]);

        const { unmount } = renderTaskDetails(task.uid!, {
            isNew: true,
            from: '/inbox',
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue('New Task')).toBeInTheDocument();
        });

        unmount();

        await waitFor(() => {
            expect(mockedDeleteTask).toHaveBeenCalledWith('new-task-uid');
        });
        expect(
            useStore
                .getState()
                .tasksStore.tasks.some((t) => t.uid === 'new-task-uid')
        ).toBe(false);
    });

    it('skips abandoned cleanup after a successful mutation', async () => {
        const task = makeTask({ uid: 'kept-uid', name: 'Keep Me' });
        useStore.getState().tasksStore.setTasks([task]);
        mockedUpdateTask.mockResolvedValue(
            makeTask({ ...task, name: 'Renamed' })
        );
        mockedFetchTaskByUid.mockResolvedValue(
            makeTask({ ...task, name: 'Renamed' })
        );

        const { unmount } = renderTaskDetails(task.uid!, { isNew: true });

        await waitFor(() => {
            expect(screen.getByDisplayValue('Keep Me')).toBeInTheDocument();
        });

        const titleInput = screen.getByDisplayValue('Keep Me');
        fireEvent.change(titleInput, { target: { value: 'Renamed' } });
        fireEvent.blur(titleInput);

        await waitFor(() => {
            expect(mockedUpdateTask).toHaveBeenCalled();
        });

        unmount();

        expect(mockedDeleteTask).not.toHaveBeenCalled();
    });

    it('keeps due date draft when switching pills', async () => {
        const task = makeTask({ due_date: '2030-01-15' });
        useStore.getState().tasksStore.setTasks([task]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByText('Due Date')).toBeInTheDocument();
        });

        const dueHeading = screen.getByText('Due Date');
        const dueCard = dueHeading.parentElement;
        const openButton = dueCard?.querySelector('button');
        expect(openButton).toBeTruthy();
        fireEvent.click(openButton!);

        await waitFor(() => {
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Activity'));

        await waitFor(() => {
            expect(screen.getByTestId('task-timeline')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Overview'));

        await waitFor(() => {
            expect(screen.getByText('Save')).toBeInTheDocument();
        });
    });

    it('skips updateTask when tags are unchanged', async () => {
        const tag = makeTag({ name: 'urgent' });
        const task = makeTask({ tags: [tag] });
        useStore.getState().tasksStore.setTasks([task]);
        useStore.getState().tagsStore.setTags([tag]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getAllByText('urgent').length).toBeGreaterThan(0);
        });

        // Click the tag in the tags card (the one inside a <button>), not the header link
        const urgentElements = screen.getAllByText('urgent');
        const tagCardButton = urgentElements.find(
            (el) => el.closest('button[type="button"]') !== null
        );
        fireEvent.click(tagCardButton || urgentElements[urgentElements.length - 1]);

        await waitFor(() => {
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(mockedUpdateTask).not.toHaveBeenCalled();
        });
    });

    it('shows AI insights when aiAssistantEnabled and passes matching project', async () => {
        const project = makeProject({ id: 42 });
        const task = makeTask({ project_id: 42, Project: project });
        useStore.getState().tasksStore.setTasks([task]);
        useStore.getState().projectsStore.setProjects([project]);
        useStore.setState((state) => ({
            ...state,
            userSettingsStore: {
                ...state.userSettingsStore,
                aiAssistantEnabled: true,
            },
        }));

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByTestId('task-ai-insights')).toHaveTextContent(
                'ai-for-task-uid-1:project-42'
            );
        });
    });

    it('hides AI insights when aiAssistantEnabled is false', async () => {
        const task = makeTask();
        useStore.getState().tasksStore.setTasks([task]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByText('Test Task')).toBeInTheDocument();
        });
        expect(
            screen.queryByTestId('task-ai-insights')
        ).not.toBeInTheDocument();
    });

    it('uses updateTaskInStore for priority updates', async () => {
        const task = makeTask({ priority: null });
        useStore.getState().tasksStore.setTasks([task]);
        const updateSpy = jest.spyOn(
            useStore.getState().tasksStore,
            'updateTaskInStore'
        );
        mockedUpdateTask.mockResolvedValue(
            makeTask({ ...task, priority: 'high' })
        );
        mockedFetchTaskByUid.mockResolvedValue(
            makeTask({ ...task, priority: 'high' })
        );

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByText('None')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('None'));
        fireEvent.click(screen.getByText('High'));

        await waitFor(() => {
            expect(mockedUpdateTask).toHaveBeenCalledWith(
                task.uid,
                expect.objectContaining({ priority: 'high' })
            );
            expect(updateSpy).toHaveBeenCalled();
        });

        updateSpy.mockRestore();
    });

    it('nulls inapplicable recurrence fields on weekly save', async () => {
        const task = makeTask({
            recurrence_type: 'weekly',
            recurrence_weekday: 1,
            recurrence_weekdays: [1, 3],
            recurrence_interval: 1,
        });
        useStore.getState().tasksStore.setTasks([task]);
        mockedUpdateTask.mockResolvedValue(task);
        mockedFetchTaskByUid.mockResolvedValue(task);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByText(/Next Occurrences/i)).toBeInTheDocument();
        });

        const recurrenceCard = screen
            .getByText(/Next Occurrences/i)
            .closest('[role="button"]');
        expect(recurrenceCard).toBeTruthy();
        fireEvent.click(recurrenceCard!);

        await waitFor(() => {
            expect(screen.getAllByText('Save').length).toBeGreaterThan(0);
        });

        const saveButtons = screen.getAllByText('Save');
        fireEvent.click(saveButtons[saveButtons.length - 1]);

        await waitFor(() => {
            expect(mockedUpdateTask).toHaveBeenCalled();
        });

        const payload = mockedUpdateTask.mock.calls[0][1];
        expect(payload).toEqual(
            expect.objectContaining({
                recurrence_type: 'weekly',
                recurrence_month_day: null,
                recurrence_week_of_month: null,
            })
        );
    });

    it('blocks due date before defer until', async () => {
        const task = makeTask({
            due_date: '2030-06-15',
            defer_until: '2030-06-20T12:00:00.000Z',
        });
        useStore.getState().tasksStore.setTasks([task]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByText('Due Date')).toBeInTheDocument();
        });

        const dueHeading = screen.getByText('Due Date');
        const dueCard = dueHeading.parentElement;
        const openButton = dueCard?.querySelector('button');
        fireEvent.click(openButton!);

        await waitFor(() => {
            expect(screen.getByText('Save')).toBeInTheDocument();
        });

        // TaskDueDateSection may use various input types; set via any input in the card
        const inputs = dueCard?.querySelectorAll('input');
        if (inputs && inputs.length > 0) {
            fireEvent.change(inputs[0], { target: { value: '2030-06-10' } });
        }

        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(mockShowErrorToast).toHaveBeenCalled();
        });
        expect(mockedUpdateTask).not.toHaveBeenCalled();
    });

    it('deletes task and navigates to today after isNew state replace', async () => {
        const task = makeTask({ uid: 'del-uid', name: 'Delete Me' });
        useStore.getState().tasksStore.setTasks([task]);

        renderTaskDetails(task.uid!, { isNew: true, from: '/inbox' });

        await waitFor(() => {
            expect(screen.getByDisplayValue('Delete Me')).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByDisplayValue('Delete Me'), {
            key: 'Escape',
        });

        await waitFor(() => {
            expect(screen.getByText('Delete Me')).toBeInTheDocument();
        });

        // Open header actions menu
        const menuTriggers = screen.getAllByRole('button');
        const moreButton = menuTriggers.find(
            (btn) =>
                btn.getAttribute('aria-haspopup') === 'true' &&
                !btn.textContent?.includes('None') &&
                !btn.textContent?.includes('Low')
        );

        if (moreButton) {
            fireEvent.click(moreButton);
        } else {
            // Fallback: click last button that might open the menu
            const candidates = menuTriggers.filter(
                (b) => b.getAttribute('aria-haspopup') === 'true'
            );
            fireEvent.click(candidates[candidates.length - 1]);
        }

        const deleteOption = await screen.findByText(/^Delete$/i);
        fireEvent.click(deleteOption);

        const confirm = await screen.findByTestId('confirm-dialog-confirm');
        await act(async () => {
            fireEvent.click(confirm);
        });

        await waitFor(() => {
            expect(mockedDeleteTask).toHaveBeenCalledWith('del-uid');
            expect(screen.getByText('Today page')).toBeInTheDocument();
        });
    });

    it('renders activity timeline with refresh key', async () => {
        const task = makeTask();
        useStore.getState().tasksStore.setTasks([task]);

        renderTaskDetails(task.uid!);

        await waitFor(() => {
            expect(screen.getByText('Activity')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Activity'));

        await waitFor(() => {
            expect(screen.getByTestId('task-timeline')).toHaveTextContent(
                `${task.uid}:0`
            );
        });
    });
});
