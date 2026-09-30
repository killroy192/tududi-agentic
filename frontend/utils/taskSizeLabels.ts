import type { TFunction } from 'i18next';
import { TaskSize } from '../entities/Task';

/**
 * Localized label for a task size. `null` maps to the "None" label.
 */
export const getTaskSizeLabel = (
    t: TFunction,
    size: TaskSize | null | undefined
): string => {
    switch (size) {
        case 'S':
            return t('size.s', 'S');
        case 'M':
            return t('size.m', 'M');
        case 'L':
            return t('size.l', 'L');
        case 'XL':
            return t('size.xl', 'XL');
        default:
            return t('size.none', 'None');
    }
};
