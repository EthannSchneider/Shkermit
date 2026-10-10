import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { BOARD_WALLPAPERS as allowedWallpapers, wallpaperStorageKey } from '../../backend/src/utils/board-wallpaper.js';

async function moduleUrl(file, dependencies = {}) {
  const source = (await readFile(new URL(file, import.meta.url), 'utf8'))
    .replace(/^import (\w+) from '.*\.png';$/gm, 'const $1 = "/test-wallpaper.png";');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  let linked = outputText;
  for (const [name, url] of Object.entries({
    react: import.meta.resolve('react'),
    'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
    ...dependencies,
  })) {
    linked = linked.replaceAll(`'${name}'`, JSON.stringify(url)).replaceAll(`"${name}"`, JSON.stringify(url));
  }
  return `data:text/javascript;base64,${Buffer.from(linked).toString('base64')}`;
}

const wallpapersUrl = await moduleUrl('../src/components/games/tetris/board-wallpapers.ts');
const constantsUrl = await moduleUrl('../src/components/games/tetris/constants.ts');
const gridUrl = await moduleUrl('../src/components/games/tetris/board-grid.tsx', {
  './constants': constantsUrl, './board-wallpapers': wallpapersUrl,
});
const settingsUrl = await moduleUrl('../src/components/games/tetris/board-wallpaper-settings.tsx', {
  './board-grid': gridUrl, './board-wallpapers': wallpapersUrl,
});
const { BOARD_WALLPAPERS, getBoardWallpaper, getCustomBoardImageUrl } = await import(wallpapersUrl);
const { BoardGrid } = await import(gridUrl);
const { BoardWallpaperSettings } = await import(settingsUrl);
const { api } = await import(await moduleUrl('../src/lib/api.ts'));

test('every wallpaper choice can be saved by the backend and unknown choices fall back to Classic', () => {
  assert.deepEqual(BOARD_WALLPAPERS.map(({ id }) => id), allowedWallpapers);
  for (const id of [undefined, '', 'invalid']) assert.equal(getBoardWallpaper(id).id, 'classic');
});

test('board wallpapers remain behind opaque blocks and visible ghosts', () => {
  const cells = new Map([
    ['0:0', { cell: { type: 'T', owner: 1 }, active: true }],
    ['1:1', { cell: { type: 'T', owner: 1 }, ghost: true }],
  ]);
  for (const wallpaper of BOARD_WALLPAPERS) {
    const markup = renderToStaticMarkup(createElement(BoardGrid, {
      cells, cols: 2, rows: 2, width: '100px', height: '100px', accent: '#b5ff4a', label: '', wallpaper: wallpaper.id,
    }));
    assert.ok(markup.includes('background-image:'));
    assert.ok(markup.includes('background-position:center'));
    assert.ok(markup.includes('background-size:cover'));
    assert.equal((markup.match(/<span /g) ?? []).length, 4);
    assert.ok(markup.includes('opacity:1'));
    assert.ok(markup.includes('opacity:0.8'));
  }
});

test('wallpaper pickers restore each account selection without sharing radio groups', () => {
  const markup = renderToStaticMarkup(createElement('div', null,
    ...['pond', 'thug'].map((wallpaper) => createElement(BoardWallpaperSettings, {
      key: wallpaper, wallpaper, onSave: async () => {},
    })),
  ));
  const inputs = [...markup.matchAll(/<input\b[^>]+>/g)].map((match) => match[0]);
  const checkedValues = inputs.filter((input) => input.includes('checked=""'))
    .map((input) => input.match(/value="([^"]+)"/)[1]);
  assert.deepEqual(checkedValues, ['pond', 'thug']);
  const radioNames = inputs.map((input) => input.match(/name="([^"]+)"/)[1]);
  assert.equal(new Set(radioNames).size, 2);
});

test('account and admin saves send only wallpaper preferences to the appropriate endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options });
    return { ok: true, status: 200, json: async () => ({ user: { boardWallpaper: JSON.parse(options.body).boardWallpaper } }) };
  };
  try {
    assert.equal((await api.updateBoardWallpaper('pond')).user.boardWallpaper, 'pond');
    assert.equal((await api.updateUserBoardWallpaper(42, 'space')).user.boardWallpaper, 'space');
    assert.deepEqual(calls.map(({ path, method, body, credentials }) => ({ path, method, body: JSON.parse(body), credentials })), [
      { path: '/api/account/wallpaper', method: 'PATCH', body: { boardWallpaper: 'pond' }, credentials: 'same-origin' },
      { path: '/api/admin/users/42/wallpaper', method: 'PATCH', body: { boardWallpaper: 'space' }, credentials: 'same-origin' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const customWallpaper = 'custom:12345678-1234-1234-1234-123456789abc.png';

test('custom board images use stored upload URLs and reject arbitrary paths', () => {
  const url = `/api/board-wallpapers/${wallpaperStorageKey(customWallpaper)}`;
  assert.equal(getCustomBoardImageUrl(customWallpaper), url);
  assert.equal(getBoardWallpaper(customWallpaper).id, 'custom');
  assert.ok(getBoardWallpaper(customWallpaper).backgroundImage.includes(url));
  assert.ok(getBoardWallpaper('custom', 'blob:https://localhost/preview').backgroundImage.includes('blob:https://localhost/preview'));
  for (const value of ['custom:../secret.png', 'custom:javascript:alert(1)', 'custom:https://example.com/file.png', 'custom:123.png']) {
    assert.equal(getCustomBoardImageUrl(value), '');
    assert.equal(getBoardWallpaper(value).id, 'classic');
  }
  assert.equal(getBoardWallpaper('custom', 'https://example.com/file.png').id, 'classic');
});

test('only admin wallpaper pickers offer uploads while users can preview their assigned custom image', () => {
  for (const allowCustomUpload of [false, true]) {
    const markup = renderToStaticMarkup(createElement(BoardWallpaperSettings, {
      wallpaper: customWallpaper, allowCustomUpload, onSave: async () => customWallpaper,
    }));
    assert.equal(markup.includes('type="file"'), allowCustomUpload);
    assert.ok(markup.includes(getCustomBoardImageUrl(customWallpaper)));
    const customInput = [...markup.matchAll(/<input\b[^>]+>/g)].find(([input]) => input.includes('value="custom"'));
    assert.ok(customInput?.[0].includes('checked=""'));
  }
});

test('admin custom uploads send the file as multipart without overriding its content type', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const image = new File([new Uint8Array([1, 2, 3])], 'board.png', { type: 'image/png' });
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options });
    return { ok: true, status: 200, json: async () => ({ user: { boardWallpaper: customWallpaper } }) };
  };
  try {
    await api.updateUserBoardWallpaper(42, 'custom', image);
    await api.updateBoardWallpaper('custom', image);
    assert.deepEqual(calls.map(({ path }) => path), ['/api/admin/users/42/wallpaper', '/api/account/wallpaper']);
    for (const { body, headers, credentials, method } of calls) {
      assert.ok(body instanceof FormData);
      assert.equal(body.get('image').name, 'board.png');
      assert.equal(body.get('image').type, 'image/png');
      assert.equal(body.get('image').size, 3);
      assert.equal(headers['Content-Type'], undefined);
      assert.equal(credentials, 'same-origin');
      assert.equal(method, 'PATCH');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
