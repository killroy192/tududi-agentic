import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskSizeControl from '../TaskSizeControl';
import { Task } from '../../../entities/Task';
import { updateTask } from '../../../utils/tasksService';
import { useStore } from '../../../store/useStore';

const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: mockShowSuccessToast,
        showErrorToast: mockShowErrorToast,
    }),
}));

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
}));

jest.mock('../../../utils/userUtils', () => ({
    getCurrentUser: () => ({ uid: 'user-1' }),
}));

jest.mock('../../../store/useStore', () => {
    const state = {
        tasksStore: {
            sizesByUid: {} as Record<string, 'S' | 'M' | 'L' | 'XL' | null>,
            applyTaskSize: jest.fn(),
        },
    };
    const useStore = (selector: (value: typeof state) => unknown) =>
        selector(state);
    (useStore as unknown as { getState: () => typeof state }).getState = () =>
        state;
    return { useStore };
});

const task: Task = {
    uid: 'task-1',
    name: 'Write the spec',
    status: 'not_started',
    completed_at: null,
    size: 'S',
    user_uid: 'user-1',
};

describe('TaskSizeControl', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows one success toast and sends only the size', async () => {
        (updateTask as jest.Mock).mockResolvedValue({
            uid: 'task-1',
            name: 'Daily',
            original_name: 'Write the spec',
            size: 'M',
            due_date: '2026-04-01',
        });

        render(<TaskSizeControl task={task} />);

        fireEvent.click(screen.getByTestId('size-dropdown'));
        fireEvent.click(screen.getByTestId('size-option-M'));

        await waitFor(() => {
            expect(mockShowSuccessToast).toHaveBeenCalledTimes(1);
        });
        expect(mockShowSuccessToast).toHaveBeenCalledWith(
            'Size updated successfully'
        );
        expect(mockShowErrorToast).not.toHaveBeenCalled();
        expect(updateTask).toHaveBeenCalledTimes(1);
        expect(updateTask).toHaveBeenCalledWith('task-1', { size: 'M' });
        expect(
            useStore.getState().tasksStore.applyTaskSize
        ).toHaveBeenCalledWith('task-1', 'M');
    });

    it('keeps the previous label and shows only the failure toast', async () => {
        (updateTask as jest.Mock).mockRejectedValue(new Error('network'));

        render(<TaskSizeControl task={task} />);

        fireEvent.click(screen.getByTestId('size-dropdown'));
        fireEvent.click(screen.getByTestId('size-option-M'));

        await waitFor(() => {
            expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
        });
        expect(mockShowErrorToast).toHaveBeenCalledWith(
            'Failed to update size'
        );
        expect(mockShowSuccessToast).not.toHaveBeenCalled();
        expect(screen.getByTestId('size-dropdown')).toHaveTextContent('S');
        expect(
            useStore.getState().tasksStore.applyTaskSize
        ).not.toHaveBeenCalled();
    });
});
