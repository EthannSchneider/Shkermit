import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export const en = JSON.parse(await readFile(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8'));
export const fr = JSON.parse(await readFile(new URL('../../src/i18n/locales/fr.json', import.meta.url), 'utf8'));
export const it = JSON.parse(await readFile(new URL('../../src/i18n/locales/it.json', import.meta.url), 'utf8'));
export const de = JSON.parse(await readFile(new URL('../../src/i18n/locales/de.json', import.meta.url), 'utf8'));
export const lolcat = JSON.parse(await readFile(new URL('../../src/i18n/locales/en-x-lolcat.json', import.meta.url), 'utf8'));
export const enchanting = JSON.parse(await readFile(new URL('../../src/i18n/locales/en-x-enchant.json', import.meta.url), 'utf8'));
export const catalogs = { en, fr, it, de, 'en-x-lolcat': lolcat, 'en-x-enchant': enchanting };

export async function loadI18nModule() {
  let source = await readFile(new URL('../../src/i18n/index.ts', import.meta.url), 'utf8');
  source = source.replace("import i18n from 'i18next';", "import { createInstance } from 'i18next'; const i18n = createInstance();");
  source = source.replace(/import (\w+) from '\.\/locales\/([^']+)\.json';/g,
    (_, name, language) => `const ${name} = ${JSON.stringify(catalogs[language])};`);
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  for (const name of ['i18next', 'react-i18next', 'i18next-browser-languagedetector']) {
    const url = import.meta.resolve(name) + (name === 'i18next-browser-languagedetector' ? `?test=${crypto.randomUUID()}` : '');
    outputText = outputText.replaceAll(`'${name}'`, JSON.stringify(url));
  }
  // Re-evaluate the application's configuration with a fresh instance.
  outputText += `\n// ${crypto.randomUUID()}`;
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

export async function loadI18n() {
  return (await loadI18nModule()).default;
}

export const i18n = await loadI18n();
