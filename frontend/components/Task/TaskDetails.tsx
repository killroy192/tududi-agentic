import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    TaskContentCard,
    TaskProjectCard,
    TaskAreaCard,
    TaskTagsCard,
    TaskSubtasksCard,
    TaskRecurrenceCard,
    TaskDueDateCard,
    TaskDeferUntilCard,
    TaskAttachmentsCard,
    TaskAssignedToCard,
} from './TaskDetails/';
import TaskDetailsAI, {
    TaskDetailsAIHeaderProps,
} from './TaskDetails/TaskDetailsAI';
import { TaskDetailsPageProvider } from './TaskDetails/TaskDetailsPageContext';
import { useTaskDetailsPage } from './TaskDetails/useTaskDetailsPage';
import { useAttachmentCount } from './TaskDetails/useAttachmentCount';

const TaskDetails: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { task, loading, error, isNewTask, markModified } =
        useTaskDetailsPage();

    const [activePill, setActivePill] = useState('overview');
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [attachmentCountOverride, setAttachmentCountOverride] = useState<
        number | null
    >(null);
    const [aiHeaderHandlers, setAiHeaderHandlers] =
        useState<TaskDetailsAIHeaderProps | null>(null);

    const fetchedAttachmentCount = useAttachmentCount(task?.uid);
    const attachmentCount =
        attachmentCountOverride ?? fetchedAttachmentCount;

    const recurrenceRefreshRef = useRef<(() => Promise<void>) | null>(null);

    const bumpTimeline = useCallback(() => {
        setTimelineRefreshKey((prev) => prev + 1);
    }, []);

    const refreshRecurrence = useCallback(async () => {
        await recurrenceRefreshRef.current?.();
    }, []);

    const registerRecurrenceRefresh = useCallback(
        (fn: (() => Promise<void>) | null) => {
            recurrenceRefreshRef.current = fn;
        },
        []
    );

    const handleProvideHeaderHandlers = useCallback(
        (handlers: TaskDetailsAIHeaderProps | null) => {
            setAiHeaderHandlers(handlers);
        },
        []
    );

    const pageContextValue = React.useMemo(
        () => ({
            markModified,
            bumpTimeline,
            refreshRecurrence,
            registerRecurrenceRefresh,
        }),
        [markModified, bumpTimeline, refreshRecurrence, registerRecurrenceRefresh]
    );

    if (loading) {
        return <LoadingScreen />;
    }

    if (error || !task) {
        return (
            <div className="flex justify-center px-4 lg:px-2">
                <div className="w-full max-w-5xl">
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                        <ExclamationTriangleIcon className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto mb-8" />
                        <h1 className="text-2xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                            {error || t('task.notFound', 'Task Not Found')}
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                            {t(
                                'task.notFoundDescription',
                                'The task you are looking for does not exist or has been deleted.'
                            )}
                        </p>
                        <button
                            onClick={() => navigate('/today')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
                        >
                            {t('common.goToToday', 'Go to Today')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <TaskDetailsPageProvider value={pageContextValue}>
            <div className="px-4 lg:px-6 pt-4">
                <div className="w-full">
                    <TaskDetailsHeader
                        task={task}
                        activePill={activePill}
                        onPillChange={setActivePill}
                        attachmentCount={attachmentCount}
                        autoEditTitle={isNewTask}
                        onAiInsightsClick={
                            aiHeaderHandlers?.onAiInsightsClick
                        }
                        aiInsightsActive={
                            aiHeaderHandlers?.aiInsightsActive ?? false
                        }
                    />

                    <TaskDetailsAI
                        task={task}
                        onProvideHeaderHandlers={handleProvideHeaderHandlers}
                    />

                    <div className="mb-6 mt-6">
                        {activePill === 'overview' && (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                <div className="lg:col-span-3 space-y-8">
                                    <TaskContentCard task={task} />
                                    <TaskSubtasksCard task={task} />
                                    <TaskRecurrenceCard task={task} />
                                </div>

                                <div className="space-y-6">
                                    <TaskProjectCard task={task} />
                                    <TaskAreaCard task={task} />
                                    <TaskAssignedToCard task={task} />
                                    <TaskTagsCard task={task} />
                                    <TaskDueDateCard task={task} />
                                    <TaskDeferUntilCard task={task} />
                                </div>
                            </div>
                        )}

                        {activePill === 'attachments' && (
                            <div className="grid grid-cols-1">
                                <TaskAttachmentsCard
                                    taskUid={task.uid}
                                    onAttachmentsCountChange={
                                        setAttachmentCountOverride
                                    }
                                />
                            </div>
                        )}

                        {activePill === 'activity' && (
                            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                                <TaskTimeline
                                    taskUid={task.uid}
                                    refreshKey={timelineRefreshKey}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </TaskDetailsPageProvider>
    );
};

export default TaskDetails;
