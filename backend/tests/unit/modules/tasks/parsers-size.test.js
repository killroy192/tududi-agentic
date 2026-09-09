const { Task } = require('../../../../models');
const { parseSize } = require('../../../../modules/tasks/core/parsers');

describe('parseSize', () => {
    it('returns null for null or empty string', () => {
        expect(parseSize(null)).toBeNull();
        expect(parseSize('')).toBeNull();
    });

    it('accepts integer sizes 1-4', () => {
        expect(parseSize(1)).toBe(1);
        expect(parseSize(2)).toBe(2);
        expect(parseSize(3)).toBe(3);
        expect(parseSize(4)).toBe(4);
    });

    it('accepts string sizes S/M/L/XL', () => {
        expect(parseSize('S')).toBe(Task.SIZE.S);
        expect(parseSize('M')).toBe(Task.SIZE.M);
        expect(parseSize('L')).toBe(Task.SIZE.L);
        expect(parseSize('XL')).toBe(Task.SIZE.XL);
        expect(parseSize('m')).toBe(Task.SIZE.M);
    });

    it('rejects invalid sizes without coercion', () => {
        expect(() => parseSize(0)).toThrow(/size/i);
        expect(() => parseSize(5)).toThrow(/size/i);
        expect(() => parseSize('foo')).toThrow(/size/i);
        expect(() => parseSize('low')).toThrow(/size/i);
        expect(() => parseSize(1.5)).toThrow(/size/i);
        expect(() => parseSize(true)).toThrow(/size/i);
    });
});
