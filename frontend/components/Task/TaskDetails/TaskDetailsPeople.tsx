import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    ArrowRightIcon,
    FolderIcon,
    RectangleStackIcon,
    XMarkIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import ProjectDropdown from '../../Shared/ProjectDropdown';
import PersonDropdown from '../../Shared/PersonDropdown';
import { Project } from '../../../entities/Project';
import { Area } from '../../../entities/Area';
import { Task } from '../../../entities/Task';
import { Person } from '../../../entities/Person';
import {
    updateTask,
    fetchTaskByUid,
} from '../../../utils/tasksService';
import { createProject } from '../../../utils/projectsService';
import { fetchPeople } from '../../../utils/peopleService';
import { useStore } from '../../../store/useStore';
import { useToast } from '../../Shared/ToastContext';
import { getProjectLink } from './TaskDetailsHeader';

/* ------------------------------------------------------------------ */
/*  Area link builder                                                 */
/* ------------------------------------------------------------------ */

export const getAreaLink = (area: Area): string => {
    if (area.uid) {
        const slug = area.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `/area/${area.uid}-${slug}`;
    }
    return `/area/${area.id}`;
};

/* ------------------------------------------------------------------ */
/*  useTaskDetailsPeople hook                                         */
/* ------------------------------------------------------------------ */

interface PeopleArgs {
    task: Task | undefined;
    uid: string | undefined;
    markModified: () => void;
    bumpTimeline: () => void;
    projectsStore: {
        projects: Project[];
        setProjects: (projects: Project[]) => void;
    };
    areasStore: {
        areas: Area[];
        hasLoaded: boolean;
        isLoading: boolean;
        loadAreas: () => Promise<void>;
    };
}

