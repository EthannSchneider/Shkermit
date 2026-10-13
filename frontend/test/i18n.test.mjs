import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import ts from 'typescript';
import { en, fr, i18n, loadI18n } from './helpers/i18n.mjs';

async function loadModule(file, dependencies = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  for (const [name, url] of Object.entries({
    'react-i18next': import.meta.resolve('react-i18next'),
    'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
    ...dependencies,
  })) {
    outputText = outputText.replaceAll(`'${name}'`, JSON.stringify(url)).replaceAll(`"${name}"`, JSON.stringify(url));
  }
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('English and French catalogs have identical keys and interpolation variables', () => {
  assert.deepEqual(Object.keys(en), Object.keys(fr));
  const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(en)) {
    assert.ok(en[key].trim(), `Empty English translation: ${key}`);
    assert.ok(fr[key].trim(), `Empty French translation: ${key}`);
    assert.deepEqual(placeholders(en[key]), placeholders(fr[key]), key);
  }
});

test('every translation key used directly in the interface exists in both catalogs', async () => {
  const sourceRoot = new URL('../src/', import.meta.url);
  for (const file of await readdir(sourceRoot, { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = await readFile(new URL(file, sourceRoot), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        for (const catalog of [en, fr]) {
          assert.ok(Object.hasOwn(catalog, key) || Object.hasOwn(catalog, `${key}_one`), `${file}: missing ${key}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});

test('language changes translate rendered React content, plurals, and interpolated values', async () => {
  const { default: Stats } = await loadModule('../src/components/games/clicker/stats.tsx');
  const render = () => renderToStaticMarkup(createElement(I18nextProvider, { i18n },
    createElement(Stats, { clicksPerSecond: 12345, shkermitesPerClick: 2 })));
  await i18n.changeLanguage('en');
  assert.ok(render().includes('Per second:'));
  assert.equal(i18n.t('accountCount', { count: 1, formattedCount: '1' }), '1 account');
  await i18n.changeLanguage('fr');
  assert.ok(render().includes('Par seconde :'));
  assert.ok(render().includes((12345).toLocaleString('fr')));
  assert.equal(i18n.t('accountCount', { count: 1, formattedCount: '1' }), '1 compte');
  assert.equal(i18n.t('accountCount', { count: 2, formattedCount: '2' }), '2 comptes');
  assert.equal(i18n.t('Signed in as {{username}}', { username: 'Ethann' }), 'Connecté en tant que Ethann');
  assert.equal(i18n.t('Invalid email, username, or password.'), 'E-mail, nom d’utilisateur ou mot de passe incorrect.');
  i18n.addResource('en', 'translation', '__fallback_test', 'English fallback');
  assert.equal(i18n.t('__fallback_test'), 'English fallback');
});

test('browser detection handles regional languages, persistence, fallback, and unavailable storage', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const saved = new Map();
  const storage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
  const navigator = { languages: ['fr-CH'], language: 'fr-CH' };
  const window = { localStorage: storage, navigator };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: {} } });
  try {
    const detected = await loadI18n();
    assert.equal(detected.resolvedLanguage, 'fr');
    assert.equal(document.documentElement.lang, 'fr');
    await detected.changeLanguage('en');
    assert.equal(saved.get('shkermitLanguage'), 'en');
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.documentElement.dir, 'ltr');
    assert.equal((await loadI18n()).resolvedLanguage, 'en');

    saved.clear();
    navigator.languages = ['de-CH'];
    navigator.language = 'de-CH';
    assert.equal((await loadI18n()).resolvedLanguage, 'en');

    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
    navigator.languages = ['fr-FR'];
    navigator.language = 'fr-FR';
    const withoutStorage = await loadI18n();
    assert.equal(withoutStorage.resolvedLanguage, 'fr');
    await withoutStorage.changeLanguage('en');
    assert.equal(withoutStorage.resolvedLanguage, 'en');
  } finally {
    for (const [name, descriptor] of [['window', originalWindow], ['navigator', originalNavigator], ['document', originalDocument]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('live solo and multiplayer messages translate counts while preserving player names', async () => {
  const { localizeTetrisMessage } = await loadModule('../src/components/games/tetris/localize-message.ts');
  const playerLabel = (player) => player === 1 ? 'PLAYER 2 Fan' : 'Ethann';
  await i18n.changeLanguage('fr');
  assert.equal(localizeTetrisMessage('PLAYER 1 WINS THE DUEL!', i18n.t, playerLabel), 'PLAYER 2 Fan REMPORTE LE DUEL !');
  assert.equal(localizeTetrisMessage('1 line cleared', i18n.t, playerLabel), '1 ligne effacée');
  assert.equal(localizeTetrisMessage('2 lines cleared • 3x combo', i18n.t, playerLabel), '2 lignes effacées • combo ×3');
  assert.equal(localizeTetrisMessage('PLAYER 2 SENT 4 GARBAGE ROWS!', i18n.t, playerLabel), 'Ethann A ENVOYÉ 4 RANGÉES DE BLOCS !');
  assert.equal(localizeTetrisMessage('FROG FLUSH! 2 danger rows gone.', i18n.t, playerLabel), 'RINÇAGE GRENOUILLE ! 2 rangées dangereuses effacées.');
  await i18n.changeLanguage('en');
  assert.equal(localizeTetrisMessage('2 lines cleared', i18n.t, playerLabel), '2 lines cleared');
});
