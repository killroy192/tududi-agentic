import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../../public/locales');

const REQUIRED_SIZE_KEYS = [
    'label',
    'labelWithValue',
    'none',
    's',
    'm',
    'l',
    'xl',
];

describe('locale size key parity (AC-27)', () => {
    it('includes the complete size key set in all 25 locale files', () => {
        const localeDirs = fs
            .readdirSync(LOCALES_DIR, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();

        expect(localeDirs).toHaveLength(25);

        const failures: string[] = [];

        for (const locale of localeDirs) {
            const filePath = path.join(LOCALES_DIR, locale, 'translation.json');
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const size = data.size || {};

            for (const key of REQUIRED_SIZE_KEYS) {
                if (!(key in size)) {
                    failures.push(`${locale}: missing size.${key}`);
                }
            }

            const events = data.timeline?.events || {};
            if (!('size' in events)) {
                failures.push(`${locale}: missing timeline.events.size`);
            }
            if (!('sizeChanged' in events)) {
                failures.push(`${locale}: missing timeline.events.sizeChanged`);
            }
        }

        expect(failures).toEqual([]);
    });
});
