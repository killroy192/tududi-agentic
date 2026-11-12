import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Task } from '../../../entities/Task';
import { useStore } from '../../../store/useStore';
import EisenhowerMatrix from '../EisenhowerMatrix';

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
    id: 7,
    uid: 'task-7',
    name: 'Sort me',
    status: 0,
    priority: 0,
    size: 'S',
    access_level: 'rw',
    tags: [],
    completed_at: null,
};

const dataTransfer = () => ({
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: jest.fn(),
    getData: jest.fn(() => '7'),
});

describe('Eisenhower move after a size change', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockImplementation(
            async (_input: RequestInfo | URL, init?: RequestInit) => {
                if (init?.method === 'PATCH') {
                    return {
                        ok: true,
                        json: async () => ({ ...task, priority: 1, size: 'L' }),
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

    it('does not send size in the quadrant-move PATCH body', async () => {
        render(<EisenhowerMatrix />);
        expect(await screen.findByText('Sort me')).toBeInTheDocument();

        await act(async () => {
            useStore.getState().tasksStore.publishTaskSize('task-7', 'L');
        });

        const transfer = dataTransfer();
        const card = screen.getByText('Sort me').parentElement as HTMLElement;
        fireEvent.dragStart(card, { dataTransfer: transfer });

        const cell = screen.getByText('Do Now').parentElement?.parentElement
            ?.parentElement as HTMLElement;
        fireEvent.drop(cell, { dataTransfer: transfer });

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
        expect(body.priority).toBe(1);
        expect(body.tags).toEqual([{ name: 'urgent' }]);
        expect(body.uid).toBe('task-7');
    });
});
