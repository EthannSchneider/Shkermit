import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import ts from 'typescript';
import { en, catalogs, i18n, loadI18n, loadI18nModule } from './helpers/i18n.mjs';

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

test('all language catalogs have identical keys and interpolation variables', () => {
  const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const [language, catalog] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(en), Object.keys(catalog), language);
    for (const key of Object.keys(en)) {
      assert.ok(catalog[key].trim(), `Empty ${language} translation: ${key}`);
      assert.deepEqual(placeholders(en[key]), placeholders(catalog[key]), `${language}: ${key}`);
    }
  }
});

test('every translation key used directly in the interface exists in all catalogs', async () => {
  const sourceRoot = new URL('../src/', import.meta.url);
  for (const file of await readdir(sourceRoot, { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = await readFile(new URL(file, sourceRoot), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        for (const catalog of Object.values(catalogs)) {
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
  for (const [language, perSecond, account, accounts, signedIn] of [
    ['it', 'Al secondo:', '1 account', '2 account', 'Accesso effettuato come Ethann'],
    ['de', 'Pro Sekunde:', '1 Konto', '2 Konten', 'Angemeldet als Ethann'],
  ]) {
    await i18n.changeLanguage(language);
    assert.ok(render().includes(perSecond));
    assert.ok(render().includes((12345).toLocaleString(language)));
    assert.equal(i18n.t('accountCount', { count: 1, formattedCount: '1' }), account);
    assert.equal(i18n.t('accountCount', { count: 2, formattedCount: '2' }), accounts);
    assert.equal(i18n.t('accountCount', { count: 1000000, formattedCount: '1000000' }), language === 'it' ? '1000000 account' : '1000000 Konten');
    assert.equal(i18n.t('Signed in as {{username}}', { username: 'Ethann' }), signedIn);
  }
  await i18n.changeLanguage('en-x-lolcat');
  assert.equal(i18n.resolvedLanguage, 'en-x-lolcat');
  assert.ok(render().includes('PER SEKUND:'));
  assert.ok(render().includes((12345).toLocaleString('en')));
  assert.equal(new Date('2026-10-13T12:00:00Z').toLocaleDateString(i18n.resolvedLanguage), new Date('2026-10-13T12:00:00Z').toLocaleDateString('en'));
  assert.equal(i18n.t('accountCount', { count: 1, formattedCount: '1' }), '1 ACCAUNT');
  assert.equal(i18n.t('accountCount', { count: 2, formattedCount: '2' }), '2 ACCAUNTS');
  assert.equal(i18n.t('accountCount', { count: 0, formattedCount: '0' }), '0 ACCAUNTS');
  assert.equal(i18n.t('accountCount', { count: 1000000, formattedCount: '1,000,000' }), '1,000,000 ACCAUNTS');
  assert.equal(i18n.t('Signed in as {{username}}', { username: 'MixedCase_é' }), 'U IZ LOGGD IN AS MixedCase_é');
  assert.equal(i18n.t('Let’s play'), 'I CAN HAZ GAEMS?');
  assert.equal(i18n.t('Invalid email, username, or password.'), 'OH NOES! E-MAIL, USERNAEM, OR PAWSWORD IZ WRONG.');
  i18n.addResource('en', 'translation', '__fallback_test', 'English fallback');
  assert.equal(i18n.t('__fallback_test'), 'English fallback');
});

test('language selector offers all supported languages with native labels', async () => {
  const { supportedLanguages } = await loadI18nModule();
  assert.deepEqual(supportedLanguages, ['en', 'fr', 'it', 'de', 'en-x-lolcat']);
  const dependency = `data:text/javascript;base64,${Buffer.from(`export const supportedLanguages = ${JSON.stringify(supportedLanguages)};`).toString('base64')}`;
  const { default: LanguageSwitcher } = await loadModule('../src/components/language-switcher.tsx', { '../i18n': dependency });
  for (const [language, label] of [['en', 'EN · English'], ['fr', 'FR · Français'], ['it', 'IT · Italiano'], ['de', 'DE · Deutsch'], ['en-x-lolcat', 'LOL · Lolcat']]) {
    await i18n.changeLanguage(language);
    const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(LanguageSwitcher)));
    const selectedOption = markup.match(/<option\b[^>]*selected=""[^>]*>[^<]*<\/option>/)?.[0];
    assert.ok(selectedOption?.includes(`value="${language}"`));
    assert.ok(selectedOption?.includes(`lang="${language}"`));
    assert.ok(selectedOption?.includes(`>${label}</option>`));
    assert.ok(markup.includes(catalogs[language].Language));
  }
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
  const navigator = { languages: ['fr-CH', 'en-US'], language: 'fr-CH' };
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

    await detected.changeLanguage('en-x-lolcat');
    assert.equal(saved.get('shkermitLanguage'), 'en-x-lolcat');
    assert.equal(document.documentElement.lang, 'en-x-lolcat');
    assert.equal(document.documentElement.dir, 'ltr');
    navigator.languages = ['en-US'];
    navigator.language = 'en-US';
    assert.equal((await loadI18n()).resolvedLanguage, 'en-x-lolcat');

    for (const [regional, language] of [['it-CH', 'it'], ['de-CH', 'de']]) {
      saved.clear();
      navigator.languages = [regional, 'en-US'];
      navigator.language = regional;
      const regionalInstance = await loadI18n();
      assert.equal(regionalInstance.resolvedLanguage, language);
      assert.equal(document.documentElement.lang, language);
      assert.equal(saved.get('shkermitLanguage'), language);
      navigator.languages = ['en-US'];
      navigator.language = 'en-US';
      assert.equal((await loadI18n()).resolvedLanguage, language);
    }

    saved.clear();
    navigator.languages = ['es-ES'];
    navigator.language = 'es-ES';
    assert.equal((await loadI18n()).resolvedLanguage, 'en');

    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
    navigator.languages = ['fr-FR'];
    navigator.language = 'fr-FR';
    const withoutStorage = await loadI18n();
    assert.equal(withoutStorage.resolvedLanguage, 'fr');
    await withoutStorage.changeLanguage('en-x-lolcat');
    assert.equal(withoutStorage.resolvedLanguage, 'en-x-lolcat');
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
  await i18n.changeLanguage('it');
  assert.equal(localizeTetrisMessage('PLAYER 1 WINS THE DUEL!', i18n.t, playerLabel), 'PLAYER 2 Fan VINCE IL DUELLO!');
  assert.equal(localizeTetrisMessage('1 line cleared', i18n.t, playerLabel), '1 linea eliminata');
  assert.equal(localizeTetrisMessage('2 lines cleared • 3x combo', i18n.t, playerLabel), '2 linee eliminate • combo ×3');
  assert.equal(localizeTetrisMessage('PLAYER 2 SENT 4 GARBAGE ROWS!', i18n.t, playerLabel), 'Ethann HA INVIATO 4 RIGHE DI BLOCCHI!');
  assert.equal(localizeTetrisMessage('FROG FLUSH! 2 danger rows gone.', i18n.t, playerLabel), 'RISCIACQUO RANA! 2 righe pericolose eliminate.');
  await i18n.changeLanguage('de');
  assert.equal(localizeTetrisMessage('PLAYER 1 WINS THE DUEL!', i18n.t, playerLabel), 'PLAYER 2 Fan GEWINNT DAS DUELL!');
  assert.equal(localizeTetrisMessage('1 line cleared', i18n.t, playerLabel), '1 Linie abgebaut');
  assert.equal(localizeTetrisMessage('2 lines cleared • 3x combo', i18n.t, playerLabel), '2 Linien abgebaut • 3er-Kombo');
  assert.equal(localizeTetrisMessage('PLAYER 2 SENT 4 GARBAGE ROWS!', i18n.t, playerLabel), 'Ethann HAT 4 MÜLLREIHEN GESENDET!');
  assert.equal(localizeTetrisMessage('FROG FLUSH! 2 danger rows gone.', i18n.t, playerLabel), 'FROSCHSPÜLUNG! 2 gefährliche Reihen entfernt.');
  await i18n.changeLanguage('en-x-lolcat');
  assert.equal(localizeTetrisMessage('PLAYER 1 WINS THE DUEL!', i18n.t, playerLabel), 'PLAYER 2 Fan WINZ TEH DOOL!');
  assert.equal(localizeTetrisMessage('1 line cleared', i18n.t, playerLabel), '1 LINE CLEARD');
  assert.equal(localizeTetrisMessage('2 lines cleared • 3x combo', i18n.t, playerLabel), '2 LINES CLEARD • 3x COMBO. NICE!');
  assert.equal(localizeTetrisMessage('PLAYER 2 SENT 4 GARBAGE ROWS!', i18n.t, playerLabel), 'Ethann SENT 4 GARBAGE ROWS! OH NOES!');
  assert.equal(localizeTetrisMessage('FROG FLUSH! 2 danger rows gone.', i18n.t, playerLabel), 'FROGGO FLUSH! 2 DANGER ROWS IZ GONE.');
  await i18n.changeLanguage('en');
  assert.equal(localizeTetrisMessage('2 lines cleared', i18n.t, playerLabel), '2 lines cleared');
});
