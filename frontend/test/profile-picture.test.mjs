import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ts from 'typescript';
import './helpers/i18n.mjs';

async function moduleUrl(file, dependencies = {}) {
  const source = (await readFile(new URL(file, import.meta.url), 'utf8'))
    .replace(/^import (\w+) from ["'][^"']+\.png["'];$/gm, 'const $1 = "/default-avatar.png";');
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  for (const [name, url] of Object.entries({
    react: import.meta.resolve('react'),
    'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
    'react-i18next': import.meta.resolve('react-i18next'),
    'react-router-dom': import.meta.resolve('react-router-dom'),
    ...dependencies,
  })) {
    outputText = outputText.replaceAll(`'${name}'`, JSON.stringify(url)).replaceAll(`"${name}"`, JSON.stringify(url));
  }
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const contextUrl = await moduleUrl('../src/context/auth-context.ts');
const avatarUrl = await moduleUrl('../src/components/profile-avatar.tsx');
const apiUrl = await moduleUrl('../src/lib/api.ts');
const { AuthContext } = await import(contextUrl);
const { default: Header } = await import(await moduleUrl('../src/components/header.tsx', {
  '../context/auth-context': contextUrl, './profile-avatar': avatarUrl,
}));
const { default: ProfilePictureSettings } = await import(await moduleUrl('../src/components/profile-picture-settings.tsx', {
  '../context/auth-context': contextUrl, './profile-avatar': avatarUrl, '../lib/api': apiUrl,
}));
const { api } = await import(apiUrl);

const member = { id: 42, username: 'PhotoFrog', isAdmin: false, profilePictureUrl: '/api/profile-pictures/photo.png' };
function render(component, user) {
  return renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(AuthContext.Provider, { value: { user, loading: false, logout: async () => {}, setUser: () => {} } }, component),
  ));
}

test('signed-in headers show an avatar and username with settings and logout in a collapsed disclosure', () => {
  const markup = render(createElement(Header), member);
  assert.ok(markup.includes('src="/api/profile-pictures/photo.png"'));
  assert.ok(markup.includes('>PhotoFrog</span>'));
  assert.ok(markup.includes('aria-label="Account menu for PhotoFrog"'));
  assert.ok(markup.includes('aria-expanded="false"'));
  assert.match(markup, /class="account-menu-dropdown" hidden=""/);
  assert.ok(markup.includes('href="/account"'));
  assert.ok(markup.includes('>Logout</button>'));
  assert.ok(!markup.includes('href="/admin/users"'));
  assert.ok(!markup.includes('href="/login"'));
  assert.ok(!markup.includes('href="/register"'));
});

test('only administrators see admin settings in the account dropdown', () => {
  const markup = render(createElement(Header), { ...member, isAdmin: true });
  assert.match(markup, /<a\b[^>]*href="\/admin\/users"[^>]*>Admin settings<\/a>/);
  assert.equal((markup.match(/href="\/admin\/users"/g) ?? []).length, 1);
});

test('guests retain login and registration and members without a picture receive the default avatar', () => {
  const guest = render(createElement(Header), null);
  assert.ok(guest.includes('href="/login"'));
  assert.ok(guest.includes('href="/register"'));
  assert.ok(!guest.includes('account-menu-trigger'));
  const markup = render(createElement(Header), { ...member, profilePictureUrl: null });
  assert.match(markup, /src="\/default-avatar.png" alt="" class="profile-avatar/);
});

test('account settings offer image uploads and show removal only for a saved picture', () => {
  for (const profilePictureUrl of [null, member.profilePictureUrl]) {
    const user = { ...member, profilePictureUrl };
    const markup = render(createElement(ProfilePictureSettings, { user }), user);
    assert.ok(markup.includes('type="file" accept="image/jpeg,image/png,image/webp,image/gif"'));
    assert.ok(markup.includes('Maximum 5 MB.'));
    assert.ok(markup.includes('Save picture'));
    assert.equal(markup.includes('Remove picture'), Boolean(profilePictureUrl));
  }
});

test('profile picture requests send only the selected file and removal uses its own endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options });
    return { ok: true, status: 200, json: async () => ({ user: member }) };
  };
  try {
    const file = new File(['picture'], 'avatar.png', { type: 'image/png' });
    assert.deepEqual((await api.updateProfilePicture(file)).user, member);
    assert.deepEqual((await api.removeProfilePicture()).user, member);
    assert.equal(calls[0].path, '/api/account/profile-picture');
    assert.equal(calls[0].method, 'PATCH');
    assert.equal(calls[0].credentials, 'same-origin');
    assert.deepEqual([...calls[0].body.keys()], ['image']);
    assert.equal(calls[0].body.get('image').name, file.name);
    assert.equal(calls[0].headers['Content-Type'], undefined);
    assert.equal(calls[1].path, '/api/account/profile-picture');
    assert.equal(calls[1].method, 'DELETE');
    assert.equal(calls[1].body, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