export const useTaskDetailsPeople = ({
    task,
    uid,
    markModified,
    bumpTimeline,
    areasStore,
}: PeopleArgs) => {
    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    // Load areas if not loaded
    useEffect(() => {
        if (!areasStore.hasLoaded && !areasStore.isLoading) {
            areasStore.loadAreas();
        }
    }, [areasStore.hasLoaded, areasStore.isLoading]);

    const handleProjectSelection = useCallback(
        async (project: Project) => {
            if (!task?.uid) return;
            try {
                markModified();
                await updateTask(task.uid, { project_id: project.id });
                if (uid) {
                    const updatedTask = await fetchTaskByUid(uid);
                    const store = useStore.getState();
                    const existingIndex = store.tasksStore.tasks.findIndex(
                        (t: Task) => t.uid === uid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...store.tasksStore.tasks];
                        updatedTasks[existingIndex] = updatedTask;
                        store.tasksStore.setTasks(updatedTasks);
                    }
                }
                showSuccessToast(t('task.projectUpdated', 'Project updated successfully'));
                bumpTimeline();
            } catch (error) {
                console.error('Error updating project:', error);
                showErrorToast(t('task.projectUpdateError', 'Failed to update project'));
            }
        },
        [task?.uid, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]
    );

    const handleClearProject = useCallback(async () => {
        if (!task?.uid) return;
        try {
            markModified();
            await updateTask(task.uid, { project_id: null });
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const store = useStore.getState();
                const existingIndex = store.tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...store.tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    store.tasksStore.setTasks(updatedTasks);
                }
            }
            showSuccessToast(t('task.projectCleared', 'Project cleared successfully'));
            bumpTimeline();
        } catch (error) {
            console.error('Error clearing project:', error);
            showErrorToast(t('task.projectClearError', 'Failed to clear project'));
        }
    }, [task?.uid, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]);

    const handleProjectCreateInline = useCallback(
        async (name: string) => {
            if (!task?.uid || !name.trim()) return;
            try {
                markModified();
                const newProject = await createProject({ name });
                const store = useStore.getState();
                store.projectsStore.setProjects([...store.projectsStore.projects, newProject]);
                await updateTask(task.uid, { project_id: newProject.id });
                if (uid) {
                    const updatedTask = await fetchTaskByUid(uid);
                    const existingIndex = store.tasksStore.tasks.findIndex(
                        (t: Task) => t.uid === uid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...store.tasksStore.tasks];
                        updatedTasks[existingIndex] = updatedTask;
                        store.tasksStore.setTasks(updatedTasks);
                    }
                }
                showSuccessToast(t('project.createdAndAssigned', 'Project created and assigned'));
                bumpTimeline();
            } catch (error) {
                console.error('Error creating project:', error);
                showErrorToast(t('project.createError', 'Failed to create project'));
                throw error;
            }
        },
        [task?.uid, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]
    );

    const handleAreaSelection = useCallback(
        async (area: Area) => {
            if (!task?.uid) return;
            try {
                markModified();
                await updateTask(task.uid, { area_id: area.id });
                if (uid) {
                    const updatedTask = await fetchTaskByUid(uid);
                    const store = useStore.getState();
                    store.tasksStore.updateTaskInStore(updatedTask);
                }
                showSuccessToast(t('task.areaUpdated', 'Area updated successfully'));
                bumpTimeline();
            } catch (error) {
                console.error('Error updating area:', error);
                showErrorToast(t('task.areaUpdateError', 'Failed to update area'));
            }
        },
        [task?.uid, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]
    );

    const handleClearArea = useCallback(async () => {
        if (!task?.uid) return;
        try {
            markModified();
            await updateTask(task.uid, { area_id: null });
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const store = useStore.getState();
                store.tasksStore.updateTaskInStore(updatedTask);
            }
            showSuccessToast(t('task.areaCleared', 'Area cleared successfully'));
            bumpTimeline();
        } catch (error) {
            console.error('Error clearing area:', error);
            showErrorToast(t('task.areaClearError', 'Failed to clear area'));
        }
    }, [task?.uid, uid, markModified, bumpTimeline, showSuccessToast, showErrorToast, t]);

    const handleAssignPerson = useCallback(
        async (personUid: string | null) => {
            if (!task?.uid) return;
            try {
                markModified();
                await updateTask(task.uid, { assigned_to: personUid });
                if (uid) {
                    const updatedTask = await fetchTaskByUid(uid);
                    const store = useStore.getState();
                    store.tasksStore.updateTaskInStore(updatedTask);
                }
            } catch (error) {
                console.error('Error assigning person:', error);
                showErrorToast('Failed to update assignment');
            }
        },
        [task?.uid, uid, markModified, showErrorToast]
    );

    return {
        handleProjectSelection,
        handleClearProject,
        handleProjectCreateInline,
        handleAreaSelection,
        handleClearArea,
        handleAssignPerson,
    };
};

/* ------------------------------------------------------------------ */
/*  TaskDetailsPeople component                                       */
/* ------------------------------------------------------------------ */

interface TaskDetailsPeopleProps {
    task: Task;
    projects: Project[];
    areas: Area[];
    onProjectSelect: (project: Project) => Promise<void>;
    onProjectClear: () => Promise<void>;
    onProjectCreate: (name: string) => Promise<void>;
    onAreaSelect: (area: Area) => Promise<void>;
    onAreaClear: () => Promise<void>;
    onAssign: (personUid: string | null) => Promise<void>;
}

const TaskDetailsPeople: React.FC<TaskDetailsPeopleProps> = ({
    task,
    projects,
    areas,
    onProjectSelect,
    onProjectClear,
    onProjectCreate,
    onAreaSelect,
    onAreaClear,
    onAssign,
}) => {
    return (
        <>
            <TaskProjectSection
                task={task}
                projects={projects}
                onProjectSelect={onProjectSelect}
                onProjectClear={onProjectClear}
                onProjectCreate={onProjectCreate}
            />
            <TaskAreaSection
                task={task}
                areas={areas}
                onAreaSelect={onAreaSelect}
                onAreaClear={onAreaClear}
            />
            <TaskAssignedToSection task={task} onAssign={onAssign} />
        </>
    );
};

