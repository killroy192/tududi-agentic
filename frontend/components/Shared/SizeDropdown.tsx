import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { TaskSize, TASK_SIZES, normalizeTaskSize } from '../../entities/Task';
import { getTaskSizeLabel } from '../../utils/taskSizeLabels';

type SizeOption = TaskSize | null;

interface SizeDropdownProps {
    value?: TaskSize | null;
    onChange: (size: SizeOption) => void | Promise<void>;
    /** Render a non-interactive label instead of a control. */
    disabled?: boolean;
    /** `compact` fits a task list row; `default` matches the details header. */
    variant?: 'default' | 'compact';
    ariaLabel?: string;
    className?: string;
    testId?: string;
}

const OPTIONS: SizeOption[] = [null, ...TASK_SIZES];

const optionKey = (option: SizeOption): string =>
    (option ?? 'none').toLowerCase();

/**
 * Task size selector (None / S / M / L / XL).
 *
 * Fully controlled: the parent owns the value and saves on `onChange`.
 * Keyboard: Enter / Space / ArrowDown open the list; Arrow keys move,
 * Enter / Space select, Escape closes and returns focus to the trigger.
 * Clicks and key presses do not bubble, so it can live inside a clickable row.
 */
const SizeDropdown: React.FC<SizeDropdownProps> = ({
    value,
    onChange,
    disabled = false,
    variant = 'default',
    ariaLabel,
    className = '',
    testId = 'size-dropdown',
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const listboxId = useId();

    const selectedSize = normalizeTaskSize(value);
    const isUnset = selectedSize === null;
    const selectedLabel = getTaskSizeLabel(t, selectedSize);
    const accessibleName = ariaLabel ?? t('size.label', 'Size');
    const isCompact = variant === 'compact';

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
        optionRefs.current[activeIndex]?.focus();
    }, [isOpen, activeIndex]);

    const openMenu = () => {
        const selectedIndex = OPTIONS.findIndex(
            (option) => option === selectedSize
        );
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setIsOpen(true);
    };

    const closeMenu = (restoreFocus = false) => {
        setIsOpen(false);
        if (restoreFocus) {
            triggerRef.current?.focus();
        }
    };

    const handleSelect = (option: SizeOption) => {
        closeMenu(true);
        if (option === selectedSize) return;
        void onChange(option);
    };

    const handleTriggerClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (isOpen) {
            closeMenu();
            return;
        }
        openMenu();
    };

    const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
        event.stopPropagation();
        if (
            event.key === 'Enter' ||
            event.key === ' ' ||
            event.key === 'ArrowDown' ||
            event.key === 'ArrowUp'
        ) {
            event.preventDefault();
            if (!isOpen) openMenu();
            return;
        }
        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeMenu(true);
        }
    };

    const handleOptionKeyDown = (
        event: React.KeyboardEvent,
        index: number,
        option: SizeOption
    ) => {
        event.stopPropagation();
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setActiveIndex((index + 1) % OPTIONS.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActiveIndex((index - 1 + OPTIONS.length) % OPTIONS.length);
                break;
            case 'Home':
                event.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                event.preventDefault();
                setActiveIndex(OPTIONS.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                handleSelect(option);
                break;
            case 'Escape':
                event.preventDefault();
                closeMenu(true);
                break;
            case 'Tab':
                closeMenu();
                break;
            default:
                break;
        }
    };

    const triggerBaseClass = isCompact
        ? 'inline-flex items-center gap-0.5 flex-shrink-0 px-1.5 py-px rounded border text-[10px] font-semibold leading-4 transition-colors'
        : 'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 sm:gap-2 border';

    const triggerToneClass = isUnset
        ? 'border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
        : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200';

    if (disabled) {
        return (
            <span
                data-testid={`${testId}-readonly`}
                className={`${triggerBaseClass} ${triggerToneClass} cursor-default ${className}`}
                aria-label={`${accessibleName}: ${selectedLabel}`}
                aria-disabled="true"
                title={`${accessibleName}: ${selectedLabel}`}
            >
                {selectedLabel}
            </span>
        );
    }

    return (
        <div
            ref={containerRef}
            data-testid={testId}
            data-state={isOpen ? 'open' : 'closed'}
            className={`relative inline-block flex-shrink-0 ${className}`}
            onClick={(event) => event.stopPropagation()}
        >
            <button
                ref={triggerRef}
                type="button"
                className={`${triggerBaseClass} ${triggerToneClass} hover:bg-gray-50 dark:hover:bg-gray-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                onClick={handleTriggerClick}
                onKeyDown={handleTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-label={`${accessibleName}: ${selectedLabel}`}
                title={accessibleName}
            >
                {!isCompact && (
                    <span className="hidden sm:inline text-gray-500 dark:text-gray-400">
                        {accessibleName}
                    </span>
                )}
                <span>{selectedLabel}</span>
                <ChevronDownIcon
                    className={isCompact ? 'h-3 w-3' : 'h-4 w-4'}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label={accessibleName}
                    className="absolute right-0 mt-1 w-32 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-30 py-1"
                >
                    {OPTIONS.map((option, index) => {
                        const isSelected = option === selectedSize;
                        return (
                            <button
                                key={optionKey(option)}
                                ref={(element) => {
                                    optionRefs.current[index] = element;
                                }}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={index === activeIndex ? 0 : -1}
                                data-testid={`size-option-${optionKey(option)}`}
                                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-800 ${
                                    isSelected
                                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleSelect(option);
                                }}
                                onKeyDown={(event) =>
                                    handleOptionKeyDown(event, index, option)
                                }
                                onMouseEnter={() => setActiveIndex(index)}
                            >
                                <span>{getTaskSizeLabel(t, option)}</span>
                                {isSelected && (
                                    <CheckIcon
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SizeDropdown;
