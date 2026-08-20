import React, { useCallback, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    TaskContentCard,
    TaskProjectCard,
    TaskAreaCard,
    TaskDetailsTags,
    TaskDetailsSubtasks,
    TaskDetailsRecurrence,
    TaskDetailsRecurrenceHandle,
    TaskDueDateCard,
    TaskDeferUntilCard,
    TaskDetailsAttachments,
    TaskDetailsPeople,
    TaskDetailsAI,
    TaskDetailsAIHandle,
} from './TaskDetails/';
import { getProjectLink, getTagLink } from './TaskDetails/taskDetailsLinks';
import { useNewTaskLifecycle } from './TaskDetails/hooks/useNewTaskLifecycle';
import { useTaskDetailsLoader } from './TaskDetails/hooks/useTaskDetailsLoader';
import { useAttachmentCountBadge } from './TaskDetails/hooks/useAttachmentCountBadge';
import { useTaskDetailsMutations } from './TaskDetails/hooks/useTaskDetailsMutations';

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const isNewTask = location.state?.isNew === true;

    const { taskModifiedRef } = useNewTaskLifecycle({
        uid,
        isNewTask,
        navigate,
        pathname: location.pathname,
    });

    const projectsStore = useStore((state) => state.projectsStore);
    const tagsStore = useStore((state) => state.tagsStore);
    const tasksStore = useStore((state) => state.tasksStore);
    const areasStore = useStore((state) => state.areasStore);
    const aiAssistantEnabled = useStore(
        (state) => state.userSettingsStore.aiAssistantEnabled
    );
    const task = useStore((state) =>
        state.tasksStore.tasks.find((candidate) => candidate.uid === uid)
    );

    const { loading, error } = useTaskDetailsLoader(uid, task, tasksStore);
    const [attachmentCount, setAttachmentCount] = useAttachmentCountBadge(
        task?.uid
    );

    const [activePill, setActivePill] = useState('overview');
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);
    const aiInsightsRef = useRef<TaskDetailsAIHandle>(null);
    const recurrenceRef = useRef<TaskDetailsRecurrenceHandle>(null);

    const handleAiInsightsClick = useCallback(() => {
        aiInsightsRef.current?.activate();
    }, []);

    const handleTimelineRefresh = useCallback(() => {
        setTimelineRefreshKey((prev) => prev + 1);
    }, []);

    const markTaskModified = useCallback(() => {
        taskModifiedRef.current = true;
    }, [taskModifiedRef]);

    const {
        handleTitleUpdate,
        handleContentUpdate,
        handleStatusUpdate,
        handlePriorityUpdate,
        handleCompletionToggle,
        isConfirmDialogOpen,
        taskToDelete,
        handleDeleteClick,
        handleDeleteConfirm,
        cancelDelete,
    } = useTaskDetailsMutations({
        task,
        uid,
        tasksStore,
        taskModifiedRef,
        onTimelineRefresh: handleTimelineRefresh,
        onCompletionToggled: (mergedTask) =>
            recurrenceRef.current?.refreshAfterCompletionToggle(mergedTask),
        navigate,
        deleteRedirectPath: location.state?.from,
    });

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
        <div className="px-4 lg:px-6 pt-4">
            <div className="w-full">
                <TaskDetailsHeader
                    task={task}
                    onTitleUpdate={handleTitleUpdate}
                    onStatusUpdate={handleStatusUpdate}
                    onPriorityUpdate={handlePriorityUpdate}
                    onDelete={handleDeleteClick}
                    getProjectLink={getProjectLink}
                    getTagLink={getTagLink}
                    activePill={activePill}
                    onPillChange={setActivePill}
                    onQuickStatusToggle={handleCompletionToggle}
                    onAiInsightsClick={
                        aiAssistantEnabled ? handleAiInsightsClick : undefined
                    }
                    aiInsightsActive={aiInsightsActive}
                    attachmentCount={attachmentCount}
                    autoEditTitle={isNewTask}
                />

                <TaskDetailsAI
                    ref={aiInsightsRef}
                    task={task}
                    onActiveChange={setAiInsightsActive}
                />

                <div className="mb-6 mt-6">
                    {activePill === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-3 space-y-8">
                                <TaskContentCard
                                    content={task.note || ''}
                                    onUpdate={handleContentUpdate}
                                />
                                <TaskDetailsSubtasks
                                    task={task}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />
                                <TaskDetailsRecurrence
                                    ref={recurrenceRef}
                                    task={task}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />
                            </div>

                            <div className="space-y-6">
                                <TaskProjectCard
                                    task={task}
                                    tasksStore={tasksStore}
                                    projectsStore={projectsStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />

                                <TaskAreaCard
                                    task={task}
                                    areasStore={areasStore}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />

                                <TaskDetailsPeople
                                    task={task}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                />

                                <TaskDetailsTags
                                    task={task}
                                    tagsStore={tagsStore}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />

                                <TaskDueDateCard
                                    task={task}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />

                                <TaskDeferUntilCard
                                    task={task}
                                    tasksStore={tasksStore}
                                    onTaskModified={markTaskModified}
                                    onTimelineRefresh={handleTimelineRefresh}
                                />
                            </div>
                        </div>
                    )}

                    {activePill === 'attachments' && (
                        <div className="grid grid-cols-1">
                            <TaskDetailsAttachments
                                taskUid={task.uid!}
                                onAttachmentsCountChange={setAttachmentCount}
                            />
                        </div>
                    )}

                    {activePill === 'activity' && (
                        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                            <TaskTimeline
                                taskUid={task.uid!}
                                refreshKey={timelineRefreshKey}
                            />
                        </div>
                    )}
                </div>

                {isConfirmDialogOpen && taskToDelete && (
                    <ConfirmDialog
                        title={t('task.deleteConfirmTitle', 'Delete Task')}
                        message={t(
                            'task.deleteConfirmMessage',
                            'Are you sure you want to delete this task? This action cannot be undone.'
                        )}
                        onConfirm={handleDeleteConfirm}
                        onCancel={cancelDelete}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
