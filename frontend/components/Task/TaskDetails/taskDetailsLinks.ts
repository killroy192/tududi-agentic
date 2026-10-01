import { Project } from '../../../entities/Project';
import { Area } from '../../../entities/Area';
import { Tag } from '../../../entities/Tag';

export const getProjectLink = (project: Project): string => {
    if (project.uid) {
        const slug = project.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `/project/${project.uid}-${slug}`;
    }
    return `/project/${project.id}`;
};

export const getTagLink = (tag: Tag): string => {
    if (tag.uid) {
        const slug = tag.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `/tag/${tag.uid}-${slug}`;
    }
    return `/tag/${encodeURIComponent(tag.name)}`;
};

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
