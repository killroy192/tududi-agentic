import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TaskHeader from '../TaskHeader';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en', t: (key: string) => key },
}));

const baseTask: Task = {
    id: 1,
    uid: 'task-uid-1',
    name: 'Sample task',
    status: 'not_started',
    completed_at: null,
};

const renderTaskHeader = (
    overrides: Partial<Task> = {},
    props: Partial<React.ComponentProps<typeof TaskHeader>> = {}
) => {
    const task = { ...baseTask, ...overrides };
    return render(
        <MemoryRouter>
            <TaskHeader
                task={task}
                onTaskClick={jest.fn()}
                onToggleCompletion={jest.fn()}
                onDuplicate={jest.fn()}
                {...props}
            />
        </MemoryRouter>
    );
};

describe('TaskHeader - duplicate button (AC-3)', () => {
    it('does not render the duplicate button for habit tasks', () => {
        renderTaskHeader({ habit_mode: true });

        expect(screen.queryAllByTitle('Duplicate task')).toHaveLength(0);
    });

    it('renders the duplicate button when onDuplicate is provided and the task is not a habit', () => {
        renderTaskHeader({ habit_mode: false });

        expect(
            screen.getAllByTitle('Duplicate task').length
        ).toBeGreaterThan(0);
    });

    it('does not render the duplicate button when onDuplicate is not provided', () => {
        renderTaskHeader({ habit_mode: false }, { onDuplicate: undefined });

        expect(screen.queryAllByTitle('Duplicate task')).toHaveLength(0);
    });

    it('renders the duplicate button on Kanban cards even when hideStatusControl is true (F2)', () => {
        renderTaskHeader(
            { habit_mode: false },
            { hideStatusControl: true, isKanbanView: true }
        );

        // The desktop row (hidden md:flex) still renders the duplicate
        // button in the DOM even when hideStatusControl hides the status
        // control, since the two are now independently gated.
        expect(
            screen.getAllByTitle('Duplicate task').length
        ).toBeGreaterThan(0);
    });

    it('disables the duplicate button(s) while isDuplicating is true', () => {
        renderTaskHeader({ habit_mode: false }, { isDuplicating: true });

        const buttons = screen.getAllByTitle('Duplicate task');
        buttons.forEach((button) => expect(button).toBeDisabled());
    });
});
