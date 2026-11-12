import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import {
    Location,
    MemoryRouter,
    NavigateFunction,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import TaskDetails from '../../TaskDetails';
import { Task } from '../../../../entities/Task';
import { useStore } from '../../../../store/useStore';
import * as tasksService from '../../../../utils/tasksService';
import * as projectsService from '../../../../utils/projectsService';
import * as attachmentsService from '../../../../utils/attachmentsService';
import {
    aiActivate,
    cardProps,
    headerPropsHistory,
    resetCardProps,
    toast,
} from './taskDetailsPage.mocks';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));
jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en', t: (key: string) => key },
}));

jest.mock('../../../../utils/tasksService', () => ({
    ...jest.requireActual('../../../../utils/tasksService'),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    fetchTaskByUid: jest.fn(),
    fetchTaskNextIterations: jest.fn(),
    fetchSubtasks: jest.fn(),
    toggleTaskCompletion: jest.fn(),
}));
jest.mock('../../../../utils/projectsService', () => ({
    ...jest.requireActual('../../../../utils/projectsService'),
    createProject: jest.fn(),
}));
jest.mock('../../../../utils/attachmentsService', () => ({
    ...jest.requireActual('../../../../utils/attachmentsService'),
    fetchAttachments: jest.fn(),
}));
jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => jest.requireActual('./taskDetailsPage.mocks').toast,
}));
jest.mock('../../../Shared/LoadingScreen', () => ({
    __esModule: true,
    default: () => <div>loading-screen</div>,
}));
jest.mock('../../../Shared/ConfirmDialog', () =>
    jest.requireActual('./taskDetailsPage.mocks').confirmDialogModule()
);
jest.mock('../../../AI/TaskAIInsights', () =>
    jest.requireActual('./taskDetailsPage.mocks').aiInsightsModule()
);
jest.mock('../../TaskTimeline', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskTimeline')
);
jest.mock('../TaskDetailsHeader', () =>
    jest.requireActual('./taskDetailsPage.mocks').headerModule()
);
jest.mock('../TaskContentCard', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskContentCard')
);
jest.mock('../TaskProjectCard', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskProjectCard')
);
jest.mock('../TaskAreaCard', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskAreaCard')
);
jest.mock('../TaskTagsCard', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskTagsCard')
);
jest.mock('../TaskSubtasksCard', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskSubtasksCard')
);
jest.mock('../TaskRecurrenceCard', () =>
    jest
        .requireActual('./taskDetailsPage.mocks')
        .stubModule('TaskRecurrenceCard')
);
jest.mock('../TaskDueDateCard', () =>
    jest.requireActual('./taskDetailsPage.mocks').stubModule('TaskDueDateCard')
);
jest.mock('../TaskDeferUntilCard', () =>
    jest
        .requireActual('./taskDetailsPage.mocks')
        .stubModule('TaskDeferUntilCard')
);
jest.mock('../TaskAttachmentsCard', () =>
    jest
        .requireActual('./taskDetailsPage.mocks')
        .stubModule('TaskAttachmentsCard')
);
jest.mock('../TaskAssignedToCard', () =>
    jest
        .requireActual('./taskDetailsPage.mocks')
        .stubModule('TaskAssignedToCard')
);

const mocked = {
    updateTask: tasksService.updateTask as jest.Mock,
    deleteTask: tasksService.deleteTask as jest.Mock,
    fetchTaskByUid: tasksService.fetchTaskByUid as jest.Mock,
    fetchTaskNextIterations: tasksService.fetchTaskNextIterations as jest.Mock,
    fetchSubtasks: tasksService.fetchSubtasks as jest.Mock,
    toggleTaskCompletion: tasksService.toggleTaskCompletion as jest.Mock,
    createProject: projectsService.createProject as jest.Mock,
    fetchAttachments: attachmentsService.fetchAttachments as jest.Mock,
};

const initialState = useStore.getState();

const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Write tests',
    status: 0,
    priority: 0,
    completed_at: null,
    note: 'Original note',
    tags: [],
    subtasks: [],
    ...overrides,
});

const subtask = (overrides: Partial<Task> = {}): Task => ({
    id: 101,
    uid: 'sub-1',
    name: 'Sub one',
    status: 0,
    completed_at: null,
    ...overrides,
});

const router: { location?: Location; navigate?: NavigateFunction } = {};
const RouterProbe = () => {
    router.location = useLocation();
    router.navigate = useNavigate();
    return null;
};

let setTasksSpy: jest.Mock;
let updateTaskInStoreSpy: jest.Mock;

const seedStore = (tasks: Task[], overrides: { ai?: boolean } = {}) => {
    useStore.setState(initialState, true);
    const state = useStore.getState();
    setTasksSpy = jest.fn(state.tasksStore.setTasks);
    updateTaskInStoreSpy = jest.fn(state.tasksStore.updateTaskInStore);
    useStore.setState({
        tasksStore: {
            ...state.tasksStore,
            tasks,
            setTasks: setTasksSpy,
            updateTaskInStore: updateTaskInStoreSpy,
        },
        projectsStore: { ...state.projectsStore, projects: [] },
        tagsStore: {
            ...state.tagsStore,
            tags: [],
            hasLoaded: true,
            isLoading: false,
            loadTags: jest.fn(),
        },
        areasStore: {
            ...state.areasStore,
            areas: [],
            hasLoaded: true,
            isLoading: false,
            loadAreas: jest.fn(),
        },
        userSettingsStore: {
            ...state.userSettingsStore,
            aiAssistantEnabled: overrides.ai ?? false,
        },
    });
};

