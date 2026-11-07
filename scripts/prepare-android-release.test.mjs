import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareAndroidRelease } from './prepare-android-release.mjs'

const buildGradle = 'defaultConfig {\n        versionCode 4\n        versionName "1.2.3"\n    }\n'

test('keeps the initial Android version before the first publication', () => {
  const result = prepareAndroidRelease(buildGradle, null)
  assert.equal(result.versionCode, 4)
  assert.equal(result.version, '1.2.3')
  assert.equal(result.buildGradle, buildGradle)
})

test('increments the published patch version and Android version code', () => {
  const result = prepareAndroidRelease(buildGradle, { versionCode: 8, version: '2.7.9' })
  assert.equal(result.versionCode, 9)
  assert.equal(result.version, '2.7.10')
  assert.match(result.buildGradle, /versionCode 9/)
  assert.match(result.buildGradle, /versionName "2\.7\.10"/)
})

test('rejects invalid published release data or Gradle version declarations', () => {
  assert.throws(() => prepareAndroidRelease(buildGradle, { versionCode: 0, version: '1.0.0' }), /versionCode inválido/)
  assert.throws(() => prepareAndroidRelease(buildGradle, { versionCode: 1, version: 'v1.0.0' }), /formato X\.Y\.Z/)
  assert.throws(() => prepareAndroidRelease('android { }', null), /Não foi possível ler/)
})
