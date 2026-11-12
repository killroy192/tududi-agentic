import { useEffect, useState } from 'react';

const isOverdueToggleClick = (e: MouseEvent): boolean => {
    const target = e.target as Node;
    return typeof e.composedPath === 'function'
        ? e
              .composedPath()
              .some(
                  (node) =>
                      node instanceof HTMLElement &&
                      node.hasAttribute('data-overdue-toggle')
              )
        : target instanceof HTMLElement &&
              !!target.closest('[data-overdue-toggle]');
};

/**
 * Visibility of the overdue explanation bubble. Closes on a mousedown outside any
 * `data-overdue-toggle` element and whenever the task stops being overdue.
 */
export const useOverdueBubble = (isOverdue: boolean) => {
    const [isOverdueBubbleVisible, setIsOverdueBubbleVisible] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOverdueBubbleVisible && !isOverdueToggleClick(e)) {
                setIsOverdueBubbleVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOverdueBubbleVisible]);

    useEffect(() => {
        if (!isOverdue) {
            setIsOverdueBubbleVisible(false);
        }
    }, [isOverdue]);

    const handleOverdueIconClick = () => {
        if (!isOverdue) {
            return;
        }
        setIsOverdueBubbleVisible((prev) => !prev);
    };

    const handleDismissOverdueAlert = () => {
        setIsOverdueBubbleVisible(false);
    };

    return {
        isOverdueBubbleVisible,
        handleOverdueIconClick,
        handleDismissOverdueAlert,
    };
};
