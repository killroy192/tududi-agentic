import { SizeType } from '../entities/Task';

/** Wire integers: S=1, M=2, L=3, XL=4. Unset is null/undefined. */
export const SIZE_VALUES = {
    S: 1,
    M: 2,
    L: 3,
    XL: 4,
} as const;

export type SizeWireValue = 1 | 2 | 3 | 4;

export type SizeOption = {
    value: SizeWireValue | null;
    letter: string | null;
    labelKey: string;
    fallbackLabel: string;
};

export const SIZE_OPTIONS: SizeOption[] = [
    {
        value: null,
        letter: null,
        labelKey: 'size.none',
        fallbackLabel: 'None',
    },
    {
        value: 1,
        letter: 'S',
        labelKey: 'size.s',
        fallbackLabel: 'S',
    },
    {
        value: 2,
        letter: 'M',
        labelKey: 'size.m',
        fallbackLabel: 'M',
    },
    {
        value: 3,
        letter: 'L',
        labelKey: 'size.l',
        fallbackLabel: 'L',
    },
    {
        value: 4,
        letter: 'XL',
        labelKey: 'size.xl',
        fallbackLabel: 'XL',
    },
];

const LETTER_TO_WIRE: Record<string, SizeWireValue> = {
    s: 1,
    m: 2,
    l: 3,
    xl: 4,
};

/**
 * Normalise any API/UI size value to a wire integer or null (unset).
 * Unrecognised values map to unset — never throw (AC-22).
 */
export const normaliseSize = (
    size: SizeType | number | string | null | undefined
): SizeWireValue | null => {
    if (size === null || size === undefined || size === '' || size === 'none') {
        return null;
    }

    if (typeof size === 'number') {
        if (size === 1 || size === 2 || size === 3 || size === 4) {
            return size;
        }
        return null;
    }

    if (typeof size === 'string') {
        const lower = size.toLowerCase().trim();
        if (LETTER_TO_WIRE[lower]) {
            return LETTER_TO_WIRE[lower];
        }
        const asNumber = Number(size);
        if (asNumber === 1 || asNumber === 2 || asNumber === 3 || asNumber === 4) {
            return asNumber;
        }
    }

    return null;
};

export const getSizeLetter = (
    size: SizeType | number | string | null | undefined
): string | null => {
    const wire = normaliseSize(size);
    if (wire === null) return null;
    return SIZE_OPTIONS.find((option) => option.value === wire)?.letter ?? null;
};

export const sizesEqual = (
    a: SizeType | number | string | null | undefined,
    b: SizeType | number | string | null | undefined
): boolean => normaliseSize(a) === normaliseSize(b);
