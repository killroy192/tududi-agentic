import { Project } from '../../../entities/Project';
import { Tag } from '../../../entities/Tag';
import { Area } from '../../../entities/Area';

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export function getProjectLink(project: Project): string {
    if (project.uid) {
        return `/project/${project.uid}-${slugify(project.name)}`;
    }
    return `/project/${project.id}`;
}

export function getTagLink(tag: Tag): string {
    if (tag.uid) {
        return `/tag/${tag.uid}-${slugify(tag.name)}`;
    }
    return `/tag/${encodeURIComponent(tag.name)}`;
}

export function getAreaLink(area: Area): string {
    if (area.uid) {
        return `/area/${area.uid}-${slugify(area.name)}`;
    }
    return `/area/${area.id}`;
}
