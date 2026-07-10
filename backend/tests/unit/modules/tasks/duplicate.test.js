const {
    buildCopyName,
} = require('../../../../modules/tasks/operations/duplicate');

describe('buildCopyName', () => {
    it('appends " (copy)" to a plain name', () => {
        expect(buildCopyName('My task')).toBe('My task (copy)');
    });

    it('does not stack suffix when name already ends with " (copy)"', () => {
        expect(buildCopyName('My task (copy)')).toBe('My task (copy)');
    });

    it('only strips trailing suffix — keeps " (copy)" in the middle', () => {
        expect(buildCopyName('My task (copy) extra')).toBe(
            'My task (copy) extra (copy)'
        );
    });

    it('handles empty string', () => {
        expect(buildCopyName('')).toBe(' (copy)');
    });

    it('handles name that is exactly " (copy)"', () => {
        expect(buildCopyName(' (copy)')).toBe(' (copy)');
    });
});
