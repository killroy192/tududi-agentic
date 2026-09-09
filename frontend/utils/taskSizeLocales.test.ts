import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.join(__dirname, '../../public/locales');

const REQUIRED_SIZE_KEYS = [
    'size.none',
    'size.label',
    'size.placeholder',
    'size.unset',
    'size.currentValue',
    'task.sizeUpdated',
    'task.sizeUpdateError',
    'timeline.events.size',
    'timeline.events.sizeChanged',
    'errors.permissionDenied',
];

const getNested = (obj: any, dotted: string) =>
    dotted.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

describe('task size locale keys (AC-27)', () => {
    const localeDirs = fs
        .readdirSync(LOCALES_DIR)
        .filter((name) =>
            fs.statSync(path.join(LOCALES_DIR, name)).isDirectory()
        );

    it('covers all twenty-five locale files', () => {
        expect(localeDirs).toHaveLength(25);
    });

    it.each(localeDirs)(
        '%s contains the complete size key set',
        (locale) => {
            const translation = JSON.parse(
                fs.readFileSync(
                    path.join(LOCALES_DIR, locale, 'translation.json'),
                    'utf8'
                )
            );
            for (const key of REQUIRED_SIZE_KEYS) {
                expect(getNested(translation, key)).toBeTruthy();
            }
        }
    );
});
