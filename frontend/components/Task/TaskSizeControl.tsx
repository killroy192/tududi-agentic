import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Task, TaskSize, TASK_SIZES } from '../../entities/Task';
import { updateTask } from '../../utils/tasksService';
import { isTaskSizeEditable } from '../../utils/taskSize';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';

type TaskSizeValue = TaskSize | null;

interface TaskSizeControlProps {
    task: Task;
    /** Toast shown when the save fails. Defaults to the generic task update error. */
    errorMessage?: string;
    /** Smaller trigger for dense layouts (Kanban, mobile rows). */
    compact?: boolean;
    className?: string;
    onSaved?: (size: TaskSizeValue) => void;
}

const SIZE_OPTIONS: TaskSizeValue[] = [null, ...TASK_SIZES];
const MENU_WIDTH = 112;
const MENU_HEIGHT = 200;

const stopEvent = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Size (Unset, S, M, L, XL) for a task. Editors get a menu that saves immediately;
 * read-only viewers and virtual occurrences see plain text. Habits render nothing.
 */
const TaskSizeControl: React.FC<TaskSizeControlProps> = ({
    task,
    errorMessage,
    compact = false,
    className = '',
    onSaved,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const publishTaskSize = useStore(
        (state) => state.tasksStore.publishTaskSize
    );

    const storedSize: TaskSizeValue = task.size ?? null;
    const [displaySize, setDisplaySize] = useState<TaskSizeValue>(storedSize);
    const [lastStoredSize, setLastStoredSize] =
        useState<TaskSizeValue>(storedSize);
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    if (storedSize !== lastStoredSize) {
        setLastStoredSize(storedSize);
        setDisplaySize(storedSize);
    }

    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    if (task.habit_mode) return null;

    const getLabel = (size: TaskSizeValue) =>
        size ?? t('task.size.unset', 'Unset');
    const sizeTitle = t('task.size.label', 'Size');
    const ariaLabel = `${sizeTitle}: ${getLabel(displaySize)}`;
    const pillClass = compact
        ? 'px-1.5 py-0.5 text-[11px]'
        : 'px-2 py-0.5 text-xs';
    const baseClass = `inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 font-medium whitespace-nowrap ${pillClass} ${
        displaySize
            ? 'text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800'
            : 'text-gray-500 dark:text-gray-400'
    } ${className}`;

    if (!task.uid || !isTaskSizeEditable(task)) {
        return (
            <span
                className={baseClass}
                aria-label={ariaLabel}
                title={sizeTitle}
                data-testid="task-size-readonly"
            >
                {getLabel(displaySize)}
            </span>
        );
    }

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSaving) return;
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward =
                spaceBelow < MENU_HEIGHT && rect.top > spaceBelow;
            setMenuPosition({
                top: openUpward ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
                left: Math.max(
                    8,
                    Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)
                ),
            });
        }
        setIsOpen((open) => !open);
    };

    const handleSelect = async (size: TaskSizeValue) => {
        setIsOpen(false);
        if (size === displaySize) return;

        const previousSize = displaySize;
        setDisplaySize(size);
        setIsSaving(true);
        try {
            const savedTask = await updateTask(task.uid as string, { size });
            const savedSize = savedTask?.size ?? size;
            setDisplaySize(savedSize);
            publishTaskSize(task.uid as string, savedSize);
            onSaved?.(savedSize);
        } catch (error) {
            console.error('Failed to update task size:', error);
            setDisplaySize(previousSize);
            showErrorToast(
                errorMessage ?? t('task.updateError', 'Failed to update task')
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`${baseClass} hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60`}
                onClick={handleToggle}
                onMouseDown={stopEvent}
                onKeyDown={(e) => {
                    // Keep Enter/Space from opening the parent row. Escape must
                    // still close the menu: stopping it here blocks the document listener.
                    e.stopPropagation();
                    if (e.key !== 'Escape' || !isOpen) return;
                    e.preventDefault();
                    setIsOpen(false);
                    triggerRef.current?.focus();
                }}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={ariaLabel}
                title={sizeTitle}
                disabled={isSaving}
                data-testid="task-size-trigger"
            >
                <span>{getLabel(displaySize)}</span>
                <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
            </button>
            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label={sizeTitle}
                        className="fixed z-50 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1"
                        style={{
                            top: menuPosition.top,
                            left: menuPosition.left,
                            width: MENU_WIDTH,
                        }}
                        onClick={stopEvent}
                        onMouseDown={stopEvent}
                    >
                        {SIZE_OPTIONS.map((size) => {
                            const isSelected = size === displaySize;
                            return (
                                <button
                                    key={size ?? 'unset'}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={isSelected}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm text-left ${
                                        isSelected
                                            ? 'bg-gray-100 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100'
                                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelect(size);
                                    }}
                                    data-testid={`task-size-option-${size ?? 'unset'}`}
                                >
                                    <span>{getLabel(size)}</span>
                                    {isSelected && (
                                        <CheckIcon
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </>
    );
};

export default TaskSizeControl;
