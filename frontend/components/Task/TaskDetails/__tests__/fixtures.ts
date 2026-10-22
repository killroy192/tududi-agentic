import { Task } from '../../../../entities/Task';
import { Project } from '../../../../entities/Project';
import { Area } from '../../../../entities/Area';
import { Tag } from '../../../../entities/Tag';

export const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 1,
    uid: 'task-uid-1',
    name: 'Test Task',
    status: 'not_started',
    completed_at: null,
    note: '',
    tags: [],
    subtasks: [],
    recurrence_type: 'none',
    ...overrides,
});

export const makeProject = (overrides: Partial<Project> = {}): Project => ({
    id: 10,
    uid: 'project-uid-1',
    name: 'Test Project',
    ...overrides,
});

export const makeArea = (overrides: Partial<Area> = {}): Area => ({
    id: 20,
    uid: 'area-uid-1',
    name: 'Test Area',
    ...overrides,
});

export const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
    id: 30,
    uid: 'tag-uid-1',
    name: 'urgent',
    ...overrides,
});
