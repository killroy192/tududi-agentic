import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useToast } from './ToastContext';
import { updateTask } from '../../utils/tasksService';
import {
    normalizeSize,
    sizeToApiValue,
    sizesEqual,
    SIZE_LETTERS,
    SizeValue,
} from '../../constants/taskSize';

export type TaskSizeControlVariant = 'chip' | 'field';

interface TaskSizeControlProps {
    value: SizeValue | number | string | null | undefined;
    taskUid?: string;
    variant?: TaskSizeControlVariant;
    /** Called immediately on selection (optimistic local state). */
    onSizeUpdated?: (size: SizeValue) => void;
    /** Called after a successful PATCH. */
    onSizeSaved?: (size: SizeValue) => void;
    /** When true, only emit selection without PATCH (e.g. pre-create drafts). */
    localOnly?: boolean;
    className?: string;
}

const OPTIONS: SizeValue[] = [null, ...SIZE_LETTERS];

const TaskSizeControl: React.FC<TaskSizeControlProps> = ({
    value,
    taskUid,
    variant = 'chip',
    onSizeUpdated,
    onSizeSaved,
    localOnly = false,
    className = '',
}) => {
    const { t } = useTranslation();
    const { showErrorToast, showSuccessToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [displaySize, setDisplaySize] = useState<SizeValue>(
        normalizeSize(value)
    );
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const requestSeqRef = useRef(0);
    const displaySizeRef = useRef(displaySize);

    useEffect(() => {
        displaySizeRef.current = displaySize;
    }, [displaySize]);

    useEffect(() => {
        setDisplaySize(normalizeSize(value));
    }, [value]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const getOptionLabel = (option: SizeValue) =>
        option === null
            ? t('size.none', 'None')
            : option;

    const announceCurrent = () => {
        const current = displaySize;
        return current
            ? t('size.currentValue', 'Size {{size}}', { size: current })
            : t('size.unset', 'Size unset');
    };

    const handleSelect = async (next: SizeValue) => {
        setIsOpen(false);
        if (sizesEqual(next, displaySizeRef.current)) {
            return;
        }

        const previous = displaySizeRef.current;
        setDisplaySize(next);
        onSizeUpdated?.(next);

        if (localOnly || !taskUid) {
            return;
        }

        const seq = ++requestSeqRef.current;
        try {
            await updateTask(taskUid, { size: sizeToApiValue(next) } as any);
            if (seq !== requestSeqRef.current) return;
            onSizeSaved?.(next);
            if (variant === 'field') {
                showSuccessToast(
                    t('task.sizeUpdated', 'Size updated successfully')
                );
            }
        } catch (error: any) {
            if (seq !== requestSeqRef.current) return;
            setDisplaySize(previous);
            onSizeUpdated?.(previous);
            const message =
                error?.message ||
                (typeof error === 'string' ? error : null);
            const isPermission =
                error?.status === 403 ||
                (typeof message === 'string' &&
                    /forbidden|permission|not allowed|unauthorized/i.test(
                        message
                    ));
            showErrorToast(
                isPermission
                    ? t(
                          'errors.permissionDenied',
                          'You do not have permission to perform this action'
                      )
                    : t(
                          'errors.networkError',
                          'Network error, please check your connection'
                      )
            );
        }
    };

    const handleToggle = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isOpen) {
            const currentIndex = OPTIONS.findIndex((o) =>
                sizesEqual(o, displaySize)
            );
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
        }
        setIsOpen((open) => !open);
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleToggle(e);
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                const currentIndex = OPTIONS.findIndex((o) =>
                    sizesEqual(o, displaySize)
                );
                setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
            }
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleMenuKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((i) => (i + 1) % OPTIONS.length);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(
                (i) => (i - 1 + OPTIONS.length) % OPTIONS.length
            );
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void handleSelect(OPTIONS[highlightedIndex]);
        }
    };

    const chipClasses =
        variant === 'chip'
            ? `inline-flex items-center justify-center min-w-[1.75rem] h-5 px-1.5 rounded border text-[10px] font-semibold tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  displaySize
                      ? 'border-gray-300 text-gray-700 bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:bg-gray-800'
                      : 'border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
              }`
            : `inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  displaySize
                      ? 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`;

    return (
        <div
            ref={containerRef}
            className={`relative flex-shrink-0 ${className}`}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className={chipClasses}
                onClick={handleToggle}
                onKeyDown={handleTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={t('size.label', 'Size')}
                title={announceCurrent()}
            >
                <span aria-hidden="true">
                    {displaySize ?? t('size.placeholder', 'Size')}
                </span>
                {variant === 'field' && (
                    <>
                        <span className="sr-only">{announceCurrent()}</span>
                        <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                    </>
                )}
                {variant === 'chip' && (
                    <span className="sr-only">{announceCurrent()}</span>
                )}
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    role="listbox"
                    aria-label={t('size.label', 'Size')}
                    tabIndex={-1}
                    onKeyDown={handleMenuKeyDown}
                    className={`absolute z-30 mt-1 min-w-[7rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg ${
                        variant === 'chip' ? 'end-0' : 'start-0'
                    }`}
                >
                    {OPTIONS.map((option, index) => {
                        const isSelected = sizesEqual(option, displaySize);
                        const isHighlighted = index === highlightedIndex;
                        return (
                            <button
                                key={option ?? 'none'}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={`w-full text-start px-3 py-1.5 text-sm flex items-center justify-between ${
                                    isHighlighted
                                        ? 'bg-gray-100 dark:bg-gray-800'
                                        : ''
                                } ${
                                    isSelected
                                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                                        : 'text-gray-700 dark:text-gray-300'
                                }`}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleSelect(option);
                                }}
                            >
                                <span>{getOptionLabel(option)}</span>
                                {isSelected && (
                                    <span className="text-xs" aria-hidden="true">
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TaskSizeControl;
