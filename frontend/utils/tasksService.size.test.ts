import { updateTask } from './tasksService';

jest.mock('./csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('csrf-token'),
}));

describe('updateTask size payload', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                uid: 'task-1',
                name: 'Real name',
                status: 'not_started',
                completed_at: null,
                size: 'M',
            }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('sends only size when a size save asks to include it', async () => {
        await updateTask('task-1', { size: 'M' }, { includeSize: true });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).toEqual({ size: 'M' });
        expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    });

    it('drops size from a general update and keeps the stored name', async () => {
        await updateTask('task-1', {
            name: 'Daily',
            original_name: 'Real name',
            priority: 1,
            size: 'XL',
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.size).toBeUndefined();
        expect(body.name).toBe('Real name');
        expect(body.priority).toBe(1);
    });
});
