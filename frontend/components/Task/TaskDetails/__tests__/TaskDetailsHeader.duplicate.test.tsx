import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TaskDetailsHeader from '../TaskDetailsHeader';
import { Task } from '../../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback || _key,
    }),
}));

jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en', t: (k: string) => k },
}));

jest.mock('../../../../utils/dateUtils', () => ({
    formatDateTime: () => 'Oct 19, 2026',
}));

jest.mock('../../../Shared/BackButton', () => {
    return function MockBackButton() {
        return <button type="button">Back</button>;
    };
});

jest.mock('../../TaskStatusControl', () => {
    return function MockTaskStatusControl() {
        return <div data-testid="status-control" />;
    };
});

const baseTask: Task = {
    id: 1,
    uid: 'taskuid1234567',
    user_uid: 'owner-uid',
    name: 'Test Task',
    status: 'not_started',
    priority: 'medium',
    completed_at: null,
};

const renderHeader = (
    props: Partial<React.ComponentProps<typeof TaskDetailsHeader>> = {}
) => {
    return render(
        <MemoryRouter>
            <TaskDetailsHeader
                task={baseTask}
                onTitleUpdate={jest.fn()}
                onStatusUpdate={jest.fn()}
                onPriorityUpdate={jest.fn()}
                onDelete={jest.fn()}
                activePill="details"
                onPillChange={jest.fn()}
                onQuickStatusToggle={jest.fn()}
                canDuplicate={true}
                onDuplicate={jest.fn()}
                {...props}
            />
        </MemoryRouter>
    );
};

describe('TaskDetailsHeader duplicate action', () => {
    it('shows Duplicate in More actions when canDuplicate is true', () => {
        const onDuplicate = jest.fn();
        renderHeader({ onDuplicate, canDuplicate: true });

        fireEvent.click(
            screen.getByRole('button', { name: 'More actions' })
        );

        expect(
            screen.getByRole('button', { name: 'Duplicate' })
        ).toBeInTheDocument();
    });

    it('does not show Duplicate when canDuplicate is false', () => {
        renderHeader({ canDuplicate: false });

        fireEvent.click(
            screen.getByRole('button', { name: 'More actions' })
        );

        expect(
            screen.queryByRole('button', { name: 'Duplicate' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Delete' })
        ).toBeInTheDocument();
    });

    it('calls onDuplicate when Duplicate is clicked', () => {
        const onDuplicate = jest.fn();
        renderHeader({ onDuplicate, canDuplicate: true });

        fireEvent.click(
            screen.getByRole('button', { name: 'More actions' })
        );
        fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

        expect(onDuplicate).toHaveBeenCalledTimes(1);
    });
});