const storeTask = (uid = 'task-1') =>
    useStore.getState().tasksStore.tasks.find((t) => t.uid === uid);

const patchStoreTask = (patch: Partial<Task>, uid = 'task-1') =>
    act(() => {
        const { tasksStore } = useStore.getState();
        tasksStore.setTasks(
            tasksStore.tasks.map((t) =>
                t.uid === uid ? { ...t, ...patch } : t
            )
        );
    });

const flush = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

const renderPage = async ({
    path = '/task/task-1',
    state,
}: { path?: string; state?: unknown } = {}) => {
    const utils = render(
        <MemoryRouter initialEntries={[{ pathname: path, state }]}>
            <RouterProbe />
            <Routes>
                <Route path="/task/:uid" element={<TaskDetails />} />
                <Route path="/task" element={<TaskDetails />} />
                <Route path="*" element={<div>elsewhere</div>} />
            </Routes>
        </MemoryRouter>
    );
    await flush();
    await flush();
    return utils;
};

const callProp = async (
    component: string,
    prop: string,
    ...args: unknown[]
) => {
    let result: unknown;
    await act(async () => {
        result = await cardProps[component][prop](...args);
    });
    return result;
};

const rejectProp = async (
    component: string,
    prop: string,
    ...args: unknown[]
) => {
    let caught: unknown;
    await act(async () => {
        try {
            await cardProps[component][prop](...args);
        } catch (error) {
            caught = error;
        }
    });
    return caught;
};

const timelineKey = async () => {
    await callProp('TaskDetailsHeader', 'onPillChange', 'activity');
    const key = cardProps.TaskTimeline.refreshKey;
    await callProp('TaskDetailsHeader', 'onPillChange', 'overview');
    return key;
};

