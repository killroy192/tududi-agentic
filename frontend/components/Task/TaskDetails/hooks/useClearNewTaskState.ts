import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Replaces the navigation state with `{}` so a refresh or back doesn't re-trigger new-task edit mode. */
export const useClearNewTaskState = (isNewTask: boolean) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    useEffect(() => {
        if (isNewTask) {
            navigate(pathname, { replace: true, state: {} });
        }
    }, [isNewTask, navigate, pathname]);
};
