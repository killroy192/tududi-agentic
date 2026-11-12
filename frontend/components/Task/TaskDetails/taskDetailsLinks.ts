import { Project } from '../../../entities/Project';
import { Area } from '../../../entities/Area';
import { Tag } from '../../../entities/Tag';

const slugify = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

/** `/project/<uid>-<slug>`, or `/project/<id>` when the project has no uid. */
export const getProjectLink = (project: Project): string =>
    project.uid
        ? `/project/${project.uid}-${slugify(project.name)}`
        : `/project/${project.id}`;

/** `/area/<uid>-<slug>`, or `/area/<id>` when the area has no uid. */
export const getAreaLink = (area: Area): string =>
    area.uid ? `/area/${area.uid}-${slugify(area.name)}` : `/area/${area.id}`;

/** `/tag/<uid>-<slug>`, or `/tag/<encoded name>` when the tag has no uid. */
export const getTagLink = (tag: Tag): string =>
    tag.uid
        ? `/tag/${tag.uid}-${slugify(tag.name)}`
        : `/tag/${encodeURIComponent(tag.name)}`;
