import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskDetailsHeader from '../TaskDetailsHeader';
import { Task } from '../../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

const task: Task = {
    id: 1,
    uid: 'task-1',
    name: 'Write the note',
    status: 'not_started',
    priority: 'low',
    completed_at: null,
    size: null,
    user_uid: 'owner-1',
};

const renderHeader = (
    overrides: Partial<React.ComponentProps<typeof TaskDetailsHeader>> = {}
) =>
    render(
        <MemoryRouter>
            <TaskDetailsHeader
                task={task}
                onTitleUpdate={jest.fn().mockResolvedValue(undefined)}
                onStatusUpdate={jest.fn().mockResolvedValue(undefined)}
                onPriorityUpdate={jest.fn().mockResolvedValue(undefined)}
                onSizeUpdate={jest.fn().mockResolvedValue(undefined)}
                canEditSize
                onDelete={jest.fn()}
                activePill="overview"
                onPillChange={jest.fn()}
                {...overrides}
            />
        </MemoryRouter>
    );

describe('TaskDetailsHeader size', () => {
    it('shows Unset and lists the size choices for the owner', () => {
        renderHeader();

        const buttons = screen.getAllByRole('button', { name: 'Size' });
        expect(buttons[0]).toHaveTextContent('Unset');

        fireEvent.click(buttons[0]);

        expect(
            screen.getAllByRole('option').map((option) => option.textContent)
        ).toEqual(['Unset', 'S', 'M', 'L', 'XL']);
    });

    it('reports the selected size', () => {
        const onSizeUpdate = jest.fn().mockResolvedValue(undefined);
        renderHeader({ onSizeUpdate, task: { ...task, size: 'S' } });

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);
        fireEvent.click(screen.getByTestId('size-option-L'));

        expect(onSizeUpdate).toHaveBeenCalledWith('L');
    });

    it('does not open the menu when the viewer cannot edit size', () => {
        const onSizeUpdate = jest.fn();
        renderHeader({
            canEditSize: false,
            onSizeUpdate,
            task: { ...task, size: 'XL' },
        });

        fireEvent.click(screen.getAllByRole('button', { name: 'Size' })[0]);

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(onSizeUpdate).not.toHaveBeenCalled();
        expect(screen.getAllByRole('button', { name: 'Size' })[0]).toHaveTextContent(
            'XL'
        );
    });
});
