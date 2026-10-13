import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export const en = JSON.parse(await readFile(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8'));
export const fr = JSON.parse(await readFile(new URL('../../src/i18n/locales/fr.json', import.meta.url), 'utf8'));
export const it = JSON.parse(await readFile(new URL('../../src/i18n/locales/it.json', import.meta.url), 'utf8'));
export const de = JSON.parse(await readFile(new URL('../../src/i18n/locales/de.json', import.meta.url), 'utf8'));
export const catalogs = { en, fr, it, de };

export async function loadI18nModule() {
  let source = await readFile(new URL('../../src/i18n/index.ts', import.meta.url), 'utf8');
  source = source.replace("import i18n from 'i18next';", "import { createInstance } from 'i18next'; const i18n = createInstance();");
  for (const [language, catalog] of Object.entries(catalogs)) {
    source = source.replace(`import ${language} from './locales/${language}.json';`, `const ${language} = ${JSON.stringify(catalog)};`);
  }
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
