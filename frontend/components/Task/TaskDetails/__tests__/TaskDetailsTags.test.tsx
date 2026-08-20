import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TaskDetailsTags from '../TaskDetailsTags';
import { Task } from '../../../../entities/Task';
import { StoreState } from '../../../../store/useStore';
import { updateTask, fetchTaskByUid } from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));

jest.mock('../../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
    fetchTaskByUid: jest.fn(),
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

// Simplify TagInput to a controllable stub so the save flow can be driven
// deterministically without depending on its internal keyboard interactions.
jest.mock('../../../Tag/TagInput', () => {
    return function MockTagInput(props: {
        initialTags: string[];
        onTagsChange: (tags: string[]) => void;
    }) {
        return (
            <button
                onClick={() => props.onTagsChange([...props.initialTags, 'urgent'])}
            >
                add-urgent-tag
            </button>
        );
    };
});

const buildTask = (): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'A task',
    status: 'not_started',
    completed_at: null,
    tags: [],
});

function buildTagsStore(overrides: Partial<StoreState['tagsStore']> = {}) {
    return {
        tags: [],
        isLoading: false,
        isError: false,
        hasLoaded: false,
        setTags: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        loadTags: jest.fn(),
        getTags: jest.fn(),
        refreshTags: jest.fn(),
        addNewTags: jest.fn(),
        ...overrides,
    } as StoreState['tagsStore'];
}

function buildTasksStore(task: Task): StoreState['tasksStore'] {
    return {
        tasks: [task],
        isLoading: false,
        isError: false,
        setTasks: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        loadTasks: jest.fn(),
        createTask: jest.fn(),
        updateTask: jest.fn(),
        deleteTask: jest.fn(),
        toggleTaskCompletion: jest.fn(),
        loadTaskById: jest.fn(),
        loadTaskByUid: jest.fn(),
        loadSubtasks: jest.fn(),
        addTask: jest.fn(),
        removeTask: jest.fn(),
        updateTaskInStore: jest.fn(),
    };
}

// TaskDetailsTags renders a react-router <Link> for "go to tag", so every
// render needs a router context.
function renderWithRouter(ui: React.ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('TaskDetailsTags', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('preloads available tags on mount when the tags store is empty', () => {
        const task = buildTask();
        const tagsStore = buildTagsStore();

        renderWithRouter(
            <TaskDetailsTags
                task={task}
                tagsStore={tagsStore}
                tasksStore={buildTasksStore(task)}
                onTaskModified={jest.fn()}
                onTimelineRefresh={jest.fn()}
            />
        );

        expect(tagsStore.loadTags).toHaveBeenCalledTimes(1);
    });

    it('does not reload tags when they are already loaded', () => {
        const task = buildTask();
        const tagsStore = buildTagsStore({ hasLoaded: true });

        renderWithRouter(
            <TaskDetailsTags
                task={task}
                tagsStore={tagsStore}
                tasksStore={buildTasksStore(task)}
                onTaskModified={jest.fn()}
                onTimelineRefresh={jest.fn()}
            />
        );

        expect(tagsStore.loadTags).not.toHaveBeenCalled();
    });

    it('shows the empty state and opens the editor on click', () => {
        const task = buildTask();

        renderWithRouter(
            <TaskDetailsTags
                task={task}
                tagsStore={buildTagsStore({ hasLoaded: true })}
                tasksStore={buildTasksStore(task)}
                onTaskModified={jest.fn()}
                onTimelineRefresh={jest.fn()}
            />
        );

        expect(screen.getByText('Add tags')).toBeInTheDocument();
    });

    it('saves updated tags via updateTask and refreshes the timeline', async () => {
        const task: Task = { ...buildTask(), tags: [{ id: 1, name: 'work' }] };
        const updatedTask = {
            ...task,
            tags: [
                { id: 1, name: 'work' },
                { id: 2, name: 'urgent' },
            ],
        };
        (updateTask as jest.Mock).mockResolvedValue(updatedTask);
        (fetchTaskByUid as jest.Mock).mockResolvedValue(updatedTask);
        const onTaskModified = jest.fn();
        const onTimelineRefresh = jest.fn();
        const tasksStore = buildTasksStore(task);

        renderWithRouter(
            <TaskDetailsTags
                task={task}
                tagsStore={buildTagsStore({ hasLoaded: true })}
                tasksStore={tasksStore}
                onTaskModified={onTaskModified}
                onTimelineRefresh={onTimelineRefresh}
            />
        );

        fireEvent.click(screen.getByText('work'));
        fireEvent.click(screen.getByText('add-urgent-tag'));
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() =>
            expect(updateTask).toHaveBeenCalledWith('task-1', {
                tags: [{ name: 'work' }, { name: 'urgent' }],
            })
        );
        expect(onTaskModified).toHaveBeenCalled();
        expect(tasksStore.setTasks).toHaveBeenCalledWith([
            {
                ...updatedTask,
                subtasks: task.subtasks || [],
            },
        ]);
        expect(onTimelineRefresh).toHaveBeenCalled();
    });
});
