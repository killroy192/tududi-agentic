import { useEffect, useState } from 'react';
import { Task } from '../../../../entities/Task';
import {
    isTaskOverdueInTodayPlan,
    isTaskPastDue,
} from '../../../../utils/dateUtils';

export const useTaskDetailsOverdueUi = (task: Task | undefined) => {
    const [isOverdueBubbleVisible, setIsOverdueBubbleVisible] = useState(false);

    const isOverdue = task ? isTaskOverdueInTodayPlan(task) : false;
    const isPastDue = task ? isTaskPastDue(task) : false;

    useEffect(() => {
        if (!isOverdue) {
            setIsOverdueBubbleVisible(false);
        }
    }, [isOverdue]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!isOverdueBubbleVisible) {
                return;
            }

            const target = e.target as Node;
            const clickedOverdueToggle =
                typeof e.composedPath === 'function'
                    ? e
                          .composedPath()
                          .some(
                              (node) =>
                                  node instanceof HTMLElement &&
                                  node.hasAttribute('data-overdue-toggle')
                          )
                    : target instanceof HTMLElement &&
                      !!target.closest('[data-overdue-toggle]');

            if (!clickedOverdueToggle) {
                setIsOverdueBubbleVisible(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOverdueBubbleVisible]);

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
        isOverdue,
        isPastDue,
        isOverdueBubbleVisible,
        handleOverdueIconClick,
        handleDismissOverdueAlert,
    };
};
