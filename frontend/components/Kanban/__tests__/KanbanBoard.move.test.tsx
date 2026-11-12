import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import KanbanBoard from '../KanbanBoard';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../../Task/TaskItem', () => ({
    __esModule: true,
    default: ({ task }: { task: { name: string } }) => <div>{task.name}</div>,
}));

jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('csrf-token'),
}));

const task: Task = {
    id: 1,
    uid: 'task-1',
    name: 'Move me',
    status: 0,
    priority: 0,
    size: 'S',
    access_level: 'rw',
    completed_at: null,
};

const dataTransfer = () => ({
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: jest.fn(),
    getData: jest.fn(() => '1'),
});

describe('Kanban move after a size change', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        localStorage.clear();
        fetchMock.mockReset();
        fetchMock.mockImplementation(
            async (_input: RequestInfo | URL, init?: RequestInit) => {
                if (init?.method === 'PATCH') {
                    return {
                        ok: true,
                        json: async () => ({ ...task, status: 1, size: 'L' }),
                    };
                }
                return {
                    ok: true,
                    json: async () => ({ tasks: [task] }),
                };
            }
        );
        global.fetch = fetchMock as unknown as typeof fetch;
        useStore.setState({
            tasksStore: {
                ...useStore.getState().tasksStore,
                tasks: [],
                lastSizeUpdate: null,
            },
        });
    });

    it('does not send size in the column-move PATCH body', async () => {
        render(<KanbanBoard />);
        expect(await screen.findByText('Move me')).toBeInTheDocument();

        await act(async () => {
            useStore.getState().tasksStore.publishTaskSize('task-1', 'L');
        });

        const transfer = dataTransfer();
        const card = screen.getByText('Move me').parentElement as HTMLElement;
        fireEvent.dragStart(card, { dataTransfer: transfer });

        const column = screen.getByText('In Progress').parentElement
            ?.parentElement as HTMLElement;
        fireEvent.drop(column, { dataTransfer: transfer });

        await waitFor(() => {
            const patch = fetchMock.mock.calls.find(
                (call) => call[1]?.method === 'PATCH'
            );
            expect(patch).toBeTruthy();
        });

        const patch = fetchMock.mock.calls.find(
            (call) => call[1]?.method === 'PATCH'
        );
        const body = JSON.parse(String(patch?.[1].body));
        expect(body).not.toHaveProperty('size');
        expect(body).not.toHaveProperty('access_level');
        expect(body.status).toBe(1);
        expect(body.uid).toBe('task-1');
        expect(body.name).toBe('Move me');
    });
});