const clearCalls = () => {
    Object.values(mocked).forEach((mock) => mock.mockClear());
    setTasksSpy.mockClear();
    updateTaskInStoreSpy.mockClear();
    toast.showSuccessToast.mockClear();
    toast.showErrorToast.mockClear();
};

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetCardProps();
    Object.values(mocked).forEach((mock) => mock.mockReset());
    toast.showSuccessToast.mockReset();
    toast.showErrorToast.mockReset();
    aiActivate.mockReset();
    mocked.updateTask.mockResolvedValue({});
    mocked.deleteTask.mockResolvedValue(undefined);
    mocked.fetchTaskByUid.mockImplementation(async (uid: string) => ({
        ...storeTask(uid),
    }));
    mocked.fetchTaskNextIterations.mockResolvedValue([]);
    mocked.fetchSubtasks.mockResolvedValue([]);
    mocked.fetchAttachments.mockResolvedValue([]);
    seedStore([makeTask()]);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('TaskDetails page', () => {
    describe('loading the task (P3)', () => {
        it('uses the task already in the store without fetching it', async () => {
            await renderPage();

            expect(screen.getByTestId('TaskDetailsHeader')).toBeInTheDocument();
            expect(mocked.fetchTaskByUid).not.toHaveBeenCalled();
        });

        it('fetches a task missing from the store and appends it', async () => {
            seedStore([makeTask({ id: 9, uid: 'other' })]);
            mocked.fetchTaskByUid.mockResolvedValue(makeTask());

            await renderPage();

            expect(mocked.fetchTaskByUid).toHaveBeenCalledWith('task-1');
            expect(
                useStore.getState().tasksStore.tasks.map((t) => t.uid)
            ).toEqual(['other', 'task-1']);
            expect(screen.getByTestId('TaskDetailsHeader')).toBeInTheDocument();
        });

        it('shows "Task not found" when the fetch fails', async () => {
            seedStore([]);
            mocked.fetchTaskByUid.mockRejectedValue(new Error('404'));

            await renderPage();

            expect(screen.getByText('Task not found')).toBeInTheDocument();
        });

        it('shows "No task uid provided" without a uid', async () => {
            seedStore([]);

            await renderPage({ path: '/task' });

            expect(
                screen.getByText('No task uid provided')
            ).toBeInTheDocument();
        });

        it('navigates to /today from the error screen (P9)', async () => {
            seedStore([]);
            mocked.fetchTaskByUid.mockRejectedValue(new Error('404'));
            await renderPage();

            fireEvent.click(screen.getByText('Go to Today'));

            expect(router.location?.pathname).toBe('/today');
        });
    });

    describe('new task handling (P1, P2, I1)', () => {
        it('clears navigation state and auto-edits the title of a new task', async () => {
            await renderPage({ state: { isNew: true } });

            expect(router.location?.state).toEqual({});
            expect(headerPropsHistory[0].autoEditTitle).toBe(true);
        });

        it('deletes an unmodified new task on unmount', async () => {
            const { unmount } = await renderPage({ state: { isNew: true } });

            unmount();

            expect(mocked.deleteTask).toHaveBeenCalledWith('task-1');
            expect(storeTask()).toBeUndefined();
        });

        it('keeps a new task that was modified by a mutation', async () => {
            const { unmount } = await renderPage({ state: { isNew: true } });

            await callProp('TaskDetailsHeader', 'onTitleUpdate', 'Renamed');
            unmount();

            expect(mocked.deleteTask).not.toHaveBeenCalled();
        });

        it('keeps a new task after a size save', async () => {
            const { unmount } = await renderPage({ state: { isNew: true } });

            await callProp('TaskDetailsHeader', 'onSizeSaved', 'M');
            unmount();

            expect(mocked.deleteTask).not.toHaveBeenCalled();
        });

        it('keeps a new task after a failed mutation', async () => {
            const { unmount } = await renderPage({ state: { isNew: true } });
            mocked.updateTask.mockRejectedValue(new Error('nope'));

            await callProp('TaskAssignedToCard', 'onAssign', 'person-1');
            unmount();

            expect(mocked.deleteTask).not.toHaveBeenCalled();
        });

        it('does not delete an existing task on unmount', async () => {
            const { unmount } = await renderPage();

            unmount();

            expect(mocked.deleteTask).not.toHaveBeenCalled();
        });
    });

    describe('lazy store loads (P4)', () => {
        it('loads tags and areas when they have not loaded', async () => {
            const state = useStore.getState();
            const loadTags = jest.fn();
            const loadAreas = jest.fn();
            useStore.setState({
                tagsStore: { ...state.tagsStore, hasLoaded: false, loadTags },
                areasStore: {
                    ...state.areasStore,
                    hasLoaded: false,
                    loadAreas,
                },
            });

            await renderPage();

            expect(loadTags).toHaveBeenCalled();
            expect(loadAreas).toHaveBeenCalled();
        });

        it('skips loading when already loaded or loading', async () => {
            const state = useStore.getState();
            useStore.setState({
                tagsStore: {
                    ...state.tagsStore,
                    hasLoaded: false,
                    isLoading: true,
                },
            });

            await renderPage();

            expect(
                useStore.getState().tagsStore.loadTags
            ).not.toHaveBeenCalled();
            expect(
                useStore.getState().areasStore.loadAreas
            ).not.toHaveBeenCalled();
        });
    });

    describe('overdue bubble (P5)', () => {
        const overdueTask = () =>
            makeTask({ status: 1, created_at: '2020-01-01T00:00:00Z' });

        it('toggles from the icon and closes on an outside click', async () => {
            seedStore([overdueTask()]);
            await renderPage();
            expect(cardProps.TaskDetailsHeader.showOverdueIcon).toBe(true);

            await callProp('TaskDetailsHeader', 'onOverdueIconClick');
            expect(screen.getByText('overdue-bubble')).toBeInTheDocument();

            fireEvent.mouseDown(screen.getByText('overdue-toggle'));
            expect(screen.getByText('overdue-bubble')).toBeInTheDocument();

            fireEvent.mouseDown(document.body);
            expect(
                screen.queryByText('overdue-bubble')
            ).not.toBeInTheDocument();
        });

        it('dismisses from the alert', async () => {
            seedStore([overdueTask()]);
            await renderPage();
            await callProp('TaskDetailsHeader', 'onOverdueIconClick');

            await callProp('TaskDetailsHeader', 'onDismissOverdueAlert');

            expect(
                screen.queryByText('overdue-bubble')
            ).not.toBeInTheDocument();
        });

        it('ignores the icon when the task is not overdue', async () => {
            await renderPage();

            await callProp('TaskDetailsHeader', 'onOverdueIconClick');
            await patchStoreTask({
                status: 1,
                created_at: '2020-01-01T00:00:00Z',
            });

            expect(
                screen.queryByText('overdue-bubble')
            ).not.toBeInTheDocument();
        });

        it('resets the bubble when the task stops being overdue', async () => {
            seedStore([overdueTask()]);
            await renderPage();
            await callProp('TaskDetailsHeader', 'onOverdueIconClick');

            await patchStoreTask({ status: 2 });
            await patchStoreTask({ status: 1 });

            expect(
                screen.queryByText('overdue-bubble')
            ).not.toBeInTheDocument();
        });
    });

    describe('tabs (P7) and state across tab switches (I4)', () => {
        it('renders only the active tab content', async () => {
            await renderPage();
            expect(screen.getByTestId('TaskContentCard')).toBeInTheDocument();

            await callProp('TaskDetailsHeader', 'onPillChange', 'attachments');
            expect(
                screen.getByTestId('TaskAttachmentsCard')
            ).toBeInTheDocument();
            expect(
                screen.queryByTestId('TaskContentCard')
            ).not.toBeInTheDocument();

            await callProp('TaskDetailsHeader', 'onPillChange', 'activity');
            expect(screen.getByTestId('TaskTimeline')).toBeInTheDocument();
            expect(cardProps.TaskTimeline.taskUid).toBe('task-1');
        });

        it('keeps recurrence edits and pending subtasks after switching tabs', async () => {
            await renderPage();
            await callProp('TaskRecurrenceCard', 'onStartEdit');
            await callProp(
                'TaskRecurrenceCard',
                'onChange',
                'recurrence_interval',
                3
            );
            const pending = [subtask({ name: 'Draft' })];
            await callProp('TaskSubtasksCard', 'onSubtasksChange', pending);

            await callProp('TaskDetailsHeader', 'onPillChange', 'activity');
            await callProp('TaskDetailsHeader', 'onPillChange', 'overview');

            expect(cardProps.TaskRecurrenceCard.isEditing).toBe(true);
            expect(
                cardProps.TaskRecurrenceCard.recurrenceForm.recurrence_interval
            ).toBe(3);
            expect(cardProps.TaskSubtasksCard.subtasks).toBe(pending);
        });
    });

    describe('delete (P8)', () => {
        it('confirms, deletes and navigates to the origin', async () => {
            const { unmount } = await renderPage({
                state: { isNew: true, from: '/inbox' },
            });
            // P1 replaced the state, so `from` is no longer available
            await callProp('TaskDetailsHeader', 'onDelete');
            fireEvent.click(screen.getByText('confirm-delete'));
            await flush();

            expect(mocked.deleteTask).toHaveBeenCalledTimes(1);
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Task deleted successfully'
            );
            expect(router.location?.pathname).toBe('/today');
            unmount();
            expect(mocked.deleteTask).toHaveBeenCalledTimes(1);
        });

        it('navigates to location.state.from for an existing task', async () => {
            await renderPage({ state: { from: '/inbox' } });

            await callProp('TaskDetailsHeader', 'onDelete');
            fireEvent.click(screen.getByText('confirm-delete'));
            await flush();

            expect(router.location?.pathname).toBe('/inbox');
        });

        it('cancel closes the dialog without deleting', async () => {
            await renderPage();

            await callProp('TaskDetailsHeader', 'onDelete');
            fireEvent.click(screen.getByText('cancel-delete'));

            expect(
                screen.queryByText('confirm-delete')
            ).not.toBeInTheDocument();
            expect(mocked.deleteTask).not.toHaveBeenCalled();
        });

        it('shows an error toast when delete fails', async () => {
            mocked.deleteTask.mockRejectedValue(new Error('nope'));
            await renderPage();

            await callProp('TaskDetailsHeader', 'onDelete');
            fireEvent.click(screen.getByText('confirm-delete'));
            await flush();

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to delete task'
            );
            expect(router.location?.pathname).toBe('/task/task-1');
        });
    });

    describe('header actions', () => {
        it('updates a trimmed title through replace-at-index', async () => {
            await renderPage();
            clearCalls();
            mocked.fetchTaskByUid.mockResolvedValue(
                makeTask({ name: 'Renamed' })
            );

            await callProp('TaskDetailsHeader', 'onTitleUpdate', '  Renamed  ');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                name: 'Renamed',
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(updateTaskInStoreSpy).not.toHaveBeenCalled();
            expect(storeTask()?.name).toBe('Renamed');
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Task title updated successfully'
            );
            expect(await timelineKey()).toBe(1);
        });

        it('ignores empty or unchanged titles', async () => {
            await renderPage();

            await callProp('TaskDetailsHeader', 'onTitleUpdate', '   ');
            await callProp(
                'TaskDetailsHeader',
                'onTitleUpdate',
                ' Write tests '
            );

            expect(mocked.updateTask).not.toHaveBeenCalled();
        });

        it('rethrows a failed title update (I5)', async () => {
            await renderPage();
            const failure = new Error('nope');
            mocked.updateTask.mockRejectedValue(failure);

            const caught = await rejectProp(
                'TaskDetailsHeader',
                'onTitleUpdate',
                'Renamed'
            );

            expect(caught).toBe(failure);
            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update task title'
            );
        });

        it('updates status through replace-at-index', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskDetailsHeader', 'onStatusUpdate', 1);

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                status: 1,
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Status updated successfully'
            );
        });

        it('shows an error toast when the status update fails', async () => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));

            await callProp('TaskDetailsHeader', 'onStatusUpdate', 1);

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update status'
            );
        });

        it('updates priority through updateTaskInStore', async () => {
            await renderPage();
            clearCalls();
            mocked.fetchTaskByUid.mockResolvedValue(makeTask({ priority: 2 }));

            await callProp('TaskDetailsHeader', 'onPriorityUpdate', 'high');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                priority: 'high',
            });
            expect(updateTaskInStoreSpy).toHaveBeenCalled();
            expect(setTasksSpy).not.toHaveBeenCalled();
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Priority updated successfully'
            );
            expect(await timelineKey()).toBe(1);
        });

        it('rethrows a failed priority update (I5)', async () => {
            await renderPage();
            const failure = new Error('nope');
            mocked.updateTask.mockRejectedValue(failure);

            const caught = await rejectProp(
                'TaskDetailsHeader',
                'onPriorityUpdate',
                'high'
            );

            expect(caught).toBe(failure);
            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update priority'
            );
        });

        it('writes a saved size to the store without refetching or a timeline bump', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskDetailsHeader', 'onSizeSaved', 'XL');

            expect(updateTaskInStoreSpy).toHaveBeenCalledWith(
                expect.objectContaining({ uid: 'task-1', size: 'XL' })
            );
            expect(storeTask()?.size).toBe('XL');
            expect(mocked.updateTask).not.toHaveBeenCalled();
            expect(mocked.fetchTaskByUid).not.toHaveBeenCalled();
            expect(await timelineKey()).toBe(0);
        });

        it('merges the completion toggle response and refreshes iterations', async () => {
            const sub = subtask();
            seedStore([makeTask({ subtasks: [sub] })]);
            await renderPage();
            clearCalls();
            mocked.toggleTaskCompletion.mockResolvedValue({
                ...makeTask({ status: 2, recurrence_type: 'daily' }),
                subtasks: undefined,
            });

            await callProp('TaskDetailsHeader', 'onQuickStatusToggle');

            expect(mocked.toggleTaskCompletion).toHaveBeenCalledWith(
                'task-1',
                expect.objectContaining({ uid: 'task-1' })
            );
            expect(setTasksSpy).toHaveBeenCalled();
            expect(storeTask()?.status).toBe(2);
            expect(storeTask()?.subtasks).toEqual([sub]);
            expect(mocked.fetchTaskNextIterations).toHaveBeenCalledWith(
                'task-1'
            );
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Status updated successfully'
            );
            expect(await timelineKey()).toBe(1);
        });

        it('shows an error toast when the completion toggle fails', async () => {
            await renderPage();
            mocked.toggleTaskCompletion.mockRejectedValue(new Error('nope'));

            await callProp('TaskDetailsHeader', 'onQuickStatusToggle');

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update status'
            );
        });

        it('passes header flags and link builders', async () => {
            seedStore([makeTask({ due_date: '2000-01-01' })]);
            await renderPage();
            const header = cardProps.TaskDetailsHeader;

            expect(header.showPastDueBadge).toBe(true);
            expect(header.activePill).toBe('overview');
            expect(header.autoEditTitle).toBe(false);
            expect(
                header.getProjectLink({ uid: 'p1', name: 'My Project!' })
            ).toBe('/project/p1-my-project');
            expect(header.getProjectLink({ id: 7, name: 'x' })).toBe(
                '/project/7'
            );
            expect(header.getTagLink({ uid: 't1', name: 'Deep Work' })).toBe(
                '/tag/t1-deep-work'
            );
            expect(header.getTagLink({ name: 'a b' })).toBe('/tag/a%20b');
        });
    });

    describe('subtasks', () => {
        it('loads subtasks on first view and writes them with replace-at-index', async () => {
            const fetched = [subtask()];
            mocked.fetchSubtasks.mockResolvedValue(fetched);

            await renderPage();

            expect(mocked.fetchSubtasks).toHaveBeenCalledWith('task-1');
            expect(storeTask()?.subtasks).toEqual(fetched);
            expect(cardProps.TaskSubtasksCard.subtasks).toEqual(fetched);
        });

        it('does not fetch when the task already has subtasks', async () => {
            seedStore([makeTask({ subtasks: [subtask()] })]);

            await renderPage();

            expect(mocked.fetchSubtasks).not.toHaveBeenCalled();
        });

        it('refetches when the subtask count drops to zero', async () => {
            seedStore([makeTask({ subtasks: [subtask()] })]);
            await renderPage();

            await patchStoreTask({ subtasks: [] });
            await flush();

            expect(mocked.fetchSubtasks).toHaveBeenCalledWith('task-1');
        });

        it('resets subtask state when the uid changes (I3)', async () => {
            seedStore([makeTask(), makeTask({ id: 2, uid: 'task-2' })]);
            await renderPage();
            expect(mocked.fetchSubtasks).toHaveBeenCalledWith('task-1');

            await act(async () => {
                router.navigate?.('/task/task-2');
            });
            await flush();

            expect(mocked.fetchSubtasks).toHaveBeenCalledWith('task-2');
        });

        it('makes no call when nothing changed', async () => {
            const sub = subtask();
            seedStore([makeTask({ subtasks: [sub] })]);
            await renderPage();

            await callProp('TaskSubtasksCard', 'onSave', [{ ...sub }]);

            expect(mocked.updateTask).not.toHaveBeenCalled();
        });

        it('saves when a draft flag is set', async () => {
            const sub = subtask();
            seedStore([makeTask({ subtasks: [sub] })]);
            await renderPage();
            clearCalls();

            await callProp('TaskSubtasksCard', 'onSave', [
                { ...sub, _isEdited: true },
            ]);

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                subtasks: [{ ...sub, _isEdited: true }],
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(toast.showSuccessToast).not.toHaveBeenCalled();
            expect(await timelineKey()).toBe(1);
        });

        it('rolls pending subtasks back when the save fails', async () => {
            const sub = subtask();
            seedStore([makeTask({ subtasks: [sub] })]);
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));
            const draft = [
                sub,
                subtask({ id: 102, uid: 'sub-2', name: 'New' }),
            ];
            await callProp('TaskSubtasksCard', 'onSubtasksChange', draft);

            await callProp('TaskSubtasksCard', 'onSave', draft);

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update subtasks'
            );
            expect(cardProps.TaskSubtasksCard.subtasks).toEqual([sub]);
        });
    });

    describe('recurrence', () => {
        it('defaults the month day when switching to monthly', async () => {
            await renderPage();

            await callProp(
                'TaskRecurrenceCard',
                'onChange',
                'recurrence_type',
                'monthly'
            );

            expect(cardProps.TaskRecurrenceCard.recurrenceForm).toEqual(
                expect.objectContaining({
                    recurrence_type: 'monthly',
                    recurrence_month_day: new Date().getDate(),
                })
            );
        });

        it('saves a payload that nulls fields the type does not use', async () => {
            await renderPage();
            clearCalls();
            await callProp('TaskRecurrenceCard', 'onStartEdit');
            await callProp(
                'TaskRecurrenceCard',
                'onChange',
                'recurrence_type',
                'weekly'
            );
            await callProp(
                'TaskRecurrenceCard',
                'onChange',
                'recurrence_weekdays',
                [1, 3]
            );
            await callProp(
                'TaskRecurrenceCard',
                'onChange',
                'recurrence_month_day',
                5
            );

            await callProp('TaskRecurrenceCard', 'onSave');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_end_date: null,
                recurrence_weekday: null,
                recurrence_weekdays: [1, 3],
                recurrence_month_day: null,
                recurrence_week_of_month: null,
                completion_based: false,
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(cardProps.TaskRecurrenceCard.isEditing).toBe(false);
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Recurrence updated successfully'
            );
        });

        it('closes the editor even when the save fails', async () => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));
            await callProp('TaskRecurrenceCard', 'onStartEdit');

            await callProp('TaskRecurrenceCard', 'onSave');

            expect(cardProps.TaskRecurrenceCard.isEditing).toBe(false);
            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update recurrence'
            );
        });

        it('cancel resets the form from the task', async () => {
            await renderPage();
            await callProp('TaskRecurrenceCard', 'onStartEdit');
            await callProp(
                'TaskRecurrenceCard',
                'onChange',
                'recurrence_interval',
                4
            );

            await callProp('TaskRecurrenceCard', 'onCancel');

            expect(cardProps.TaskRecurrenceCard.isEditing).toBe(false);
            expect(
                cardProps.TaskRecurrenceCard.recurrenceForm.recurrence_interval
            ).toBe(1);
        });

        it('re-syncs the form when the task recurrence changes', async () => {
            await renderPage();

            await patchStoreTask({
                recurrence_type: 'daily',
                recurrence_interval: 2,
            });

            expect(cardProps.TaskRecurrenceCard.recurrenceForm).toEqual(
                expect.objectContaining({
                    recurrence_type: 'daily',
                    recurrence_interval: 2,
                })
            );
        });

        it('loads iterations from a template task', async () => {
            const iterations = [{ date: '2030-01-01', utc_date: '2030-01-01' }];
            mocked.fetchTaskNextIterations.mockResolvedValue(iterations);
            seedStore([makeTask({ recurrence_type: 'daily' })]);

            await renderPage();

            expect(mocked.fetchTaskNextIterations).toHaveBeenCalledWith(
                'task-1'
            );
            expect(cardProps.TaskRecurrenceCard.nextIterations).toEqual(
                iterations
            );
            expect(cardProps.TaskRecurrenceCard.canEdit).toBe(true);
        });

        it('loads the parent and its iterations for an instance', async () => {
            const parent = makeTask({
                id: 50,
                uid: 'parent-1',
                recurrence_type: 'weekly',
            });
            mocked.fetchTaskByUid.mockImplementation(async (uid: string) =>
                uid === 'parent-1' ? parent : { ...storeTask(uid) }
            );
            seedStore([
                makeTask({
                    recurring_parent_id: 50,
                    recurring_parent_uid: 'parent-1',
                }),
            ]);

            await renderPage();

            expect(mocked.fetchTaskByUid).toHaveBeenCalledWith('parent-1');
            expect(cardProps.TaskRecurrenceCard.parentTask).toEqual(parent);
            expect(mocked.fetchTaskNextIterations).toHaveBeenCalledWith(
                'parent-1'
            );
            expect(cardProps.TaskRecurrenceCard.canEdit).toBe(false);
        });
    });

    describe('tags', () => {
        it('makes no call when tags are unchanged', async () => {
            seedStore([makeTask({ tags: [{ name: 'a' }, { name: 'b' }] })]);
            await renderPage();

            await callProp('TaskTagsCard', 'onUpdate', ['a', 'b']);

            expect(mocked.updateTask).not.toHaveBeenCalled();
        });

        it('sends tags as objects and keeps subtasks', async () => {
            const sub = subtask();
            seedStore([makeTask({ subtasks: [sub] })]);
            await renderPage();
            clearCalls();
            mocked.fetchTaskByUid.mockResolvedValue({
                ...makeTask({ tags: [{ name: 'x' }] }),
                subtasks: undefined,
            });

            await callProp('TaskTagsCard', 'onUpdate', ['x']);

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                tags: [{ name: 'x' }],
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(storeTask()?.subtasks).toEqual([sub]);
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Tags updated successfully'
            );
            expect(await timelineKey()).toBe(1);
        });

        it.each([
            [{ details: ['First', 'Second'], message: 'm' }, 'First. Second'],
            [new Error('Server message'), 'Server message'],
            [{}, 'Failed to update tags'],
        ])('reports %p as "%s" and rethrows (I5)', async (failure, message) => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(failure);

            const caught = await rejectProp('TaskTagsCard', 'onUpdate', ['x']);

            expect(caught).toBe(failure);
            expect(toast.showErrorToast).toHaveBeenCalledWith(message);
        });

        it('passes tag store state and a tag link builder', async () => {
            await renderPage();
            const props = cardProps.TaskTagsCard;

            expect(props.hasLoadedTags).toBe(true);
            expect(props.getTagLink({ uid: 't1', name: 'Home' })).toBe(
                '/tag/t1-home'
            );
            props.onLoadTags();
            expect(useStore.getState().tagsStore.loadTags).toHaveBeenCalled();
        });
    });

    describe('people', () => {
        it('assigns through updateTaskInStore without a toast or timeline bump', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskAssignedToCard', 'onAssign', 'person-1');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                assigned_to: 'person-1',
            });
            expect(updateTaskInStoreSpy).toHaveBeenCalled();
            expect(setTasksSpy).not.toHaveBeenCalled();
            expect(toast.showSuccessToast).not.toHaveBeenCalled();
            expect(await timelineKey()).toBe(0);
        });

        it('shows the untranslated error text on failure', async () => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));

            await callProp('TaskAssignedToCard', 'onAssign', null);

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update assignment'
            );
        });
    });

    describe('attachments', () => {
        it('shows the fetched count in the header and follows card updates', async () => {
            mocked.fetchAttachments.mockResolvedValue([{}, {}]);
            await renderPage();
            expect(mocked.fetchAttachments).toHaveBeenCalledWith('task-1');
            expect(cardProps.TaskDetailsHeader.attachmentCount).toBe(2);

            await callProp('TaskDetailsHeader', 'onPillChange', 'attachments');
            expect(cardProps.TaskAttachmentsCard.taskUid).toBe('task-1');
            await callProp(
                'TaskAttachmentsCard',
                'onAttachmentsCountChange',
                5
            );

            expect(cardProps.TaskDetailsHeader.attachmentCount).toBe(5);
        });
    });

    describe('AI insights', () => {
        it('is hidden when the assistant is disabled', async () => {
            await renderPage();

            expect(
                screen.queryByTestId('TaskAIInsights')
            ).not.toBeInTheDocument();
            expect(
                cardProps.TaskDetailsHeader.onAiInsightsClick
            ).toBeUndefined();
        });

        it('is wired to the header when enabled', async () => {
            const project = { id: 3, name: 'Proj' };
            seedStore([makeTask({ project_id: 3 })], { ai: true });
            const state = useStore.getState();
            useStore.setState({
                projectsStore: { ...state.projectsStore, projects: [project] },
            });
            await renderPage();

            expect(cardProps.TaskAIInsights.project).toEqual(project);
            await callProp('TaskDetailsHeader', 'onAiInsightsClick');
            expect(aiActivate).toHaveBeenCalled();

            await callProp('TaskAIInsights', 'onActiveChange', true);
            expect(cardProps.TaskDetailsHeader.aiInsightsActive).toBe(true);
        });

        it('passes a null project when none matches', async () => {
            seedStore([makeTask({ project_id: 99 })], { ai: true });

            await renderPage();

            expect(cardProps.TaskAIInsights.project).toBeNull();
        });
    });

    describe('content', () => {
        it('updates trimmed content through replace-at-index', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskContentCard', 'onUpdate', '  New note  ');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                note: 'New note',
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Task content updated successfully'
            );
        });

        it('ignores unchanged content', async () => {
            await renderPage();

            await callProp('TaskContentCard', 'onUpdate', ' Original note ');

            expect(mocked.updateTask).not.toHaveBeenCalled();
        });

        it('rethrows a failed update (I5)', async () => {
            await renderPage();
            const failure = new Error('nope');
            mocked.updateTask.mockRejectedValue(failure);

            const caught = await rejectProp('TaskContentCard', 'onUpdate', 'x');

            expect(caught).toBe(failure);
            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update task content'
            );
        });
    });

    describe('project', () => {
        it('selects a project through replace-at-index', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskProjectCard', 'onProjectSelect', {
                id: 4,
                name: 'P',
            });

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                project_id: 4,
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Project updated successfully'
            );
        });

        it('shows an error toast when selection fails', async () => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));

            await callProp('TaskProjectCard', 'onProjectSelect', {
                id: 4,
                name: 'P',
            });

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update project'
            );
        });

        it('clears the project', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskProjectCard', 'onProjectClear');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                project_id: null,
            });
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Project cleared successfully'
            );
        });

        it('creates a project inline and assigns it', async () => {
            const created = { id: 8, name: 'Fresh' };
            mocked.createProject.mockResolvedValue(created);
            await renderPage();
            clearCalls();

            await callProp('TaskProjectCard', 'onProjectCreate', 'Fresh');

            expect(mocked.createProject).toHaveBeenCalledWith({
                name: 'Fresh',
            });
            expect(useStore.getState().projectsStore.projects).toEqual([
                created,
            ]);
            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                project_id: 8,
            });
            expect(setTasksSpy).toHaveBeenCalled();
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Project created and assigned'
            );
        });

        it('rethrows a failed inline create (I5)', async () => {
            const failure = new Error('nope');
            mocked.createProject.mockRejectedValue(failure);
            await renderPage();

            const caught = await rejectProp(
                'TaskProjectCard',
                'onProjectCreate',
                'Fresh'
            );

            expect(caught).toBe(failure);
            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to create project'
            );
        });
    });

    describe('area', () => {
        it('selects an area through updateTaskInStore', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskAreaCard', 'onAreaSelect', {
                id: 6,
                name: 'Home',
            });

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                area_id: 6,
            });
            expect(updateTaskInStoreSpy).toHaveBeenCalled();
            expect(setTasksSpy).not.toHaveBeenCalled();
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Area updated successfully'
            );
        });

        it('clears the area', async () => {
            await renderPage();
            clearCalls();

            await callProp('TaskAreaCard', 'onAreaClear');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                area_id: null,
            });
            expect(updateTaskInStoreSpy).toHaveBeenCalled();
        });

        it('shows an error toast when selection fails', async () => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));

            await callProp('TaskAreaCard', 'onAreaSelect', {
                id: 6,
                name: 'Home',
            });

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update area'
            );
        });

        it('builds area links', async () => {
            await renderPage();
            const { getAreaLink } = cardProps.TaskAreaCard;

            expect(getAreaLink({ uid: 'a1', name: 'Work Stuff' })).toBe(
                '/area/a1-work-stuff'
            );
            expect(getAreaLink({ id: 2, name: 'x' })).toBe('/area/2');
        });
    });

    describe('due date', () => {
        const editDueDate = async (value: string) => {
            await callProp('TaskDueDateCard', 'onStartEdit');
            await callProp('TaskDueDateCard', 'onChangeDate', value);
            await callProp('TaskDueDateCard', 'onSave');
        };

        it('rejects a due date before the defer-until day', async () => {
            seedStore([makeTask({ defer_until: '2030-01-10T10:00:00Z' })]);
            await renderPage();

            await editDueDate('2030-01-09');

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Due date cannot be before the defer until date'
            );
            expect(mocked.updateTask).not.toHaveBeenCalled();
        });

        it('allows a due date on the defer-until day', async () => {
            seedStore([makeTask({ defer_until: '2030-01-10T10:00:00Z' })]);
            await renderPage();

            await editDueDate('2030-01-10');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                due_date: '2030-01-10',
            });
            expect(cardProps.TaskDueDateCard.isEditing).toBe(false);
        });

        it('warns about a past date but still saves', async () => {
            await renderPage();

            await editDueDate('2000-01-01');

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Warning: You are setting a due date in the past'
            );
            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                due_date: '2000-01-01',
            });
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Due date updated successfully'
            );
        });

        it('re-syncs the draft when the task due date changes', async () => {
            await renderPage();

            await patchStoreTask({ due_date: '2031-05-05' });

            expect(cardProps.TaskDueDateCard.editedDueDate).toBe('2031-05-05');
        });

        it('resets the draft when the save fails', async () => {
            seedStore([makeTask({ due_date: '2030-01-01' })]);
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('nope'));

            await editDueDate('2030-02-02');

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Failed to update due date'
            );
            expect(cardProps.TaskDueDateCard.editedDueDate).toBe('2030-01-01');
            expect(cardProps.TaskDueDateCard.isEditing).toBe(false);
        });
    });

    describe('defer until', () => {
        const editDeferUntil = async (value: string) => {
            await callProp('TaskDeferUntilCard', 'onStartEdit');
            await callProp('TaskDeferUntilCard', 'onChangeDateTime', value);
            await callProp('TaskDeferUntilCard', 'onSave');
        };

        it('rejects a defer date after the due date', async () => {
            seedStore([makeTask({ due_date: '2030-01-10' })]);
            await renderPage();

            await editDeferUntil('2030-01-11T09:00');

            expect(toast.showErrorToast).toHaveBeenCalledWith(
                'Defer until date cannot be after the due date'
            );
            expect(mocked.updateTask).not.toHaveBeenCalled();
        });

        it('skips the check for recurring instances', async () => {
            seedStore([
                makeTask({ due_date: '2030-01-10', recurring_parent_id: 5 }),
            ]);
            await renderPage();

            await editDeferUntil('2030-01-11T09:00');

            expect(mocked.updateTask).toHaveBeenCalledWith('task-1', {
                defer_until: '2030-01-11T09:00',
            });
            expect(toast.showSuccessToast).toHaveBeenCalledWith(
                'Defer until successfully updated'
            );
        });

        it('prefers the error message in the failure toast', async () => {
            await renderPage();
            mocked.updateTask.mockRejectedValue(new Error('Server said no'));

            await editDeferUntil('2030-01-11T09:00');

            expect(toast.showErrorToast).toHaveBeenCalledWith('Server said no');
            expect(cardProps.TaskDeferUntilCard.isEditing).toBe(false);
        });

        it('does not re-sync the draft when the task changes', async () => {
            await renderPage();

            await patchStoreTask({ defer_until: '2031-05-05T10:00' });

            expect(cardProps.TaskDeferUntilCard.editedDeferUntil).toBe('');
        });
    });

    it('does not bump the timeline before any mutation (P6)', async () => {
        await renderPage();

        expect(await timelineKey()).toBe(0);
        await waitFor(() =>
            expect(cardProps.TaskContentCard.content).toBe('Original note')
        );
    });
});
