import {
  formatBytes,
  isNewerVersion,
  parseUpdateInfo,
} from '../src/lib/updateInfo';

const HASH = 'a'.repeat(64);

const VALID = {
  versionCode: 12,
  versionName: '1.2.0',
  apkUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/app.apk?alt=media',
  sha256: HASH,
  sizeBytes: 63_697_173,
  notes: '  Faster pairing  ',
  publishedAt: 1_760_000_000_000,
};

describe('update metadata', () => {
  it('accepts a complete record', () => {
    expect(parseUpdateInfo(VALID)).toEqual({
      ...VALID,
      notes: 'Faster pairing',
      sha256: HASH,
    });
  });

  it('rejects records that could install the wrong file', () => {
    expect(parseUpdateInfo(null)).toBeNull();
    expect(parseUpdateInfo('update')).toBeNull();
    expect(parseUpdateInfo({ ...VALID, versionCode: 0 })).toBeNull();
    expect(parseUpdateInfo({ ...VALID, versionCode: '12' })).toBeNull();
    expect(parseUpdateInfo({ ...VALID, versionName: ' ' })).toBeNull();
    expect(
      parseUpdateInfo({ ...VALID, apkUrl: 'http://example.com/app.apk' }),
    ).toBeNull();
    expect(parseUpdateInfo({ ...VALID, sha256: 'abc' })).toBeNull();
    expect(parseUpdateInfo({ ...VALID, sizeBytes: -1 })).toBeNull();
  });

  it('treats missing optional fields as empty', () => {
    const { notes, publishedAt, ...rest } = VALID;
    expect(notes).toBeDefined();
    expect(publishedAt).toBeDefined();
    expect(parseUpdateInfo(rest)).toMatchObject({ notes: '', publishedAt: null });
  });

  it('only offers builds with a higher version code', () => {
    const parsed = parseUpdateInfo(VALID);
    expect(parsed).not.toBeNull();
    if (!parsed) {
      return;
    }
    expect(isNewerVersion(parsed, 11)).toBe(true);
    expect(isNewerVersion(parsed, 12)).toBe(false);
    expect(isNewerVersion(parsed, 13)).toBe(false);
  });

  it('labels download sizes', () => {
    expect(formatBytes(63_697_173)).toBe('61 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(0)).toBe('0 MB');
  });
});
