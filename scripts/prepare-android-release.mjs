import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const versionCodePattern = /^(\s*versionCode\s+)\d+(\s*)$/m
const versionNamePattern = /^(\s*versionName\s+)(["'])([^"']+)(["']\s*)$/m

const parseVersion = (value) => {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value) ||
      !value.split('.').every((part) => Number.isSafeInteger(Number(part)))) {
    throw new Error('A versão publicada deve seguir o formato X.Y.Z.')
  }
  return value.split('.').map(Number)
}

export function prepareAndroidRelease(buildGradle, published) {
  const versionCodeMatch = buildGradle.match(versionCodePattern)
  const versionNameMatch = buildGradle.match(versionNamePattern)
  if (!versionCodeMatch || !versionNameMatch) {
    throw new Error('Não foi possível ler versionCode e versionName de apk/app/build.gradle.')
  }

  if (published === null) {
    return { buildGradle, versionCode: Number(versionCodeMatch[0].match(/\d+/)?.[0]), version: versionNameMatch[3] }
  }
  if (!published || !Number.isSafeInteger(published.versionCode) || published.versionCode < 1) {
    throw new Error('O manifesto publicado contém um versionCode inválido.')
  }

  const [major, minor, patch] = parseVersion(published.version)
  const versionCode = published.versionCode + 1
  const version = `${major}.${minor}.${patch + 1}`
  if (!Number.isSafeInteger(versionCode) || versionCode > 2147483647 || !Number.isSafeInteger(patch + 1)) {
    throw new Error('Não foi possível incrementar a versão Android publicada.')
  }

  const updatedBuildGradle = buildGradle
    .replace(versionCodePattern, (_, prefix, suffix) => `${prefix}${versionCode}${suffix}`)
    .replace(versionNamePattern, (_, prefix, quote, _current, suffix) => `${prefix}${quote}${version}${suffix}`)

  return { buildGradle: updatedBuildGradle, versionCode, version }
}

function prepareRepositoryRelease(buildGradlePath, manifestPath) {
  const buildGradle = readFileSync(buildGradlePath, 'utf8')
  const published = manifestPath === '-' ? null : JSON.parse(readFileSync(manifestPath, 'utf8'))
  const release = prepareAndroidRelease(buildGradle, published)
  writeFileSync(buildGradlePath, release.buildGradle, 'utf8')
  console.log(`Versão Android preparada: ${release.version} (versionCode ${release.versionCode}).`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , buildGradlePath, manifestPath] = process.argv
  if (!buildGradlePath || !manifestPath) {
    console.error('Uso: node scripts/prepare-android-release.mjs <build.gradle> <manifesto publicado ou ->')
    process.exitCode = 1
  } else {
    try {
      prepareRepositoryRelease(buildGradlePath, manifestPath)
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Falha ao preparar a versão Android.')
      process.exitCode = 1
    }
  }
}
