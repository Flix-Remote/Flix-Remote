// SPDX-License-Identifier: MIT
// Derived inputs only. The original remote page and native plugins remain authoritative.
import { cp, mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'Flix-Remote');
const bridge = join(app, 'build/bridge');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function replaceDir(target, source) {
  // Never follow a caller-supplied cleanup path outside this generated Day project.
  const path = resolve(target);
  if (!path.startsWith(app + sep)) throw new Error('Day staging target escaped the app');
  await rm(path, { recursive: true, force: true });
  await mkdir(dirname(path), { recursive: true });
  await cp(source, path, { recursive: true });
}
async function put(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await files(p));
    else if (e.isFile()) out.push(p);
    else throw new Error(`Unexpected non-regular Day staging input: ${p}`);
  }
  return out.sort();
}

if (!(await stat(join(root, 'dist/index.html'))).isFile()) throw new Error('Run npm run build first');
const ui = join(app, 'resource/assets/public');
await replaceDir(ui, join(root, 'dist'));
const config = JSON.stringify({
  appId: 'com.flix.homeremote', appName: 'ريموت البيت', webDir: 'public',
  plugins: { CapacitorHttp: { enabled: true } }, android: { allowMixedContent: true },
}, null, 2) + '\n';
// Android reads config at the asset root; UIKit is given the explicit file URL below public/.
await put(join(ui, 'capacitor.config.json'), config);
await put(join(app, 'resource/assets/capacitor.config.json'), config);
const inputs = {};
async function stageFile(from, to) {
  const bytes = await readFile(join(root, from));
  await put(join(app, to), bytes);
  inputs[from] = hash(bytes);
}
await stageFile('ios/App/App/HomeDiscoveryPlugin.swift', 'platform/ios/bridge/HomeDiscoveryPlugin.swift');
await stageFile('ios/App/App/PrivacyInfo.xcprivacy', 'platform/ios/Runner/PrivacyInfo.xcprivacy');
for (const name of ['HomeDiscoveryPlugin', 'DirectLanPlugin', 'DirectAdbPlugin']) {
  await stageFile(`android/app/src/main/java/com/flix/homeremote/${name}.java`,
    `build/bridge/java/com/flix/homeremote/${name}.java`);
}
await stageFile('android/app/src/main/res/xml/file_paths.xml', 'platform/android/res/xml/file_paths.xml');

const modules = [
  { name: 'capacitor-android', from: '@capacitor/android/capacitor', ns: 'com.getcapacitor.android', core: true },
  ...['app', 'filesystem', 'preferences', 'share'].map(name => ({
    name: `capacitor-${name}`, from: `@capacitor/${name}/android`, ns: `com.capacitorjs.plugins.${name}`,
  })),
];
const patches = [];
const coreDeps = [
  'androidx.appcompat:appcompat:1.7.1', 'androidx.core:core:1.17.0',
  'androidx.activity:activity:1.11.0', 'androidx.fragment:fragment:1.8.9',
  'androidx.coordinatorlayout:coordinatorlayout:1.3.0', 'androidx.webkit:webkit:1.14.0',
  'org.apache.cordova:framework:14.0.1',
];
for (const m of modules) {
  const source = join(root, 'node_modules', m.from);
  const dest = join(bridge, m.name);
  await replaceDir(join(dest, 'src/main'), join(source, 'src/main'));
  const packageRoot = join(root, 'node_modules', '@capacitor', m.core ? 'android' : m.name.slice('capacitor-'.length));
  await cp(join(packageRoot, 'LICENSE'), join(dest, 'LICENSE'));
  if (m.core) {
    // Day owns FragmentActivity. Capacitor only needs its Fragment/ActivityResult APIs.
    // Keep the original npm dependency untouched; record each exact generated patch.
    for (const p of await files(join(dest, 'src/main/java'))) {
      if (!p.endsWith('.java')) continue;
      const before = await readFile(p, 'utf8');
      if (!before.includes('AppCompatActivity')) continue;
      const after = before.replaceAll('androidx.appcompat.app.AppCompatActivity', 'androidx.fragment.app.FragmentActivity')
        .replaceAll('AppCompatActivity', 'FragmentActivity');
      await writeFile(p, after);
      patches.push({ file: relative(bridge, p).replaceAll('\\', '/'), before: hash(before), after: hash(after) });
    }
    if (patches.length !== 5) throw new Error(`Capacitor host adapter drift: expected 5 patched files, found ${patches.length}`);
  }
  const deps = m.core ? coreDeps.map(d => `    implementation("${d}")`) : [
    '    implementation(project(":capacitor-android"))',
    '    implementation("androidx.appcompat:appcompat:1.7.1")',
    ...(m.name === 'capacitor-filesystem' ? [
      '    implementation("io.ionic.libs:ionfilesystem-android:1.1.1")',
      '    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")',
    ] : []),
  ];
  // Use the Android library plugin version already supplied by Day, including AGP's Kotlin.
  await put(join(dest, 'build.gradle.kts'), `// Generated by scripts/stage-day.mjs. Original sources: ${m.from}\nplugins { id("com.android.library") }\nandroid {\n    namespace = "${m.ns}"\n    compileSdk = 36\n    defaultConfig { minSdk = 24 }\n    buildFeatures { buildConfig = true }\n    compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }\n}\ndependencies {\n${deps.join('\n')}\n}\n`);
}
// UI receipt is deterministic: canonical build identity plus every actual bundled byte.
const uiFiles = {};
for (const p of await files(ui)) uiFiles[relative(ui, p).replaceAll('\\', '/')] = hash(await readFile(p));
const receipt = {
  schema: 1, day: { version: '0.6.0', revision: '2c787ecae32a59cf58260aca95b51a4b1bd98d41' },
  source: 'local_apps/flix-s/tools/tv-remote.html',
  generatedUi: 'dist', channel: 'bridge-1',
  nativeInputs: inputs, ui: uiFiles, capacitorFragmentAdapter: patches,
  qualifications: { nativeIosBuilt: false, nativeAndroidBuilt: false, physicalDeviceTested: false },
};
await put(join(bridge, 'stage-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(`Day staging: ${Object.keys(uiFiles).length} UI files, 3 native LAN/ADB plugins, 5 Capacitor library modules, ${patches.length} isolated host adaptations\n`);
