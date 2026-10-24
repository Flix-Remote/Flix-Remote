import test from 'node:test';
import assert from 'node:assert/strict';
import { androidActivity } from '../src/direct/activity.ts';
test('activity reports only the foreground package and its matching media title', () => {
  const activity = androidActivity('mCurrentFocus=Window{a u0 com.test.player/.Main}', 'package=net.other.app\nmetadata: description=Private other title, x\npackage=com.test.player\nstate=PlaybackState {state=3, position=120}\nmetadata: size=1, description=Episode 2, null, null');
  assert.equal(activity.appId, 'com.test.player'); assert.equal(activity.title, 'Episode 2'); assert.equal(activity.state, 'playing');
  assert.ok(!JSON.stringify(activity).includes('Private other title'));
});
test('activity never invents a title from another app or a launch request', () => {
  const activity = androidActivity('mFocusedApp=AppWindowToken{b com.test.player/.Main}', 'package=net.other.app\nmetadata: description=Wrong title, null');
  assert.equal(activity.available, true); assert.equal(activity.title, undefined); assert.equal(activity.state, undefined);
  assert.equal(androidActivity('Permission denied', 'package=com.test.player').available, false);
});
test('activity bounds metadata and omits null descriptions', () => {
  const foreground = 'mCurrentFocus=Window{a com.test.player/.Main}';
  assert.equal(androidActivity(foreground, 'package=com.test.player\nmetadata: description=null, null').title, undefined);
  assert.equal(androidActivity(foreground, 'package=com.test.player\nmetadata: description=' + 'ع'.repeat(600)).title?.length, 200);
});
