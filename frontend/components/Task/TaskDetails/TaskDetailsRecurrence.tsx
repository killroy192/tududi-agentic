import React from 'react';
import { Task } from '../../../entities/Task';
import TaskRecurrenceCard from './TaskRecurrenceCard';
import { TaskDetailsRecurrenceState } from './hooks/useTaskDetailsRecurrence';

interface TaskDetailsRecurrenceProps {
    task: Task;
    recurrence: TaskDetailsRecurrenceState;
}

/** Recurrence section of the task details Overview tab. State comes from `useTaskDetailsRecurrence`. */
const TaskDetailsRecurrence: React.FC<TaskDetailsRecurrenceProps> = ({
    task,
    recurrence,
}) => (
    <TaskRecurrenceCard
        task={task}
        parentTask={recurrence.parentTask}
        loadingParent={recurrence.loadingParent}
        isEditing={recurrence.isEditing}
        recurrenceForm={recurrence.recurrenceForm}
        onStartEdit={recurrence.handleStartEdit}
        onChange={recurrence.handleChange}
        onSave={recurrence.handleSave}
        onCancel={recurrence.handleCancel}
        loadingIterations={recurrence.loadingIterations}
        nextIterations={recurrence.nextIterations}
        canEdit={!task.recurring_parent_id}
    />
);

export default TaskDetailsRecurrence;
