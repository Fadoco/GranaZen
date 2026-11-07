import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const expectedPackage = 'com.fadoco.granazen'
const apkName = 'GranaZen.apk'
const maxApkBytes = 100 * 1024 * 1024
const [, , candidatePath, previousApkPath, previousManifestPath, outputDirectory] = process.argv

if (!candidatePath || !previousApkPath || !previousManifestPath || !outputDirectory) {
  throw new Error('Uso: node scripts/publish-android-update.mjs <APK candidato> <APK anterior ou -> <manifesto anterior ou -> <pasta de saída>')
}
if ((previousApkPath === '-') !== (previousManifestPath === '-')) {
  throw new Error('Informe tanto o APK quanto o manifesto anteriores, ou use - para ambos.')
}

const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
if (!sdkRoot) throw new Error('ANDROID_HOME ou ANDROID_SDK_ROOT não está configurado.')

const buildToolsDirectory = path.join(sdkRoot, 'build-tools', '36.0.0')
const aaptPath = path.join(buildToolsDirectory, process.platform === 'win32' ? 'aapt.exe' : 'aapt')
const apksignerPath = path.join(buildToolsDirectory, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner')
if (!existsSync(aaptPath) || !existsSync(apksignerPath)) {
  throw new Error('aapt e apksigner não foram encontrados no Android SDK.')
}

const runTool = (toolPath, args, description) => {
  const batchFile = process.platform === 'win32' && toolPath.endsWith('.bat')
  const command = batchFile ? 'java' : toolPath
  const commandArgs = batchFile
    ? ['-jar', path.join(path.dirname(toolPath), 'lib', 'apksigner.jar'), ...args]
    : args
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', maxBuffer: 1024 * 1024 })
  if (result.error) throw new Error(`Não foi possível executar ${description}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim()
    throw new Error(`${description} falhou${detail ? `: ${detail}` : '.'}`)
  }
  return result.stdout
}

const inspectApk = (apkPath, description) => {
  if (!existsSync(apkPath)) throw new Error(`${description} não encontrado: ${apkPath}`)
  const { size } = statSync(apkPath)
  if (size <= 0 || size > maxApkBytes) throw new Error(`${description} vazio ou maior que 100 MB.`)

  const badging = runTool(aaptPath, ['dump', 'badging', apkPath], `Leitura do ${description}`)
  const packageInfo = badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m)
  if (!packageInfo) throw new Error(`Não foi possível ler pacote e versão do ${description}.`)

  const [, packageName, versionCodeValue, version] = packageInfo
  const versionCode = Number(versionCodeValue)
  if (packageName !== expectedPackage) throw new Error(`${description} pertence ao pacote '${packageName}', não ao GranaZen.`)
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2147483647) {
    throw new Error(`${description} tem um versionCode inválido.`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(version) ||
      !version.split('.').every((part) => Number.isSafeInteger(Number(part)))) {
    throw new Error(`${description} deve usar uma versão no formato X.Y.Z.`)
  }

  const signature = runTool(apksignerPath, ['verify', '--verbose', '--print-certs', apkPath], `Verificação da assinatura do ${description}`)
  const digests = [...signature.matchAll(/certificate\s+SHA-256\s+digest:\s*([a-f0-9]{64})/gi)]
    .map((match) => match[1].toLowerCase())
  if (digests.length !== 1) throw new Error(`${description} não possui exatamente um certificado de assinatura verificável.`)

  return {
    version,
    versionCode,
    certificateSha256: digests[0],
    fileSha256: createHash('sha256').update(readFileSync(apkPath)).digest('hex'),
  }
}

const parseVersion = (value) => value.split('.').map(Number)
const isNewerVersion = (candidate, current) => {
  const next = parseVersion(candidate)
  const previous = parseVersion(current)
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== previous[index]) return next[index] > previous[index]
  }
  return false
}

const candidate = inspectApk(candidatePath, 'APK candidato')
if (previousApkPath !== '-') {
  const previous = inspectApk(previousApkPath, 'APK atualmente publicado')
  let previousManifest
  try {
    previousManifest = JSON.parse(readFileSync(previousManifestPath, 'utf8'))
  } catch (error) {
    throw new Error(`Não foi possível ler o manifesto atualmente publicado: ${error.message}`)
  }

  if (!previousManifest || previousManifest.version !== previous.version ||
      previousManifest.versionCode !== previous.versionCode ||
      previousManifest.url !== `https://fadoco.github.io/GranaZen/updates/${apkName}?v=${previous.versionCode}` ||
      typeof previousManifest.sha256 !== 'string' ||
      previousManifest.sha256.toLowerCase() !== previous.fileSha256) {
    throw new Error('O APK de referência não corresponde à versão e ao SHA-256 do manifesto publicado.')
  }
  if (candidate.certificateSha256 !== previous.certificateSha256) {
    throw new Error('A assinatura do APK candidato não corresponde à chave permanente do GranaZen.')
  }
  if (candidate.versionCode <= previous.versionCode || !isNewerVersion(candidate.version, previous.version)) {
    throw new Error(`A versão candidata deve superar ${previous.version} (versionCode ${previous.versionCode}).`)
  }
}

mkdirSync(outputDirectory, { recursive: true })
copyFileSync(candidatePath, path.join(outputDirectory, apkName))
writeFileSync(
  path.join(outputDirectory, 'version.json'),
  `${JSON.stringify({
    version: candidate.version,
    versionCode: candidate.versionCode,
    url: `https://fadoco.github.io/GranaZen/updates/${apkName}?v=${candidate.versionCode}`,
    sha256: candidate.fileSha256,
    notes: '',
  }, null, 2)}\n`,
  'utf8',
)

console.log(`APK GranaZen ${candidate.version} (versionCode ${candidate.versionCode}) validado e preparado para publicação.`)
