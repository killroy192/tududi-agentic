import React, {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
    SIZE_OPTIONS,
    SizeWireValue,
    getSizeLetter,
    normaliseSize,
    sizesEqual,
} from '../../utils/taskSize';
import { updateTask } from '../../utils/tasksService';
import { useToast } from '../Shared/ToastContext';

export type SizeControlVariant = 'chip' | 'field';

interface SizeControlProps {
    taskUid: string | undefined;
    size: number | string | null | undefined;
    variant?: SizeControlVariant;
    className?: string;
    disabled?: boolean;
    /** Called after a successful size update with the new wire value (or null). */
    onSizeChange?: (size: SizeWireValue | null) => void;
}

const SizeControl: React.FC<SizeControlProps> = ({
    taskUid,
    size,
    variant = 'chip',
    className = '',
    disabled = false,
    onSizeChange,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const requestTokenRef = useRef(0);

    const propSize = normaliseSize(size);
    const [optimisticSize, setOptimisticSize] = useState<SizeWireValue | null>(
        propSize
    );
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    // Reconcile when the prop catches up (or after external changes)
    useEffect(() => {
        setOptimisticSize(propSize);
    }, [propSize]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const currentIndex = SIZE_OPTIONS.findIndex((option) =>
            sizesEqual(option.value, optimisticSize)
        );
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }, [isOpen, optimisticSize]);

    const displayLetter = getSizeLetter(optimisticSize);
    const accessibleValue =
        displayLetter ?? t('size.none', 'None');

    const handleSelect = useCallback(
        async (next: SizeWireValue | null) => {
            setIsOpen(false);

            if (sizesEqual(next, optimisticSize)) {
                return;
            }

            if (!taskUid) {
                return;
            }

            const previous = optimisticSize;
            setOptimisticSize(next);

            const token = ++requestTokenRef.current;

            try {
                const updated = await updateTask(taskUid, { size: next });
                if (token !== requestTokenRef.current) {
                    return;
                }
                const normalised = normaliseSize(updated.size);
                setOptimisticSize(normalised);
                onSizeChange?.(normalised);
            } catch (error: any) {
                if (token !== requestTokenRef.current) {
                    return;
                }
                setOptimisticSize(previous);
                const message = error?.message || '';
                if (
                    message.toLowerCase().includes('forbidden') ||
                    message.toLowerCase().includes('permission')
                ) {
                    showErrorToast(
                        t(
                            'errors.permissionDenied',
                            'Forbidden'
                        )
                    );
                } else {
                    showErrorToast(
                        t(
                            'errors.networkError',
                            'Network error. Please try again.'
                        )
                    );
                }
            }
        },
        [optimisticSize, onSizeChange, showErrorToast, t, taskUid]
    );

    const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
        // Parent row navigates on Enter and Space — always stop both (AC-23)
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            if (disabled) return;
            setIsOpen((open) => !open);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            if (disabled) return;
            setIsOpen(true);
            return;
        }

        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
        }
    };

    const handleListKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            const option = SIZE_OPTIONS[highlightedIndex];
            if (option) {
                void handleSelect(option.value);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setHighlightedIndex((index) =>
                Math.min(index + 1, SIZE_OPTIONS.length - 1)
            );
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setHighlightedIndex((index) => Math.max(index - 1, 0));
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
        }
    };

    const handleTriggerClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;
        setIsOpen((open) => !open);
    };

    const isChip = variant === 'chip';

    const triggerClass = isChip
        ? `inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded border text-xs font-semibold tracking-wide transition-colors ${
              displayLetter
                  ? 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200 bg-white dark:bg-gray-900'
                  : 'border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
          } hover:bg-gray-50 dark:hover:bg-gray-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`
        : `px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 sm:gap-2 border ${
              displayLetter
                  ? 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
          } hover:bg-gray-50 dark:hover:bg-gray-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`;

    return (
        <div
            ref={containerRef}
            className={`relative inline-flex ${className}`}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.stopPropagation();
                }
            }}
        >
            <button
                type="button"
                className={triggerClass}
                onClick={handleTriggerClick}
                onKeyDown={handleTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-label={t('size.labelWithValue', 'Size: {{value}}', {
                    value: accessibleValue,
                })}
                disabled={disabled}
                data-testid="task-size-control"
            >
                <span aria-hidden="true">
                    {displayLetter ?? (isChip ? '·' : t('size.none', 'None'))}
                </span>
                {!isChip && (
                    <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                )}
            </button>

            {isOpen && (
                <ul
                    id={listboxId}
                    role="listbox"
                    aria-label={t('size.label', 'Size')}
                    tabIndex={-1}
                    className="absolute end-0 z-30 mt-1 min-w-[7rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                    onKeyDown={handleListKeyDown}
                >
                    {SIZE_OPTIONS.map((option, index) => {
                        const isSelected = sizesEqual(
                            option.value,
                            optimisticSize
                        );
                        const isHighlighted = index === highlightedIndex;
                        const label = option.letter
                            ? option.letter
                            : t(option.labelKey, option.fallbackLabel);

                        return (
                            <li
                                key={option.labelKey}
                                role="option"
                                aria-selected={isSelected}
                                className={`cursor-pointer px-3 py-1.5 text-sm ${
                                    isHighlighted || isSelected
                                        ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                                        : 'text-gray-700 dark:text-gray-200'
                                }`}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void handleSelect(option.value);
                                }}
                            >
                                {label}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default SizeControl;
