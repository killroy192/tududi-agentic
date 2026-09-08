import {
    getSizeLetter,
    normaliseSize,
    sizesEqual,
} from './taskSize';

describe('taskSize helpers', () => {
    it('normalises wire integers and letters', () => {
        expect(normaliseSize(1)).toBe(1);
        expect(normaliseSize(4)).toBe(4);
        expect(normaliseSize('s')).toBe(1);
        expect(normaliseSize('XL')).toBe(4);
        expect(normaliseSize('2')).toBe(2);
    });

    it('maps unrecognised values to unset (AC-22)', () => {
        expect(normaliseSize(99)).toBeNull();
        expect(normaliseSize('huge')).toBeNull();
        expect(normaliseSize(0)).toBeNull();
        expect(normaliseSize(undefined)).toBeNull();
        expect(normaliseSize(null)).toBeNull();
    });

    it('returns display letters', () => {
        expect(getSizeLetter(3)).toBe('L');
        expect(getSizeLetter('m')).toBe('M');
        expect(getSizeLetter(99)).toBeNull();
    });

    it('compares sizes across forms', () => {
        expect(sizesEqual(2, 'm')).toBe(true);
        expect(sizesEqual(2, 3)).toBe(false);
        expect(sizesEqual(null, undefined)).toBe(true);
    });
});
