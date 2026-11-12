import { getAreaLink, getProjectLink, getTagLink } from '../taskDetailsLinks';

describe('taskDetailsLinks', () => {
    it('builds project links from uid and slug, falling back to id', () => {
        expect(getProjectLink({ uid: 'p1', name: '  My Project! ' })).toBe(
            '/project/p1-my-project'
        );
        expect(getProjectLink({ id: 7, name: 'Ignored' })).toBe('/project/7');
    });

    it('builds area links from uid and slug, falling back to id', () => {
        expect(getAreaLink({ uid: 'a1', name: 'Work & Life' })).toBe(
            '/area/a1-work-life'
        );
        expect(getAreaLink({ id: 3, name: 'Ignored' })).toBe('/area/3');
    });

    it('builds tag links from uid and slug, falling back to the encoded name', () => {
        expect(getTagLink({ uid: 't1', name: 'Deep Work' })).toBe(
            '/tag/t1-deep-work'
        );
        expect(getTagLink({ name: 'a/b c' })).toBe('/tag/a%2Fb%20c');
    });
});
