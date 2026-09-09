import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskSizeControl from '../TaskSizeControl';
import {
    normalizeSize,
    sizeToApiValue,
    sizesEqual,
} from '../../../constants/taskSize';
import { updateTask } from '../../../utils/tasksService';

jest.mock('../../../utils/tasksService', () => ({
    updateTask: jest.fn(),
}));

jest.mock('../ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
    }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback || _key,
    }),
}));

const mockedUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;

describe('taskSize helpers', () => {
    it('normalizes integers and letters, treating out-of-set as unset', () => {
        expect(normalizeSize(1)).toBe('S');
        expect(normalizeSize('XL')).toBe('XL');
        expect(normalizeSize(0)).toBeNull();
        expect(normalizeSize(99)).toBeNull();
        expect(normalizeSize('foo')).toBeNull();
    });

    it('maps sizes to API integers without using zero', () => {
        expect(sizeToApiValue('S')).toBe(1);
        expect(sizeToApiValue(null)).toBeNull();
        expect(sizesEqual('M', 2)).toBe(true);
        expect(sizesEqual('L', 'XL')).toBe(false);
    });
});

describe('TaskSizeControl', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders unset placeholder and options including None', () => {
        render(<TaskSizeControl value={null} taskUid="abc" variant="chip" />);
        const trigger = screen.getByRole('button', { name: 'Size' });
        expect(trigger).toHaveTextContent('Size');
        fireEvent.click(trigger);
        expect(screen.getByRole('option', { name: /None/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /^S$/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /^XL$/ })).toBeInTheDocument();
    });

    it('optimistically shows the new value and sends only size', async () => {
        let resolvePatch;
        mockedUpdateTask.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvePatch = resolve;
                })
        );

        render(<TaskSizeControl value={null} taskUid="abc" variant="chip" />);
        fireEvent.click(screen.getByRole('button', { name: 'Size' }));
        fireEvent.click(screen.getByRole('option', { name: /^L$/ }));

        expect(screen.getByRole('button', { name: 'Size' })).toHaveTextContent(
            'L'
        );
        expect(mockedUpdateTask).toHaveBeenCalledWith('abc', { size: 3 });

        resolvePatch({});
        await waitFor(() => expect(mockedUpdateTask).toHaveBeenCalledTimes(1));
    });

    it('does not send a request when re-selecting the current size', () => {
        render(<TaskSizeControl value={2} taskUid="abc" variant="chip" />);
        fireEvent.click(screen.getByRole('button', { name: 'Size' }));
        fireEvent.click(screen.getByRole('option', { name: /^M$/ }));
        expect(mockedUpdateTask).not.toHaveBeenCalled();
    });

    it('keeps the last selection when responses arrive out of order', async () => {
        const resolvers: Array<(value: unknown) => void> = [];
        mockedUpdateTask.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolvers.push(resolve);
                })
        );

        render(<TaskSizeControl value={null} taskUid="abc" variant="chip" />);
        const openAndPick = (letter: string) => {
            fireEvent.click(screen.getByRole('button', { name: 'Size' }));
            fireEvent.click(
                screen.getByRole('option', { name: new RegExp(`^${letter}$`) })
            );
        };

        openAndPick('S');
        openAndPick('XL');
        expect(screen.getByRole('button', { name: 'Size' })).toHaveTextContent(
            'XL'
        );

        resolvers[1]({});
        resolvers[0]({});
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: 'Size' })
            ).toHaveTextContent('XL')
        );
    });
});
