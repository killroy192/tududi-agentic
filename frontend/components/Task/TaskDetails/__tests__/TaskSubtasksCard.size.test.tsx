import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskSubtasksCard from '../TaskSubtasksCard';
import { Task } from '../../../../entities/Task';
import { persistTaskSize } from '../../../../utils/taskSize';
import { useStore } from '../../../../store/useStore';
import { ToastProvider } from '../../../Shared/ToastContext';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../../../../utils/taskSize', () => {
    const actual = jest.requireActual('../../../../utils/taskSize');
    return {
        ...actual,
        persistTaskSize: jest.fn(),
    };
});

const persistTaskSizeMock = persistTaskSize as jest.MockedFunction<
    typeof persistTaskSize
>;

const parent: Task = {
    id: 1,
    uid: 'parent-1',
    name: 'Parent',
    status: 'not_started',
    completed_at: null,
    user_uid: 'owner-1',
};

const savedChild: Task = {
    id: 2,
    uid: 'child-1',
    name: 'Existing step',
    status: 'not_started',
    completed_at: null,
    size: null,
    user_uid: 'owner-1',
};

const Harness = ({ initial }: { initial: Task[] }) => {
    const [subtasks, setSubtasks] = useState(initial);
    return (
        <ToastProvider>
            <TaskSubtasksCard
                task={parent}
                subtasks={subtasks}
                onSubtasksChange={setSubtasks}
                onSave={jest.fn()}
            />
        </ToastProvider>
    );
};

describe('task details subtasks size', () => {
    beforeEach(() => {
        localStorage.setItem(
            'currentUser',
            JSON.stringify({ uid: 'owner-1' })
        );
        useStore.getState().tasksStore.setTasks([]);
        persistTaskSizeMock.mockReset();
    });

    it('shows a size control on an existing subtask and not on the new-subtask field', () => {
        render(<Harness initial={[savedChild]} />);

        expect(screen.getByRole('button', { name: 'Size' })).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText('Add a subtask...').closest('div')
        ).not.toContainElement(screen.queryByRole('button', { name: 'Size' }));
    });

    it('hides the control on a subtask that has not been saved', () => {
        render(
            <Harness
                initial={[
                    {
                        name: 'Draft step',
                        status: 'not_started',
                        completed_at: null,
                    },
                ]}
            />
        );

        expect(screen.queryByRole('button', { name: 'Size' })).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Add a subtask...')).toBeInTheDocument();
    });

    it('saves that subtask size and shows one success toast', async () => {
        persistTaskSizeMock.mockResolvedValue('S');
        render(<Harness initial={[savedChild]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Size' }));
        fireEvent.click(screen.getByTestId('size-option-S'));

        await waitFor(() => {
            expect(persistTaskSizeMock).toHaveBeenCalledWith('child-1', 'S');
        });
        expect(screen.getAllByText('Size updated successfully')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Size' })).toHaveTextContent('S');
        expect(useStore.getState().tasksStore.tasks).toEqual([]);
    });
});
