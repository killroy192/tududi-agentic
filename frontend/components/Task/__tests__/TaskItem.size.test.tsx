import React from 'react';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TaskItem from '../TaskItem';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback,
    }),
}));

// dateUtils (via TaskHeader) pulls in the app i18n bootstrap; stub it out.
jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: {
        language: 'en',
        t: (key: string) => key,
    },
}));

const navigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => navigate,
}));

const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast,
        showSuccessToast: jest.fn(),
        showUndoToast: jest.fn(),
    }),
}));

const updateTask = jest.fn();
jest.mock('../../../utils/tasksService', () => ({
    updateTask: (...args: unknown[]) => updateTask(...args),
    toggleTaskCompletion: jest.fn(),
    fetchSubtasks: jest.fn().mockResolvedValue([]),
}));

const updateTaskInStore = jest.fn();
jest.mock('../../../store/useStore', () => ({
    useStore: {
        getState: () => ({ tasksStore: { updateTaskInStore } }),
    },
}));

const baseTask: Task = {
    id: 42,
    uid: 'task-42',
    name: 'Write the report',
    status: 'not_started',
    priority: 'medium',
    size: 'M',
    can_edit: true,
} as Task;

const renderItem = (
    task: Task,
    props: Partial<React.ComponentProps<typeof TaskItem>> = {}
) =>
    render(
        <MemoryRouter>
            <TaskItem
                task={task}
                onTaskUpdate={jest.fn().mockResolvedValue(undefined)}
                onTaskDelete={jest.fn()}
                projects={[]}
                {...props}
            />
        </MemoryRouter>
    );

// The header renders desktop and mobile variants; pick the desktop one.
const getDesktopSizeTrigger = () =>
    screen.getAllByRole('button', { name: /^Size: / })[0];

describe('TaskItem size', () => {
    beforeEach(() => {
        updateTask.mockReset();
        updateTaskInStore.mockReset();
        showErrorToast.mockReset();
        navigate.mockReset();
    });

    it('shows a display-only badge when the row is not size-editable', () => {
        renderItem(baseTask);

        expect(screen.getAllByTestId('size-badge')[0]).toHaveTextContent('M');
        expect(
            screen.queryByRole('button', { name: /^Size: / })
        ).not.toBeInTheDocument();
    });

    it('renders no badge when the size is unset and not editable', () => {
        renderItem({ ...baseTask, size: null });

        expect(screen.queryByTestId('size-badge')).not.toBeInTheDocument();
    });

    it('shows a dropdown when size-editable and the user may edit', () => {
        renderItem(baseTask, { isSizeEditable: true });

        expect(getDesktopSizeTrigger()).toHaveAttribute(
            'aria-haspopup',
            'listbox'
        );
        expect(screen.queryByTestId('size-badge')).not.toBeInTheDocument();
    });

    it('falls back to a badge for read-only shares', () => {
        renderItem({ ...baseTask, can_edit: false }, { isSizeEditable: true });

        expect(screen.getAllByTestId('size-badge')[0]).toHaveTextContent('M');
        expect(
            screen.queryByRole('button', { name: /^Size: / })
        ).not.toBeInTheDocument();
    });

    it('falls back to a badge for virtual upcoming occurrences', () => {
        renderItem(
            { ...baseTask, is_virtual_occurrence: true, size: null },
            { isSizeEditable: true }
        );

        expect(
            screen.queryByRole('button', { name: /^Size: / })
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId('size-badge')).not.toBeInTheDocument();
    });

    it('saves immediately and syncs the store and host list', async () => {
        const onTaskCompletionToggle = jest.fn();
        updateTask.mockResolvedValue({ ...baseTask, size: 'XL' });

        renderItem(baseTask, { isSizeEditable: true, onTaskCompletionToggle });

        fireEvent.click(getDesktopSizeTrigger());
        const listbox = screen.getByRole('listbox');
        fireEvent.click(within(listbox).getByTestId('size-option-xl'));

        expect(updateTask).toHaveBeenCalledWith('task-42', { size: 'XL' });

        await waitFor(() =>
            expect(updateTaskInStore).toHaveBeenCalledWith(
                expect.objectContaining({ id: 42, size: 'XL' })
            )
        );
        expect(onTaskCompletionToggle).toHaveBeenCalledWith(
            expect.objectContaining({ id: 42, size: 'XL' })
        );
        expect(getDesktopSizeTrigger()).toHaveAccessibleName('Size: XL');
        expect(showErrorToast).not.toHaveBeenCalled();
    });

    it('reverts and shows an error toast when the save fails', async () => {
        updateTask.mockRejectedValue(new Error('403'));

        renderItem(baseTask, { isSizeEditable: true });

        fireEvent.click(getDesktopSizeTrigger());
        fireEvent.click(
            within(screen.getByRole('listbox')).getByTestId('size-option-s')
        );

        // Optimistic value while the request is in flight.
        expect(getDesktopSizeTrigger()).toHaveAccessibleName('Size: S');

        await waitFor(() =>
            expect(showErrorToast).toHaveBeenCalledWith('Failed to update size')
        );
        expect(getDesktopSizeTrigger()).toHaveAccessibleName('Size: M');
        expect(updateTaskInStore).not.toHaveBeenCalled();
    });

    it('does not open the task when the size control is used', async () => {
        updateTask.mockResolvedValue({ ...baseTask, size: 'L' });
        renderItem(baseTask, { isSizeEditable: true });

        fireEvent.click(getDesktopSizeTrigger());
        fireEvent.click(
            within(screen.getByRole('listbox')).getByTestId('size-option-l')
        );
        await waitFor(() => expect(updateTaskInStore).toHaveBeenCalled());

        expect(navigate).not.toHaveBeenCalled();

        // Sanity check: the row itself still navigates.
        fireEvent.click(screen.getAllByText('Write the report')[0]);
        expect(navigate).toHaveBeenCalledWith(
            '/task/task-42',
            expect.anything()
        );
    });
});
