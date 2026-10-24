import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zipSync, unzipSync } from 'fflate';
import { ApkArchive, apkMetadata } from '../src/direct/apk-resources.ts';
import { androidAppMetadata, clearAndroidAppMetadata } from '../src/direct/android-apps.ts';
const fixture = (variant: string) => readFileSync(new URL('./fixtures/android/' + variant + '.zip', import.meta.url));
const archive = async (bytes: Uint8Array) => new ApkArchive(async (offset, length) => bytes.subarray(offset, offset + length), bytes.length).open();
for (const variant of ['standard', 'compact']) test('AAPT2 ' + variant + ' APK resolves localized launcher label and safe vector icon', async () => {
  const a = await archive(fixture(variant));
  const ar = await apkMetadata(a, 'com.flix.metadatafixture', 'ar-SA'), en = await apkMetadata(a, 'com.flix.metadatafixture', 'en');
  assert.equal(ar.label, 'تطبيق الشاشة'); assert.equal(en.label, 'TV fixture');
  assert.equal(ar.image?.mime, 'image/svg+xml');
  const svg = new TextDecoder().decode(ar.image!.bytes); assert.match(svg, /fill="#00aa44"/); assert.match(svg, /fill-rule="evenodd"/); assert.match(svg, /rotate\(5\)/); assert.doesNotMatch(svg, /script|href|onload|foreignObject/);
  await assert.rejects(apkMetadata(a, 'wrong.package'), /identity/);
});
test('APK metadata rejects malformed ZIP, oversized resources and CRC corruption', async () => {
  await assert.rejects(archive(new Uint8Array(22)), /directory/);
  const file = zipSync({ 'AndroidManifest.xml': new Uint8Array(524289) }); const a = await archive(file);
  await assert.rejects(a.file('AndroidManifest.xml', 524288), /too large/);
  const valid = fixture('standard'), corrupted = new Uint8Array(valid); const original = await archive(valid), entry = original.entries.get('AndroidManifest.xml')!;
  const header = new DataView(corrupted.buffer), at = entry.offset + 30 + header.getUint16(entry.offset + 26, true) + header.getUint16(entry.offset + 28, true); corrupted[at + 8] ^= 255;
  await assert.rejects((await archive(corrupted)).file('AndroidManifest.xml', 524288));
  // A forged declared size must not permit unbounded DEFLATE output.
  const bomb = zipSync({ huge: new Uint8Array(1048576) });
  const central = bomb.findIndex((_, i) => i + 4 <= bomb.length && new DataView(bomb.buffer, bomb.byteOffset + i, 4).getUint32(0, true) === 0x02014b50);
  new DataView(bomb.buffer).setUint32(central + 24, 8, true);
  await assert.rejects((await archive(bomb)).file('huge', 131072), /decompression limit/);
});
test('phone ADB reads bounded APK ranges, caches results and refuses untrusted paths', async () => {
  clearAndroidAppMetadata(); const bytes = Buffer.from(zipSync({ ...unzipSync(fixture('compact')), 'unread-assets.bin': new Uint8Array(3145728) }, { level: 0 })), commands: string[][] = []; let transferred = 0;
  const shell = async (args: string[]) => { commands.push(args);
    if (args[0] === 'pm') return 'package:/data/app/~~safe/key/base.apk\npackage:/data/app/~~safe/key/split_config.ar.apk\n';
    if (args[0] === 'stat') return String(bytes.length);
    const match = args[2].match(/bs=4096 skip=(\d+) count=(\d+)/); assert.ok(match); assert.equal(args[0], 'sh');
    const range = bytes.subarray(Number(match[1]) * 4096, (Number(match[1]) + Number(match[2])) * 4096); transferred += range.length; return range.toString('base64');
  };
  const result = await androidAppMetadata('192.168.1.21:37455', 'com.flix.metadatafixture', shell);
  assert.equal(result.label, navigator.language.startsWith('ar') ? 'تطبيق الشاشة' : 'TV fixture'); assert.match(result.icon!, /^data:image\/svg\+xml;base64,/); assert.ok(commands.length >= 5); assert.ok(transferred < 200000);
  const count = commands.length; await androidAppMetadata('192.168.1.21:37455', result.id, shell); assert.equal(commands.length, count);
  await assert.rejects(androidAppMetadata('192.168.1.22:37455', result.id, async () => 'package:/data/app/../../private.apk'), /path/);
  await assert.rejects(androidAppMetadata('192.168.1.22:37455', 'bad;id', shell), /id/);
  clearAndroidAppMetadata();
});
test('changing televisions cancels further metadata reads and does not repopulate cache', async () => {
  clearAndroidAppMetadata(); let release!: (value: string) => void, count = 0;
  const result = androidAppMetadata('192.168.1.24:5555', 'com.flix.metadatafixture', async () => { count++; return new Promise<string>(resolve => { release = resolve; }); });
  clearAndroidAppMetadata(); release('package:/data/app/fixture/base.apk');
  await assert.rejects(result, /cancelled/); assert.equal(count, 1);
});