/* ------------------------------------------------------------------ */
/*  TaskProjectSection                                                */
/* ------------------------------------------------------------------ */

interface TaskProjectSectionProps {
    task: Task;
    projects: Project[];
    onProjectSelect: (project: Project) => Promise<void>;
    onProjectClear: () => Promise<void>;
    onProjectCreate: (name: string) => Promise<void>;
}

const TaskProjectSection: React.FC<TaskProjectSectionProps> = ({
    task,
    projects,
    onProjectSelect,
    onProjectClear,
    onProjectCreate,
}) => {
    const { t } = useTranslation();
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                projectDropdownOpen &&
                projectDropdownRef.current &&
                !projectDropdownRef.current.contains(e.target as Node)
            ) {
                setProjectDropdownOpen(false);
                setProjectName('');
            }
        };

        if (projectDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [projectDropdownOpen]);

    const handleProjectSearch = (query: string) => {
        setProjectName(query);
        const filtered = projects.filter((p) =>
            p.name.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredProjects(filtered);
    };

    const handleProjectSelection = async (project: Project) => {
        await onProjectSelect(project);
        setProjectDropdownOpen(false);
        setProjectName('');
    };

    const handleClearProject = async () => {
        await onProjectClear();
        setProjectDropdownOpen(false);
        setProjectName('');
    };

    const handleCreateProjectInline = async (name: string) => {
        setIsCreatingProject(true);
        try {
            await onProjectCreate(name);
            setProjectDropdownOpen(false);
            setProjectName('');
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleShowAllProjects = () => {
        setFilteredProjects(projects);
    };

    const containerClasses = [
        'rounded-lg',
        'shadow-sm',
        'bg-white',
        'dark:bg-gray-900',
        'border-2',
        'border-gray-50',
        'dark:border-gray-800',
        'hover:border-gray-200',
        'dark:hover:border-gray-700',
        'transition-colors',
    ];

    return (
        <div ref={projectDropdownRef} className="space-y-2">
            <div className={containerClasses.join(' ')}>
                {projectDropdownOpen ? (
                    <ProjectDropdown
                        projectName={projectName}
                        onProjectSearch={handleProjectSearch}
                        dropdownOpen={projectDropdownOpen}
                        filteredProjects={filteredProjects}
                        onProjectSelection={handleProjectSelection}
                        onCreateProject={handleCreateProjectInline}
                        isCreatingProject={isCreatingProject}
                        onShowAllProjects={handleShowAllProjects}
                        allProjects={projects}
                        selectedProject={task.Project || null}
                        onClearProject={handleClearProject}
                    />
                ) : task.Project ? (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm relative overflow-hidden">
                        <div
                            className="flex items-center justify-center overflow-hidden relative hover:opacity-90 transition-opacity cursor-pointer"
                            style={{ height: '100px' }}
                            onClick={() => setProjectDropdownOpen(true)}
                        >
                            {task.Project.image_url ? (
                                <img
                                    src={task.Project.image_url}
                                    alt={task.Project.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700"></div>
                            )}
                        </div>
                        <div className="p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div
                                    className="text-md font-semibold text-gray-900 dark:text-gray-100 truncate cursor-pointer flex-1"
                                    onClick={() => setProjectDropdownOpen(true)}
                                >
                                    {task.Project.name}
                                </div>
                                <Link
                                    to={getProjectLink(task.Project)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0"
                                    title={t(
                                        'project.viewProject',
                                        'Go to project'
                                    )}
                                >
                                    <ArrowRightIcon className="h-4 w-4" />
                                    <span className="sr-only">
                                        {t(
                                            'project.viewProject',
                                            'Go to project'
                                        )}
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => setProjectDropdownOpen(true)}
                        className="rounded-lg shadow-sm bg-white dark:bg-gray-900 p-6 cursor-pointer transition-colors"
                    >
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <FolderIcon className="h-12 w-12 mb-3 opacity-50" />
                            <span className="text-sm text-center">
                                {t('task.noProject', 'Assign to a project')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  TaskAreaSection                                                   */
/* ------------------------------------------------------------------ */

interface TaskAreaSectionProps {
    task: Task;
    areas: Area[];
    onAreaSelect: (area: Area) => Promise<void>;
    onAreaClear: () => Promise<void>;
}

const TaskAreaSection: React.FC<TaskAreaSectionProps> = ({
    task,
    areas,
    onAreaSelect,
    onAreaClear,
}) => {
    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const effectiveArea: Area | null = task.Area || task.Project?.Area || null;
    const isInherited = !task.Area && !!task.Project?.area_id;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setDropdownOpen(false);
                setSearchQuery('');
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [dropdownOpen]);

    const filteredAreas = areas.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = async (area: Area) => {
        await onAreaSelect(area);
        setDropdownOpen(false);
        setSearchQuery('');
    };

    const handleClear = async () => {
        await onAreaClear();
        setDropdownOpen(false);
        setSearchQuery('');
    };

    if (task.Project) {
        if (!effectiveArea) return null;
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
                            style={effectiveArea.color ? { backgroundColor: effectiveArea.color, borderColor: effectiveArea.color } : {}}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {effectiveArea.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {t('area.viaProject', 'via project')}
                        </span>
                    </div>
                    {effectiveArea.uid && (
                        <Link
                            to={getAreaLink(effectiveArea)}
                            className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0"
                            title={t('area.viewArea', 'Go to area')}
                        >
                            <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="space-y-2">
            {dropdownOpen ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800">
                    <div className="p-3">
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('area.searchAreas', 'Search areas…')}
                            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                            {effectiveArea && (
                                <button
                                    onClick={handleClear}
                                    className="w-full text-left text-sm px-3 py-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                    {t('area.clearArea', 'Remove area')}
                                </button>
                            )}
                            {filteredAreas.length === 0 ? (
                                <div className="text-sm text-gray-400 dark:text-gray-500 px-3 py-2">
                                    {t('area.noAreasFound', 'No areas found')}
                                </div>
                            ) : (
                                filteredAreas.map((area) => (
                                    <button
                                        key={area.id}
                                        onClick={() => handleSelect(area)}
                                        className="w-full text-left text-sm px-3 py-1.5 rounded text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                    >
                                        <span
                                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
                                            style={area.color ? { backgroundColor: area.color, borderColor: area.color } : {}}
                                        />
                                        {area.name}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : effectiveArea ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div
                            className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                            onClick={() => !isInherited && setDropdownOpen(true)}
                        >
                            <span
                                className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
                                style={effectiveArea.color ? { backgroundColor: effectiveArea.color, borderColor: effectiveArea.color } : {}}
                            />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {effectiveArea.name}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {effectiveArea.uid && (
                                <Link
                                    to={getAreaLink(effectiveArea)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title={t('area.viewArea', 'Go to area')}
                                >
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            )}
                            <button
                                onClick={handleClear}
                                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title={t('area.clearArea', 'Remove area')}
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setDropdownOpen(true)}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                >
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <RectangleStackIcon className="h-12 w-12 mb-3 opacity-50" />
                        <span className="text-sm text-center">
                            {t('task.noArea', 'Assign to an area')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  TaskAssignedToSection                                             */
/* ------------------------------------------------------------------ */

interface TaskAssignedToSectionProps {
    task: Task;
    onAssign: (personUid: string | null) => Promise<void>;
}

const TaskAssignedToSection: React.FC<TaskAssignedToSectionProps> = ({ task, onAssign }) => {
    const [people, setPeople] = useState<Person[]>([]);

    useEffect(() => {
        fetchPeople().catch(console.error).then((p) => {
            if (p) setPeople(p);
        });
    }, []);

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <UserIcon className="w-3.5 h-3.5" />
                Assigned To
            </div>
            <PersonDropdown
                personUid={task.assigned_to ?? null}
                people={people}
                onChange={onAssign}
            />
        </div>
    );
};

export default TaskDetailsPeople;
