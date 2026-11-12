const { isValidTaskSize } = require('../../../../modules/tasks/core/parsers');
const { Task } = require('../../../../models');

describe('isValidTaskSize', () => {
    it('exposes the allowed size letters on the task model', () => {
        expect(Task.SIZES).toEqual(['S', 'M', 'L', 'XL']);
    });

    it.each([null, 'S', 'M', 'L', 'XL'])('accepts %s', (value) => {
        expect(isValidTaskSize(value)).toBe(true);
    });

    it.each([
        ['empty string', ''],
        ['unset', 'unset'],
        ['lowercase s', 's'],
        ['XXL', 'XXL'],
        ['number', 5],
        ['zero', 0],
        ['true', true],
        ['false', false],
        ['object', { size: 'S' }],
        ['array', ['S']],
        ['undefined', undefined],
    ])('rejects %s', (_label, value) => {
        expect(isValidTaskSize(value)).toBe(false);
    });
});
