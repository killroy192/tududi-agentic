import React, { useEffect, useState } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { Person } from '../../../entities/Person';
import { fetchPeople } from '../../../utils/peopleService';
import { updateTask } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';
import PersonDropdown from '../../Shared/PersonDropdown';
import { useTaskDetailsPageContext } from './TaskDetailsPageContext';
import { refetchAndUpdateTaskInStore } from './taskDetailsStoreUpdates';

interface TaskAssignedToCardProps {
    task: Task;
}

const TaskAssignedToCard: React.FC<TaskAssignedToCardProps> = ({ task }) => {
    const { showErrorToast } = useToast();
    const { markModified } = useTaskDetailsPageContext();
    const [people, setPeople] = useState<Person[]>([]);

    useEffect(() => {
        fetchPeople()
            .catch(console.error)
            .then((p) => {
                if (p) setPeople(p);
            });
    }, []);

    const handleAssignPerson = async (personUid: string | null) => {
        if (!task.uid) return;
        try {
            markModified();
            await updateTask(task.uid, { assigned_to: personUid });
            await refetchAndUpdateTaskInStore(task.uid);
        } catch (error) {
            console.error('Error assigning person:', error);
            showErrorToast('Failed to update assignment');
        }
    };

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <UserIcon className="w-3.5 h-3.5" />
                Assigned To
            </div>
            <PersonDropdown
                personUid={task.assigned_to ?? null}
                people={people}
                onChange={handleAssignPerson}
            />
        </div>
    );
};

export default TaskAssignedToCard;
