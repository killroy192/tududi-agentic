export type SizeLetter = 'S' | 'M' | 'L' | 'XL';
export type SizeValue = SizeLetter | null;

export const SIZE_VALUES = {
    S: 1,
    M: 2,
    L: 3,
    XL: 4,
} as const;

export const SIZE_LETTERS: SizeLetter[] = ['S', 'M', 'L', 'XL'];

const INT_TO_LETTER: Record<number, SizeLetter> = {
    1: 'S',
    2: 'M',
    3: 'L',
    4: 'XL',
};

export const normalizeSize = (
    value: SizeValue | number | string | undefined | null
): SizeValue => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (typeof value === 'number') {
        return INT_TO_LETTER[value] ?? null;
    }
    if (typeof value === 'string') {
        const upper = value.toUpperCase() as SizeLetter;
        if (SIZE_LETTERS.includes(upper)) {
            return upper;
        }
        const asNum = Number(value);
        if (!Number.isNaN(asNum)) {
            return INT_TO_LETTER[asNum] ?? null;
        }
    }
    return null;
};

export const sizeToApiValue = (size: SizeValue): number | null => {
    if (size === null) return null;
    return SIZE_VALUES[size];
};

export const sizesEqual = (
    a: SizeValue | number | string | undefined | null,
    b: SizeValue | number | string | undefined | null
): boolean => normalizeSize(a) === normalizeSize(b);
