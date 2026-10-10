import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/games/tetris/sound-settings.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { DEFAULT_SOUND_SETTINGS, SOUND_SETTINGS_STORAGE_KEY, LEGACY_SOUND_PREFERENCE_KEY, normalizeSoundSettings, getSavedSoundSettings, applySoundSettings } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

function tracks() {
  return Object.fromEntries(['menu', 'game', 'place', 'line'].map((name) => [name, {
    volume: 1, muted: false, currentTime: 42, pauses: 0,
    pause() { this.pauses += 1; },
  }]));
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`);

test('sound preferences clamp volumes and reject malformed values', () => {
  assert.deepEqual(normalizeSoundSettings({ masterVolume: 999, musicVolume: -4, effectsVolume: 52.7, muted: true }), {
    masterVolume: 100, musicVolume: 0, effectsVolume: 53, muted: true,
  });
  for (const value of [null, [], 'bad', {}, { masterVolume: NaN, musicVolume: Infinity, effectsVolume: '50', muted: 'true' }]) {
    assert.deepEqual(normalizeSoundSettings(value), DEFAULT_SOUND_SETTINGS);
  }
});

test('sound preferences restore saved volumes and preserve the previous mute setting', () => {
  const saved = { muted: false, masterVolume: 75, musicVolume: 40, effectsVolume: 60 };
  const storage = new Map([[LEGACY_SOUND_PREFERENCE_KEY, 'false']]);
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null } };
  try {
    assert.deepEqual(getSavedSoundSettings(), { ...DEFAULT_SOUND_SETTINGS, muted: true });
    for (const invalid of ['broken JSON', 'null', '[]']) {
      storage.set(SOUND_SETTINGS_STORAGE_KEY, invalid);
      assert.deepEqual(getSavedSoundSettings(), { ...DEFAULT_SOUND_SETTINGS, muted: true });
    }
    storage.set(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(saved));
    assert.deepEqual(getSavedSoundSettings(), saved);
    globalThis.window.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
    assert.deepEqual(getSavedSoundSettings(), DEFAULT_SOUND_SETTINGS);
  } finally {
    delete globalThis.window;
  }
  assert.deepEqual(getSavedSoundSettings(), DEFAULT_SOUND_SETTINGS);
});

test('master volume scales music and effects while preserving their original balance', () => {
  const audio = tracks();
  applySoundSettings(audio, DEFAULT_SOUND_SETTINGS);
  near(audio.menu.volume, 0.28);
  near(audio.game.volume, 0.28);
  near(audio.place.volume, 0.55);
  near(audio.line.volume, 0.65);
  applySoundSettings(audio, { ...DEFAULT_SOUND_SETTINGS, masterVolume: 50 });
  near(audio.menu.volume, 0.14);
  near(audio.game.volume, 0.14);
  near(audio.place.volume, 0.275);
  near(audio.line.volume, 0.325);
  for (const track of Object.values(audio)) {
    assert.equal(track.currentTime, 42);
    assert.equal(track.pauses, 0);
  }
});

test('music and effects volumes are independent and zero volume silences the correct channel', () => {
  const audio = tracks();
  applySoundSettings(audio, { ...DEFAULT_SOUND_SETTINGS, musicVolume: 0 });
  assert.equal(audio.menu.muted, true);
  assert.equal(audio.game.muted, true);
  assert.equal(audio.menu.pauses, 1);
  assert.equal(audio.game.pauses, 1);
  assert.equal(audio.place.muted, false);
  assert.equal(audio.line.muted, false);
  near(audio.place.volume, 0.55);
  near(audio.line.volume, 0.65);

  const other = tracks();
  applySoundSettings(other, { ...DEFAULT_SOUND_SETTINGS, effectsVolume: 0 });
  assert.equal(other.place.muted, true);
  assert.equal(other.line.muted, true);
  assert.equal(other.place.pauses, 1);
  assert.equal(other.line.pauses, 1);
  assert.equal(other.menu.muted, false);
  assert.equal(other.game.muted, false);
  near(other.menu.volume, 0.28);
  assert.equal(other.menu.pauses, 0);
});

test('mute stops every track immediately without losing volumes or playback position', () => {
  const audio = tracks();
  const settings = { muted: true, masterVolume: 75, musicVolume: 80, effectsVolume: 20 };
  applySoundSettings(audio, settings);
  for (const track of Object.values(audio)) {
    assert.equal(track.muted, true);
    assert.equal(track.pauses, 1);
    assert.equal(track.currentTime, 42);
  }
  near(audio.menu.volume, 0.6);
  near(audio.line.volume, 0.15);
  applySoundSettings(audio, { ...settings, muted: false });
  for (const track of Object.values(audio)) assert.equal(track.muted, false);
  near(audio.menu.volume, 0.6);
  near(audio.line.volume, 0.15);
  applySoundSettings(audio, { ...settings, muted: false, masterVolume: 0 });
  for (const track of Object.values(audio)) {
    assert.equal(track.muted, true);
    assert.equal(track.volume, 0);
    assert.equal(track.pauses, 2);
  }
});
