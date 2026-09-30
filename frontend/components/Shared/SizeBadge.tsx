import React from 'react';
import { useTranslation } from 'react-i18next';
import { TaskSize, normalizeTaskSize } from '../../entities/Task';
import { getTaskSizeLabel } from '../../utils/taskSizeLabels';

interface SizeBadgeProps {
    size?: TaskSize | null;
    className?: string;
}

/**
 * Non-interactive task size label for dense / display-only surfaces
 * (Kanban, Eisenhower, search, read-only rows). Renders nothing when unset.
 */
const SizeBadge: React.FC<SizeBadgeProps> = ({ size, className = '' }) => {
    const { t } = useTranslation();
    const normalizedSize = normalizeTaskSize(size);

    if (!normalizedSize) return null;

    const label = getTaskSizeLabel(t, normalizedSize);
    const accessibleName = `${t('size.label', 'Size')}: ${label}`;

    return (
        <span
            data-testid="size-badge"
            className={`inline-flex items-center flex-shrink-0 px-1.5 py-px rounded border border-gray-300 dark:border-gray-600 text-[10px] font-semibold leading-4 text-gray-600 dark:text-gray-300 ${className}`}
            aria-label={accessibleName}
            title={accessibleName}
        >
            {label}
        </span>
    );
};

export default SizeBadge;
