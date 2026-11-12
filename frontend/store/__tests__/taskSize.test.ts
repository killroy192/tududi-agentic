import { renderHook, act } from '@testing-library/react';
import { Task } from '../../entities/Task';
import { useTaskSizeSync } from '../../hooks/useTaskSizeSync';
import { useStore } from '../useStore';
import { applyTaskSizeUpdate } from '../../utils/taskSize';

const buildTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-1',
    name: 'Sized task',
    status: 'not_started',
    completed_at: null,
    size: null,
    ...overrides,
});

describe('publishTaskSize', () => {
    beforeEach(() => {
        const nested = buildTask({
            id: 11,
            name: 'Nested same uid',
            size: null,
        });
        useStore.setState((state) => ({
            tasksStore: {
                ...state.tasksStore,
                lastSizeUpdate: null,
                tasks: [
                    buildTask({
                        name: 'Section A',
                        subtasks: [
                            nested,
                            buildTask({
                                id: 12,
                                uid: 'other-child',
                                name: 'Other child',
                                size: 'M',
                            }),
                        ],
                    }),
                    buildTask({ id: 2, name: 'Section B', size: 'L' }),
                    buildTask({
                        id: 3,
                        name: 'Virtual',
                        size: 'XL',
                        is_virtual_occurrence: true,
                    }),
                ],
            },
        }));
    });

    it('updates lastSizeUpdate with an incrementing seq and patches every matching task', () => {
        const { publishTaskSize } = useStore.getState().tasksStore;

        publishTaskSize('task-1', 'S');

        const afterFirst = useStore.getState().tasksStore;
        expect(afterFirst.lastSizeUpdate).toEqual({
            uid: 'task-1',
            size: 'S',
            seq: 1,
        });
        expect(afterFirst.tasks[0].size).toBe('S');
        expect(afterFirst.tasks[0].subtasks?.[0].size).toBe('S');
        expect(afterFirst.tasks[0].subtasks?.[1].size).toBe('M');
        expect(afterFirst.tasks[1].size).toBe('S');
        expect(afterFirst.tasks[2].size).toBe('XL');
        expect(afterFirst.tasks[2].is_virtual_occurrence).toBe(true);

        publishTaskSize('task-1', null);

        const afterSecond = useStore.getState().tasksStore;
        expect(afterSecond.lastSizeUpdate).toEqual({
            uid: 'task-1',
            size: null,
            seq: 2,
        });
        expect(afterSecond.tasks[0].size).toBeNull();
        expect(afterSecond.tasks[1].size).toBeNull();
        expect(afterSecond.tasks[2].size).toBe('XL');
    });
});

describe('applyTaskSizeUpdate', () => {
    it('updates the same uid in two sections and nested subtasks, and leaves virtual rows', () => {
        const sibling = buildTask({
            id: 12,
            uid: 'other-child',
            name: 'Other child',
            size: 'M',
        });
        const sectionA: Task[] = [
            buildTask({
                name: 'Section A',
                size: null,
                subtasks: [
                    buildTask({ id: 11, name: 'Nested same uid', size: 'L' }),
                    sibling,
                ],
            }),
            buildTask({
                id: 9,
                uid: 'untouched',
                name: 'Untouched',
                size: 'XL',
            }),
        ];
        const virtual = buildTask({
            id: 3,
            name: 'Virtual',
            size: 'XL',
            is_virtual_occurrence: true,
        });
        const sectionB: Task[] = [
            buildTask({ id: 2, name: 'Section B', size: 'M' }),
            virtual,
        ];

        const nextA = applyTaskSizeUpdate(sectionA, {
            uid: 'task-1',
            size: 'S',
        });
        const nextB = applyTaskSizeUpdate(sectionB, {
            uid: 'task-1',
            size: 'S',
        });

        expect(nextA[0].size).toBe('S');
        expect(nextA[0].subtasks?.[0].size).toBe('S');
        expect(nextA[0].subtasks?.[1]).toBe(sibling);
        expect(nextA[1]).toBe(sectionA[1]);
        expect(nextB[0].size).toBe('S');
        expect(nextB[1]).toBe(virtual);
        expect(nextB[1].size).toBe('XL');
    });
});

describe('useTaskSizeSync', () => {
    beforeEach(() => {
        useStore.setState((state) => ({
            tasksStore: {
                ...state.tasksStore,
                tasks: [buildTask()],
                lastSizeUpdate: null,
            },
        }));
    });

    it('calls the subscriber for each published size', () => {
        const onSizeUpdate = jest.fn();
        renderHook(() => useTaskSizeSync(onSizeUpdate));

        expect(onSizeUpdate).not.toHaveBeenCalled();

        act(() => {
            useStore.getState().tasksStore.publishTaskSize('task-1', 'L');
        });

        expect(onSizeUpdate).toHaveBeenCalledTimes(1);
        expect(onSizeUpdate).toHaveBeenCalledWith({
            uid: 'task-1',
            size: 'L',
            seq: 1,
        });

        act(() => {
            useStore.getState().tasksStore.publishTaskSize('task-1', 'S');
        });

        expect(onSizeUpdate).toHaveBeenCalledTimes(2);
        expect(onSizeUpdate).toHaveBeenLastCalledWith({
            uid: 'task-1',
            size: 'S',
            seq: 2,
        });
    });
});
