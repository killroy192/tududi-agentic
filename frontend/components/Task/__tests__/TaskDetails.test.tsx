import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Area } from '../../../entities/Area';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import { fetchAreas } from '../../../utils/areasService';
import { deleteTask, fetchTaskByUid } from '../../../utils/tasksService';
import TaskDetails from '../TaskDetails';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

jest.mock('../../Shared/MarkdownRenderer', () => {
    return function MockMarkdownRenderer(props: { content?: string }) {
        return props.content ?? null;
    };
});

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: {
        language: 'en',
        t: (key: string) => key,
        on: jest.fn(),
        off: jest.fn(),
    },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/areasService', () => ({
    fetchAreas: jest.fn(),
}));

jest.mock('../../../utils/tagsService', () => ({
    fetchTags: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/attachmentsService', () => ({
    fetchAttachments: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPeople: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn().mockResolvedValue({}),
    deleteTask: jest.fn().mockResolvedValue(undefined),
    fetchTaskByUid: jest.fn(),
    fetchTaskNextIterations: jest.fn().mockResolvedValue([]),
    fetchSubtasks: jest.fn(() => new Promise(() => undefined)),
    toggleTaskCompletion: jest.fn(),
}));

jest.mock('../../../utils/projectsService', () => ({
    createProject: jest.fn(),
    fetchProjects: jest.fn().mockResolvedValue([]),
    updateProject: jest.fn(),
}));

const fetchAreasMock = fetchAreas as jest.MockedFunction<typeof fetchAreas>;
const fetchTaskByUidMock = fetchTaskByUid as jest.MockedFunction<
    typeof fetchTaskByUid
>;
const deleteTaskMock = deleteTask as jest.MockedFunction<typeof deleteTask>;

type AreasRequest = {
    resolve: (areas: Area[]) => void;
    reject: (error: Error) => void;
};

const TASK_UID = 'tsk_abc123';
const TASK_NAME = 'Buy milk';
const SECOND_TASK_UID = 'tsk_def456';
const SECOND_TASK_NAME = 'Walk the dog';

const homeArea: Area = {
    id: 1,
    uid: 'area_home',
    name: 'Home',
};

const makeTask = (overrides: Partial<Task> = {}): Task => ({
    uid: TASK_UID,
    name: TASK_NAME,
    status: 'not_started',
    completed_at: null,
    note: '',
    subtasks: [],
    ...overrides,
});

const resetStores = (tasks: Task[]) => {
    const state = useStore.getState();
    useStore.setState({
        areasStore: {
            ...state.areasStore,
            areas: [],
            isLoading: false,
            isError: false,
            hasLoaded: false,
        },
        tasksStore: {
            ...state.tasksStore,
            tasks,
            isLoading: false,
            isError: false,
        },
        tagsStore: {
            ...state.tagsStore,
            tags: [],
            isLoading: false,
            isError: false,
            hasLoaded: false,
        },
        projectsStore: {
            ...state.projectsStore,
            projects: [],
            currentProject: null,
            isLoading: false,
            isError: false,
            hasLoaded: false,
        },
    });
};

const renderTaskPage = (uid = TASK_UID, state?: { isNew?: boolean }) =>
    render(
        <MemoryRouter initialEntries={[{ pathname: `/task/${uid}`, state }]}>
            <Routes>
                <Route path="/task/:uid" element={<TaskDetails />} />
                <Route path="/today" element={<div>Today</div>} />
            </Routes>
        </MemoryRouter>
    );

const TaskSwitchHarness: React.FC = () => {
    const navigate = useNavigate();

    return (
        <>
            <button
                type="button"
                onClick={() => navigate(`/task/${SECOND_TASK_UID}`)}
            >
                Open second task
            </button>
            <Routes>
                <Route path="/task/:uid" element={<TaskDetails />} />
            </Routes>
        </>
    );
};

const settle = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
    });
};

