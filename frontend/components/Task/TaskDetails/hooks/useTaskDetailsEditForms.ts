import { useEffect, useState } from 'react';
import { Task, RecurrenceType } from '../../../../entities/Task';
import {
    RecurrenceFormState,
    buildRecurrenceFormFromTask,
} from './useTaskDetailsRecurrenceData';

export type RecurrenceFormField = keyof RecurrenceFormState;

export const useTaskDetailsEditForms = (task: Task | undefined) => {
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);
    const [editedDueDate, setEditedDueDate] = useState<string>(
        task?.due_date || ''
    );
    const [isEditingDeferUntil, setIsEditingDeferUntil] = useState(false);
    const [editedDeferUntil, setEditedDeferUntil] = useState<string>(
        task?.defer_until || ''
    );
    const [isEditingRecurrence, setIsEditingRecurrence] = useState(false);
    const [recurrenceForm, setRecurrenceForm] = useState<RecurrenceFormState>(
        buildRecurrenceFormFromTask(task)
    );

    useEffect(() => {
        setEditedDueDate(task?.due_date || '');
    }, [task?.due_date]);

    useEffect(() => {
        setRecurrenceForm(buildRecurrenceFormFromTask(task));
    }, [
        task?.recurrence_type,
        task?.recurrence_interval,
        task?.recurrence_end_date,
        task?.recurrence_weekday,
        task?.recurrence_weekdays,
        task?.recurrence_month_day,
        task?.recurrence_week_of_month,
        task?.completion_based,
        task,
    ]);

    const handleRecurrenceChange = (
        field: string,
        value: RecurrenceFormState[RecurrenceFormField] | RecurrenceType | number | boolean | number[] | null | string
    ) => {
        setRecurrenceForm((prev) => {
            const updated = { ...prev, [field]: value };

            if (
                field === 'recurrence_type' &&
                value === 'monthly' &&
                !prev.recurrence_month_day
            ) {
                updated.recurrence_month_day = new Date().getDate();
            }

            return updated;
        });
    };

    const handleStartRecurrenceEdit = () => {
        setRecurrenceForm(buildRecurrenceFormFromTask(task));
        setIsEditingRecurrence(true);
    };

    const handleCancelRecurrenceEdit = () => {
        setIsEditingRecurrence(false);
        setRecurrenceForm(buildRecurrenceFormFromTask(task));
    };

    const handleStartDueDateEdit = () => {
        setEditedDueDate(task?.due_date || '');
        setIsEditingDueDate(true);
    };

    const handleCancelDueDateEdit = () => {
        setIsEditingDueDate(false);
        setEditedDueDate(task?.due_date || '');
    };

    const handleStartDeferUntilEdit = () => {
        setEditedDeferUntil(task?.defer_until || '');
        setIsEditingDeferUntil(true);
    };

    const handleCancelDeferUntilEdit = () => {
        setIsEditingDeferUntil(false);
        setEditedDeferUntil(task?.defer_until || '');
    };

    return {
        isEditingDueDate,
        setIsEditingDueDate,
        editedDueDate,
        setEditedDueDate,
        isEditingDeferUntil,
        setIsEditingDeferUntil,
        editedDeferUntil,
        setEditedDeferUntil,
        isEditingRecurrence,
        setIsEditingRecurrence,
        recurrenceForm,
        setRecurrenceForm,
        handleRecurrenceChange,
        handleStartRecurrenceEdit,
        handleCancelRecurrenceEdit,
        handleStartDueDateEdit,
        handleCancelDueDateEdit,
        handleStartDeferUntilEdit,
        handleCancelDeferUntilEdit,
    };
};
