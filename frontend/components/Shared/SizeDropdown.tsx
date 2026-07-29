import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { SizeType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';

interface SizeDropdownProps {
    value: SizeType;
    onChange: (value: SizeType) => void;
    testIdSuffix?: string;
}

const SIZE_OPTIONS: { value: SizeType; key: string }[] = [
    { value: null, key: 'none' },
    { value: 'S', key: 's' },
    { value: 'M', key: 'm' },
    { value: 'L', key: 'l' },
    { value: 'XL', key: 'xl' },
];

const SizeDropdown: React.FC<SizeDropdownProps> = ({
    value,
    onChange,
    testIdSuffix,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0,
        openUpward: false,
    });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleToggle = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();

            if (!isOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const menuHeight = 180;

                const openUpward =
                    spaceAbove > spaceBelow && spaceBelow < menuHeight;

                setPosition({
                    top: openUpward
                        ? rect.top - menuHeight - 4
                        : rect.bottom + 4,
                    left: rect.left,
                    openUpward,
                });
            }
            setIsOpen(!isOpen);
        },
        [isOpen]
    );

    const handleSelect = useCallback(
        (size: SizeType) => {
            onChange(size);
            setIsOpen(false);
        },
        [onChange]
    );

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node) &&
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const displayValue = value
        ? t(`size.${value.toLowerCase()}`, value)
        : t('size.none', '—');

    const testId = testIdSuffix
        ? `task-size-badge-${testIdSuffix}`
        : 'task-size-dropdown';

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-testid={testId}
                onClick={handleToggle}
                onKeyDown={(e) => e.stopPropagation()}
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium border cursor-pointer transition-colors ${
                    value
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700'
                        : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
                } hover:bg-indigo-100 dark:hover:bg-indigo-900/50`}
                title={t('size.label', 'Size')}
            >
                {displayValue}
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 py-1 min-w-[100px]"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                        }}
                    >
                        {SIZE_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(option.value);
                                }}
                                className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                                data-testid={`task-size-option-${option.value || 'none'}`}
                            >
                                <span className="flex items-center gap-2">
                                    {option.value === null ? (
                                        <XMarkIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    ) : null}
                                    <span>
                                        {option.value === null
                                            ? t('priority.none', 'None')
                                            : t(
                                                  `size.${option.key}`,
                                                  option.value
                                              )}
                                    </span>
                                </span>
                                {value === option.value && (
                                    <CheckIcon className="w-4 h-4 text-indigo-500" />
                                )}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
};

export default SizeDropdown;
