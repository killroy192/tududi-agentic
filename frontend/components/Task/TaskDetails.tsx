import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    useTaskDetailsLifecycle,
    TaskDetailsSubtasksSection,
    useTaskDetailsSubtasks,
    TaskDetailsTags,
    useTaskDetailsTags,
    TaskDetailsPeople,
    useTaskDetailsPeople,
    TaskDetailsRecurrenceSectionComponent,
    TaskDetailsScheduleSection,
    useTaskDetailsRecurrence,
    TaskDetailsAttachments,
    useTaskDetailsAttachmentCount,
    TaskDetailsAI,
    useTaskDetailsAI,
} from './TaskDetails/';

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const isNewTask = location.state?.isNew === true;

    const [activePill, setActivePill] = useState('overview');

    /* -- All hooks called unconditionally at the top -- */

    const {
        task,
        loading,
        error,
        timelineRefreshKey,
        bumpTimeline,
        markModified,
        projectsStore,
        tagsStore,
        areasStore,
    } = useTaskDetailsLifecycle({
        uid,
        isNewTask,
        navigate,
        locationPathname: location.pathname,
    });

    const {
        pendingSubtasks,
        setPendingSubtasks,
        handleSaveSubtasks,
        handleContentUpdate,
    } = useTaskDetailsSubtasks({ task, uid, markModified, bumpTimeline });

    const { handleTagsUpdate } = useTaskDetailsTags({
        task,
        uid,
        markModified,
        bumpTimeline,
        tagsStore,
    });

    const {
        handleProjectSelection,
        handleClearProject,
        handleProjectCreateInline,
        handleAreaSelection,
        handleClearArea,
        handleAssignPerson,
    } = useTaskDetailsPeople({
        task,
        uid,
        markModified,
        bumpTimeline,
        projectsStore,
        areasStore,
    });

    const recurrence = useTaskDetailsRecurrence({
        task,
        uid,
        markModified,
        bumpTimeline,
    });

    const { attachmentCount, setAttachmentCount } =
        useTaskDetailsAttachmentCount(task?.uid);

    const ai = useTaskDetailsAI({ task, projectsStore });

    /* -- Early returns (after all hooks) -- */

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
                    markModified={markModified}
                    bumpTimeline={bumpTimeline}
                    activePill={activePill}
                    onPillChange={setActivePill}
                    attachmentCount={attachmentCount}
                    autoEditTitle={isNewTask}
                    aiAssistantEnabled={ai.aiAssistantEnabled}
                    onAiInsightsClick={ai.aiAssistantEnabled ? ai.handleAiInsightsClick : undefined}
                    aiInsightsActive={ai.aiInsightsActive}
                    onAfterCompletion={recurrence.refreshRecurringSetup}
                />

                {ai.aiAssistantEnabled && (
                    <TaskDetailsAI
                        task={task}
                        aiInsightsRef={ai.aiInsightsRef}
                        project={ai.project}
                        onActiveChange={ai.setAiInsightsActive}
                    />
                )}

                <div className="mb-6 mt-6">
                    {activePill === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-3 space-y-8">
                                <TaskDetailsSubtasksSection
                                    task={task}
                                    pendingSubtasks={pendingSubtasks}
                                    onSubtasksChange={setPendingSubtasks}
                                    onSave={handleSaveSubtasks}
                                    content={task.note || ''}
                                    onContentUpdate={handleContentUpdate}
                                />
                                <TaskDetailsRecurrenceSectionComponent
                                    task={task}
                                    parentTask={recurrence.parentTask}
                                    loadingParent={recurrence.loadingParent}
                                    isEditing={recurrence.isEditingRecurrence}
                                    recurrenceForm={recurrence.recurrenceForm}
                                    onStartEdit={recurrence.handleStartRecurrenceEdit}
                                    onChange={recurrence.handleRecurrenceChange}
                                    onSave={recurrence.handleSaveRecurrence}
                                    onCancel={recurrence.handleCancelRecurrenceEdit}
                                    loadingIterations={recurrence.loadingIterations}
                                    nextIterations={recurrence.nextIterations}
                                    canEdit={!task.recurring_parent_id}
                                />
                            </div>

                            <div className="space-y-6">
                                <TaskDetailsPeople
                                    task={task}
                                    projects={projectsStore.projects}
                                    areas={areasStore.areas}
                                    onProjectSelect={handleProjectSelection}
                                    onProjectClear={handleClearProject}
                                    onProjectCreate={handleProjectCreateInline}
                                    onAreaSelect={handleAreaSelection}
                                    onAreaClear={handleClearArea}
                                    onAssign={handleAssignPerson}
                                />

                                <TaskDetailsTags
                                    task={task}
                                    availableTags={tagsStore.tags}
                                    hasLoadedTags={tagsStore.hasLoaded}
                                    isLoadingTags={tagsStore.isLoading}
                                    onUpdate={handleTagsUpdate}
                                    onLoadTags={() => tagsStore.loadTags()}
                                />

                                <TaskDetailsScheduleSection
                                    task={task}
                                    isEditingDueDate={recurrence.isEditingDueDate}
                                    editedDueDate={recurrence.editedDueDate}
                                    onChangeDueDate={recurrence.setEditedDueDate}
                                    onStartDueDateEdit={recurrence.handleStartDueDateEdit}
                                    onSaveDueDate={recurrence.handleSaveDueDate}
                                    onCancelDueDateEdit={recurrence.handleCancelDueDateEdit}
                                    isEditingDeferUntil={recurrence.isEditingDeferUntil}
                                    editedDeferUntil={recurrence.editedDeferUntil}
                                    onChangeDeferUntil={recurrence.setEditedDeferUntil}
                                    onStartDeferUntilEdit={recurrence.handleStartDeferUntilEdit}
                                    onSaveDeferUntil={recurrence.handleSaveDeferUntil}
                                    onCancelDeferUntilEdit={recurrence.handleCancelDeferUntilEdit}
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
            </div>
        </div>
    );
};

export default TaskDetails;
