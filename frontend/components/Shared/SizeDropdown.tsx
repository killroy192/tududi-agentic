import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { TaskSize } from '../../entities/Task';

interface SizeDropdownProps {
    value: TaskSize | null | undefined;
    isOwner: boolean;
    onChange: (value: TaskSize | null) => void;
}

const SIZE_OPTIONS: Array<{
    value: TaskSize | null;
    labelKey: string;
    fallback: string;
    testId: string;
}> = [
    {
        value: null,
        labelKey: 'task.sizeUnset',
        fallback: 'Unset',
        testId: 'size-option-unset',
    },
    {
        value: 'S',
        labelKey: 'task.sizeS',
        fallback: 'S',
        testId: 'size-option-S',
    },
    {
        value: 'M',
        labelKey: 'task.sizeM',
        fallback: 'M',
        testId: 'size-option-M',
    },
    {
        value: 'L',
        labelKey: 'task.sizeL',
        fallback: 'L',
        testId: 'size-option-L',
    },
    {
        value: 'XL',
        labelKey: 'task.sizeXL',
        fallback: 'XL',
        testId: 'size-option-XL',
    },
];

const SizeDropdown: React.FC<SizeDropdownProps> = ({
    value,
    isOwner,
    onChange,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0,
        width: 0,
        openUpward: false,
    });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedValue = value ?? null;
    const selectedOption =
        SIZE_OPTIONS.find((option) => option.value === selectedValue) ??
        SIZE_OPTIONS[0];

    const handleToggle = () => {
        if (!isOwner) {
            return;
        }

        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = 200;
            const openUpward =
                spaceAbove > spaceBelow && spaceBelow < menuHeight;

            setPosition({
                top: openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                openUpward,
            });
        }

        setIsOpen((open) => !open);
    };

    const handleSelect = (next: TaskSize | null) => {
        if (!isOwner) {
            return;
        }
        onChange(next);
        setIsOpen(false);
    };

    useEffect(() => {
        if (!isOwner) {
            setIsOpen(false);
        }
    }, [isOwner]);

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

    const stopRowActivation = (
        event: React.MouseEvent | React.KeyboardEvent
    ) => {
        event.stopPropagation();
    };

    const handleButtonKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>
    ) => {
        event.stopPropagation();
        if (!isOwner && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
        }
    };

    return (
        <div ref={dropdownRef} className="relative inline-block text-left">
            <button
                type="button"
                data-testid="size-dropdown"
                className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 bg-white dark:bg-gray-900 text-xs font-medium text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-disabled={!isOwner}
                onMouseDown={stopRowActivation}
                onClick={(event) => {
                    event.stopPropagation();
                    handleToggle();
                }}
                onKeyDown={handleButtonKeyDown}
            >
                {t(selectedOption.labelKey, selectedOption.fallback)}
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            minWidth: `${Math.max(position.width, 112)}px`,
                        }}
                    >
                        {SIZE_OPTIONS.map((option) => (
                            <button
                                key={option.testId}
                                type="button"
                                role="option"
                                aria-selected={option.value === selectedValue}
                                data-testid={option.testId}
                                className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 first:rounded-t-md last:rounded-b-md ${
                                    option.value === selectedValue
                                        ? 'bg-gray-100 dark:bg-gray-600 font-medium'
                                        : ''
                                }`}
                                onMouseDown={stopRowActivation}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelect(option.value);
                                }}
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
