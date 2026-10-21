import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { TaskSize } from '../../entities/Task';

interface SizeDropdownProps {
    value: TaskSize | undefined;
    canEdit: boolean;
    onChange: (value: TaskSize) => void;
}

const SIZE_OPTIONS: Array<{ value: TaskSize; labelKey: string; fallback: string }> =
    [
        { value: null, labelKey: 'task.sizeUnset', fallback: 'Unset' },
        { value: 'S', labelKey: 'task.sizeS', fallback: 'S' },
        { value: 'M', labelKey: 'task.sizeM', fallback: 'M' },
        { value: 'L', labelKey: 'task.sizeL', fallback: 'L' },
        { value: 'XL', labelKey: 'task.sizeXL', fallback: 'XL' },
    ];

const SizeDropdown: React.FC<SizeDropdownProps> = ({
    value,
    canEdit,
    onChange,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selected =
        SIZE_OPTIONS.find((option) => option.value === (value ?? null)) ||
        SIZE_OPTIONS[0];

    const handleToggle = (event: React.MouseEvent | React.KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!canEdit) {
            return;
        }
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: rect.left,
                width: Math.max(rect.width, 112),
            });
        }
        setIsOpen((open) => !open);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current?.contains(target) ||
                menuRef.current?.contains(target)
            ) {
                return;
            }
            setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (
        event: React.MouseEvent,
        nextValue: TaskSize
    ) => {
        event.preventDefault();
        event.stopPropagation();
        onChange(nextValue);
        setIsOpen(false);
    };

    return (
        <div
            ref={dropdownRef}
            data-testid="size-dropdown"
            data-state={isOpen ? 'open' : 'closed'}
            className="relative inline-block text-left"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-disabled={!canEdit}
                aria-label={t('task.sizeLabel', 'Size')}
                onClick={handleToggle}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        handleToggle(event);
                    }
                }}
            >
                <span>{t(selected.labelKey, selected.fallback)}</span>
                {canEdit && (
                    <ChevronDownIcon className="h-3 w-3 text-gray-500" />
                )}
            </button>
            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className="fixed z-50 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                    >
                        {SIZE_OPTIONS.map((option) => (
                            <button
                                key={option.value ?? 'unset'}
                                type="button"
                                role="option"
                                data-testid={`size-option-${option.value ?? 'unset'}`}
                                className="flex w-full px-3 py-2 text-left text-sm text-gray-900 first:rounded-t-md last:rounded-b-md hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-600"
                                onClick={(event) =>
                                    handleSelect(event, option.value)
                                }
                            >
                                {t(option.labelKey, option.fallback)}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default SizeDropdown;
