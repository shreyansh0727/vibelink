import {
  bundleApplies,
  isBundleCurrent,
  parseBundleInfo,
} from '../src/lib/bundleInfo';

const valid = {
  id: 'v1.1.1-ab12cd34',
  versionName: '1.1.1',
  url: 'https://firebasestorage.googleapis.com/v0/b/example/o/bundle?alt=media&token=x',
  sha256: 'a'.repeat(64),
  sizeBytes: 1234567,
  minVersionCode: 2,
  maxVersionCode: 3,
  notes: 'New feels',
  publishedAt: 1_700_000_000_000,
};

describe('OTA bundle metadata', () => {
  it('accepts a well-formed published bundle', () => {
    expect(parseBundleInfo(valid)).toEqual(valid);
  });

  it('rejects unsafe ids, non-HTTPS URLs and bad checksums', () => {
    expect(parseBundleInfo({ ...valid, id: '../escape' })).toBeNull();
    expect(parseBundleInfo({ ...valid, id: '' })).toBeNull();
    expect(parseBundleInfo({ ...valid, url: 'http://example.com/b.js' })).toBeNull();
    expect(parseBundleInfo({ ...valid, sha256: 'abc' })).toBeNull();
    expect(parseBundleInfo({ ...valid, sizeBytes: 0 })).toBeNull();
    expect(parseBundleInfo('bundle')).toBeNull();
  });

  it('requires a sane app version range', () => {
    expect(parseBundleInfo({ ...valid, minVersionCode: undefined })).toBeNull();
    expect(parseBundleInfo({ ...valid, maxVersionCode: 1 })).toBeNull();
    expect(
      parseBundleInfo({ ...valid, minVersionCode: '2' }),
    ).toBeNull();
  });

  it('only offers a bundle to the builds it was published for', () => {
    const info = parseBundleInfo(valid);
    expect(info).not.toBeNull();
    if (!info) {
      return;
    }
    expect(bundleApplies(info, 1)).toBe(false);
    expect(bundleApplies(info, 2)).toBe(true);
    expect(bundleApplies(info, 3)).toBe(true);
    expect(bundleApplies(info, 4)).toBe(false);
  });

  it('treats the running and pending bundles as current', () => {
    const info = parseBundleInfo(valid);
    expect(info).not.toBeNull();
    if (!info) {
      return;
    }
    const empty = {
      runningId: null,
      runningVersion: null,
      pendingId: null,
      pendingVersion: null,
      rejectedId: null,
      rejectedVersion: null,
    };
    expect(isBundleCurrent(info, empty)).toBe(false);
    expect(isBundleCurrent(info, { ...empty, runningId: info.id })).toBe(true);
    expect(isBundleCurrent(info, { ...empty, pendingId: info.id })).toBe(true);
  });
});
