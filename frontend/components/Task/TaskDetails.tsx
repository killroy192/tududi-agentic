import React, { useRef, useState, useCallback } from 'react';
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
    TaskDueDateCard,
    TaskDeferUntilCard,
    TaskDetailsAttachments,
    TaskDetailsPeople,
    TaskDetailsAI,
} from './TaskDetails/';
import type { TaskDetailsAIHandle } from './TaskDetails/TaskDetailsAI';
import { useTaskDetailsRouteLifecycle } from './TaskDetails/hooks/useTaskDetailsRouteLifecycle';
import { useTaskDetailsLoad } from './TaskDetails/hooks/useTaskDetailsLoad';
import { useTaskDetailsStoresBootstrap } from './TaskDetails/hooks/useTaskDetailsStoresBootstrap';
import { useTaskDetailsRecurrenceData } from './TaskDetails/hooks/useTaskDetailsRecurrenceData';
import { useTaskDetailsOverdueUi } from './TaskDetails/hooks/useTaskDetailsOverdueUi';
import { useTaskDetailsEditForms } from './TaskDetails/hooks/useTaskDetailsEditForms';
import { useTaskDetailsActions } from './TaskDetails/hooks/useTaskDetailsActions';

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const isNewTask = location.state?.isNew === true;

    const { markTaskModified } = useTaskDetailsRouteLifecycle(
        uid,
        isNewTask,
        location.pathname
    );

    const {
        task,
        subtasks,
        loading,
        error,
        attachmentCount,
        setAttachmentCount,
        hasLoadedSubtasks,
        setHasLoadedSubtasks,
        pendingSubtasks,
        setPendingSubtasks,
        lastKnownSubtaskCount,
    } = useTaskDetailsLoad(uid);

    const { tagsStore, areasStore, projectsStore } =
        useTaskDetailsStoresBootstrap();

    const {
        nextIterations,
        setNextIterations,
        loadingIterations,
        setLoadingIterations,
        parentTask,
        loadingParent,
    } = useTaskDetailsRecurrenceData(task);

    const {
        isOverdue,
        isPastDue,
        isOverdueBubbleVisible,
        handleOverdueIconClick,
        handleDismissOverdueAlert,
    } = useTaskDetailsOverdueUi(task);

    const editForms = useTaskDetailsEditForms(task);

    const actions = useTaskDetailsActions({
        uid,
        task,
        subtasks,
        hasLoadedSubtasks,
        setHasLoadedSubtasks,
        setPendingSubtasks,
        lastKnownSubtaskCount,
        markTaskModified,
        recurrenceForm: editForms.recurrenceForm,
        setIsEditingRecurrence: editForms.setIsEditingRecurrence,
        editedDueDate: editForms.editedDueDate,
        setIsEditingDueDate: editForms.setIsEditingDueDate,
        setEditedDueDate: editForms.setEditedDueDate,
        editedDeferUntil: editForms.editedDeferUntil,
        setIsEditingDeferUntil: editForms.setIsEditingDeferUntil,
        setEditedDeferUntil: editForms.setEditedDeferUntil,
        parentTask,
        setNextIterations,
        setLoadingIterations,
    });

    const aiAssistantEnabled = useStore(
        (state) => state.userSettingsStore.aiAssistantEnabled
    );
    const aiInsightsRef = useRef<TaskDetailsAIHandle>(null);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);

    const handleAiInsightsClick = useCallback(() => {
        aiInsightsRef.current?.activate();
    }, []);

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
                    onTitleUpdate={actions.handleTitleUpdate}
                    onStatusUpdate={actions.handleStatusUpdate}
                    onPriorityUpdate={actions.handlePriorityUpdate}
                    onSizeUpdate={actions.handleSizeUpdate}
                    onSizeSaved={actions.handleSizeSaved}
                    onDelete={actions.handleDeleteClick}
                    onDuplicate={actions.handleDuplicate}
                    getProjectLink={actions.getProjectLink}
                    getTagLink={actions.getTagLink}
                    activePill={actions.activePill}
                    onPillChange={actions.setActivePill}
                    showOverdueIcon={isOverdue}
                    showPastDueBadge={isPastDue}
                    onOverdueIconClick={handleOverdueIconClick}
                    isOverdueAlertVisible={isOverdue && isOverdueBubbleVisible}
                    onDismissOverdueAlert={handleDismissOverdueAlert}
                    onQuickStatusToggle={actions.handleCompletionToggle}
                    onAiInsightsClick={
                        aiAssistantEnabled ? handleAiInsightsClick : undefined
                    }
                    aiInsightsActive={aiInsightsActive}
                    attachmentCount={attachmentCount}
                    autoEditTitle={isNewTask}
                />

                {aiAssistantEnabled && (
                    <div className="mb-4 mt-6">
                        <TaskDetailsAI
                            ref={aiInsightsRef}
                            task={task}
                            project={
                                projectsStore.projects.find(
                                    (p) => p.id === task.project_id
                                ) || null
                            }
                            onActiveChange={setAiInsightsActive}
                        />
                    </div>
                )}

                <div className="mb-6 mt-6">
                    {actions.activePill === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-3 space-y-8">
                                <TaskContentCard
                                    content={task.note || ''}
                                    onUpdate={actions.handleContentUpdate}
                                />
                                <TaskDetailsSubtasks
                                    task={task}
                                    subtasks={pendingSubtasks}
                                    onSubtasksChange={setPendingSubtasks}
                                    onSave={actions.handleSaveSubtasks}
                                />
                                <TaskDetailsRecurrence
                                    task={task}
                                    parentTask={parentTask}
                                    loadingParent={loadingParent}
                                    isEditing={editForms.isEditingRecurrence}
                                    recurrenceForm={editForms.recurrenceForm}
                                    onStartEdit={editForms.handleStartRecurrenceEdit}
                                    onChange={editForms.handleRecurrenceChange}
                                    onSave={actions.handleSaveRecurrence}
                                    onCancel={editForms.handleCancelRecurrenceEdit}
                                    loadingIterations={loadingIterations}
                                    nextIterations={nextIterations}
                                    canEdit={!task.recurring_parent_id}
                                />
                            </div>

                            <div className="space-y-6">
                                <TaskProjectCard
                                    task={task}
                                    projects={projectsStore.projects}
                                    onProjectSelect={actions.handleProjectSelection}
                                    onProjectClear={actions.handleClearProject}
                                    onProjectCreate={
                                        actions.handleProjectCreateInlineWrapper
                                    }
                                    getProjectLink={actions.getProjectLink}
                                />

                                <TaskAreaCard
                                    task={task}
                                    areas={areasStore.areas}
                                    onAreaSelect={actions.handleAreaSelection}
                                    onAreaClear={actions.handleClearArea}
                                    getAreaLink={actions.getAreaLink}
                                />

                                <TaskDetailsPeople
                                    task={task}
                                    onAssign={actions.handleAssignPerson}
                                />

                                <TaskDetailsTags
                                    task={task}
                                    availableTags={tagsStore.tags}
                                    hasLoadedTags={tagsStore.hasLoaded}
                                    isLoadingTags={tagsStore.isLoading}
                                    onUpdate={actions.handleTagsUpdate}
                                    onLoadTags={() => tagsStore.loadTags()}
                                    getTagLink={actions.getTagLink}
                                />

                                <TaskDueDateCard
                                    task={task}
                                    isEditing={editForms.isEditingDueDate}
                                    editedDueDate={editForms.editedDueDate}
                                    onChangeDate={editForms.setEditedDueDate}
                                    onStartEdit={editForms.handleStartDueDateEdit}
                                    onSave={actions.handleSaveDueDate}
                                    onCancel={editForms.handleCancelDueDateEdit}
                                />

                                <TaskDeferUntilCard
                                    task={task}
                                    isEditing={editForms.isEditingDeferUntil}
                                    editedDeferUntil={editForms.editedDeferUntil}
                                    onChangeDateTime={editForms.setEditedDeferUntil}
                                    onStartEdit={editForms.handleStartDeferUntilEdit}
                                    onSave={actions.handleSaveDeferUntil}
                                    onCancel={editForms.handleCancelDeferUntilEdit}
                                />
                            </div>
                        </div>
                    )}

                    {actions.activePill === 'attachments' && (
                        <div className="grid grid-cols-1">
                            <TaskDetailsAttachments
                                taskUid={task.uid!}
                                onAttachmentsCountChange={setAttachmentCount}
                            />
                        </div>
                    )}

                    {actions.activePill === 'activity' && (
                        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                            <TaskTimeline
                                taskUid={task.uid!}
                                refreshKey={actions.timelineRefreshKey}
                            />
                        </div>
                    )}
                </div>

                {actions.isConfirmDialogOpen && actions.taskToDelete && (
                    <ConfirmDialog
                        title={t('task.deleteConfirmTitle', 'Delete Task')}
                        message={t(
                            'task.deleteConfirmMessage',
                            'Are you sure you want to delete this task? This action cannot be undone.'
                        )}
                        onConfirm={actions.handleDeleteConfirm}
                        onCancel={actions.clearDeleteDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
