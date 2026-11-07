import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAndroidVersion, validateAndroidRelease } from './check-android-release-version.mjs'

test('reads Android version from Gradle', () => {
  assert.deepEqual(
    parseAndroidVersion('versionCode 4\nversionName "1.2.0"'),
    { versionCode: 4, version: '1.2.0' },
  )
})

test('accepts a version increase in both Android version fields', () => {
  assert.doesNotThrow(() => validateAndroidRelease(
    { versionCode: 2, version: '1.0.1' },
    { versionCode: 1, version: '1.0.0' },
  ))
})

test('rejects a release that does not increase both Android version fields', () => {
  assert.throws(
    () => validateAndroidRelease(
      { versionCode: 2, version: '1.0.0' },
      { versionCode: 1, version: '1.0.0' },
    ),
    /deve ser superior/,
  )
  assert.throws(
    () => validateAndroidRelease(
      { versionCode: 1, version: '1.0.1' },
      { versionCode: 1, version: '1.0.0' },
    ),
    /deve ser superior/,
  )
})