describe('TaskDetails areas loading', () => {
    let areasRequests: AreasRequest[];

    beforeEach(() => {
        areasRequests = [];
        fetchAreasMock.mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    areasRequests.push({ resolve, reject });
                })
        );
        resetStores([makeTask()]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const finishAreasRequest = async (areas: Area[]) => {
        await act(async () => {
            areasRequests[0].resolve(areas);
        });
    };

    it('shows the task when the user has no areas and requests areas once', async () => {
        renderTaskPage();

        expect(
            await screen.findByRole('heading', { name: TASK_NAME })
        ).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([]);

        await settle();

        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
    });

    it('lists a saved area in the Area card and requests areas once', async () => {
        const user = userEvent.setup();
        renderTaskPage();

        expect(
            await screen.findByRole('heading', { name: TASK_NAME })
        ).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([homeArea]);

        await user.click(screen.getByText('Assign to an area'));

        expect(
            screen.getByRole('button', { name: 'Home' })
        ).toBeInTheDocument();
        await settle();
        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
    });

    it('still shows the task when the areas request fails, and does not retry', async () => {
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        renderTaskPage();

        expect(
            await screen.findByRole('heading', { name: TASK_NAME })
        ).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await act(async () => {
            areasRequests[0].reject(new Error('areas unavailable'));
        });

        await settle();

        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
        const areaFailures = errorSpy.mock.calls.filter(
            (args) => args[0] === 'loadAreas: Failed to load areas:'
        );
        expect(areaFailures).toHaveLength(1);

        errorSpy.mockRestore();
    });
});

describe('TaskDetails navigation', () => {
    let areasRequests: AreasRequest[];

    beforeEach(() => {
        areasRequests = [];
        fetchAreasMock.mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    areasRequests.push({ resolve, reject });
                })
        );
        fetchTaskByUidMock.mockReset();
        deleteTaskMock.mockReset();
        deleteTaskMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const finishAreasRequest = async (areas: Area[] = []) => {
        await act(async () => {
            areasRequests[0].resolve(areas);
        });
    };

    it('loads a task that is not already in the store', async () => {
        let resolveTask: (task: Task) => void = () => undefined;
        fetchTaskByUidMock.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveTask = resolve;
                })
        );
        resetStores([]);
        renderTaskPage();

        expect(
            screen.getByText('Loading application... Please wait.')
        ).toBeInTheDocument();

        await act(async () => {
            resolveTask(makeTask());
        });

        expect(
            await screen.findByRole('heading', { name: TASK_NAME })
        ).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([]);
        await settle();

        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
        expect(fetchTaskByUidMock).toHaveBeenCalledTimes(1);
    });

    it('shows Task Not Found for an unknown uid and does not reload areas', async () => {
        fetchTaskByUidMock.mockRejectedValue(new Error('missing'));
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        resetStores([]);
        const user = userEvent.setup();
        renderTaskPage('does-not-exist');

        expect(
            await screen.findByRole('heading', { name: 'Task not found' })
        ).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([]);
        await settle();

        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole('button', { name: 'Go to Today' }));
        expect(screen.getByText('Today')).toBeInTheDocument();

        errorSpy.mockRestore();
    });

    it('opens a newly created task in edit mode without deleting it', async () => {
        resetStores([makeTask()]);
        renderTaskPage(TASK_UID, { isNew: true });

        expect(await screen.findByDisplayValue(TASK_NAME)).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([]);
        await settle();

        expect(deleteTaskMock).not.toHaveBeenCalled();
        expect(screen.getByDisplayValue(TASK_NAME)).toBeInTheDocument();
    });

    it('shows the next task on the same page without requesting areas again', async () => {
        resetStores([
            makeTask(),
            makeTask({ uid: SECOND_TASK_UID, name: SECOND_TASK_NAME }),
        ]);
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={[`/task/${TASK_UID}`]}>
                <TaskSwitchHarness />
            </MemoryRouter>
        );

        expect(
            await screen.findByRole('heading', { name: TASK_NAME })
        ).toBeInTheDocument();
        await waitFor(() => expect(fetchAreasMock).toHaveBeenCalledTimes(1));
        await finishAreasRequest([]);

        await user.click(
            screen.getByRole('button', { name: 'Open second task' })
        );

        expect(
            await screen.findByRole('heading', { name: SECOND_TASK_NAME })
        ).toBeInTheDocument();
        await settle();
        expect(fetchAreasMock).toHaveBeenCalledTimes(1);
    });
});
