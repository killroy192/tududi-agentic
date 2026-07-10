import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    LinkIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Task, TaskDependencyRef } from '../../../entities/Task';
import { TaskDependencyRelationship } from '../../../utils/tasksService';
import { searchUniversal, SearchResult } from '../../../utils/searchService';
import { getStatusLabel, isTaskDone } from '../../../constants/taskStatus';

interface TaskDependenciesCardProps {
    task: Task;
    blockers: TaskDependencyRef[];
    blocking: TaskDependencyRef[];
    onAddDependency: (
        targetTaskUid: string,
        relationship: TaskDependencyRelationship
    ) => Promise<void>;
    onRemoveDependency: (
        targetTaskUid: string,
        relationship: TaskDependencyRelationship
    ) => Promise<void>;
}

const getTaskLink = (taskRef: TaskDependencyRef) => {
    const slug = taskRef.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `/task/${taskRef.uid}${slug ? `-${slug}` : ''}`;
};

const DependencyRow: React.FC<{
    dependency: TaskDependencyRef;
    onRemove: () => void;
}> = ({ dependency, onRemove }) => {
    const { t } = useTranslation();
    const done = isTaskDone(dependency.status);

    return (
        <div className="flex items-center justify-between gap-2 py-1.5">
            <Link
                to={getTaskLink(dependency)}
                className="flex items-center gap-2 min-w-0 flex-1 group"
            >
                <span
                    className={`text-sm truncate ${
                        done
                            ? 'text-gray-400 dark:text-gray-500 line-through'
                            : 'text-gray-800 dark:text-gray-200'
                    } group-hover:text-blue-600 dark:group-hover:text-blue-400`}
                >
                    {dependency.name}
                </span>
                <span
                    className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        done
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                >
                    {getStatusLabel(dependency.status)}
                </span>
            </Link>
            <button
                type="button"
                onClick={onRemove}
                className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                title={t('task.dependencies.remove', 'Remove dependency')}
            >
                <XMarkIcon className="h-4 w-4" />
            </button>
        </div>
    );
};

const TaskDependenciesCard: React.FC<TaskDependenciesCardProps> = ({
    task,
    blockers,
    blocking,
    onAddDependency,
    onRemoveDependency,
}) => {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<
        'blockers' | 'blocking' | null
    >(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const isRecurringTemplate =
        !!task.recurrence_type &&
        task.recurrence_type !== 'none' &&
        !task.recurring_parent_id;

    const existingUids = new Set([
        task.uid,
        ...blockers.map((b) => b.uid),
        ...blocking.map((b) => b.uid),
    ]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setActiveSection(null);
                setSearchQuery('');
                setSearchResults([]);
            }
        };

        if (activeSection) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [activeSection]);

    useEffect(() => {
        if (!activeSection || !searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        let cancelled = false;
        setIsSearching(true);

        const timeout = setTimeout(async () => {
            try {
                const { results } = await searchUniversal({
                    query: searchQuery.trim(),
                    filters: ['Task'],
                    limit: 10,
                });
                if (!cancelled) {
                    setSearchResults(
                        results.filter(
                            (r) => r.uid && !existingUids.has(r.uid)
                        )
                    );
                }
            } catch (error) {
                if (!cancelled) {
                    setSearchResults([]);
                }
            } finally {
                if (!cancelled) {
                    setIsSearching(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, activeSection]);

    const handleSelectResult = async (result: SearchResult) => {
        if (!result.uid || !activeSection) return;
        setIsSubmitting(true);
        try {
            const relationship: TaskDependencyRelationship =
                activeSection === 'blockers' ? 'blocked_by' : 'blocks';
            await onAddDependency(result.uid, relationship);
        } finally {
            setIsSubmitting(false);
            setActiveSection(null);
            setSearchQuery('');
            setSearchResults([]);
        }
    };

    const handleRemove = async (
        targetUid: string,
        relationship: TaskDependencyRelationship
    ) => {
        await onRemoveDependency(targetUid, relationship);
    };

    const renderAddControl = (section: 'blockers' | 'blocking') => {
        if (activeSection !== section) {
            return (
                <button
                    type="button"
                    onClick={() => setActiveSection(section)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {section === 'blockers'
                        ? t('task.dependencies.addBlocker', 'Add blocker')
                        : t('task.dependencies.addBlocking', 'Add task')}
                </button>
            );
        }

        return (
            <div className="mt-2">
                <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t(
                        'task.dependencies.searchPlaceholder',
                        'Search tasks…'
                    )}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery.trim() && (
                    <div className="mt-1 max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-md">
                        {isSearching ? (
                            <div className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
                                {t('common.loading', 'Loading…')}
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
                                {t(
                                    'task.dependencies.noMatches',
                                    'No matching tasks'
                                )}
                            </div>
                        ) : (
                            searchResults.map((result) => (
                                <button
                                    key={result.uid}
                                    type="button"
                                    onClick={() => handleSelectResult(result)}
                                    className="block w-full text-left text-sm px-3 py-1.5 truncate text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    {result.name || result.title}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6"
        >
            <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t('task.dependencies.title', 'Dependencies')}
                </h3>
            </div>

            {!isRecurringTemplate && (
                <div className="mb-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        {t('task.dependencies.blockedBy', 'Blocked by')}
                    </div>
                    {blockers.length === 0 ? (
                        <div className="text-sm text-gray-400 dark:text-gray-500 py-1">
                            {t('task.dependencies.none', 'No dependencies')}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {blockers.map((blocker) => (
                                <DependencyRow
                                    key={blocker.uid}
                                    dependency={blocker}
                                    onRemove={() =>
                                        handleRemove(
                                            blocker.uid,
                                            'blocked_by'
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}
                    <div className="mt-1">
                        {renderAddControl('blockers')}
                    </div>
                </div>
            )}

            <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {t('task.dependencies.blocks', 'Blocks')}
                </div>
                {blocking.length === 0 ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500 py-1">
                        {t('task.dependencies.none', 'No dependencies')}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {blocking.map((blocked) => (
                            <DependencyRow
                                key={blocked.uid}
                                dependency={blocked}
                                onRemove={() =>
                                    handleRemove(blocked.uid, 'blocks')
                                }
                            />
                        ))}
                    </div>
                )}
                <div className="mt-1">{renderAddControl('blocking')}</div>
            </div>
        </div>
    );
};

export default TaskDependenciesCard;
