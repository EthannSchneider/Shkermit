import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export const en = JSON.parse(await readFile(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8'));
export const fr = JSON.parse(await readFile(new URL('../../src/i18n/locales/fr.json', import.meta.url), 'utf8'));

export async function loadI18n() {
  let source = await readFile(new URL('../../src/i18n/index.ts', import.meta.url), 'utf8');
  source = source
    .replace("import i18n from 'i18next';", "import { createInstance } from 'i18next'; const i18n = createInstance();")
    .replace("import en from './locales/en.json';", `const en = ${JSON.stringify(en)};`)
    .replace("import fr from './locales/fr.json';", `const fr = ${JSON.stringify(fr)};`);
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  for (const name of ['i18next', 'react-i18next', 'i18next-browser-languagedetector']) {
    const url = import.meta.resolve(name) + (name === 'i18next-browser-languagedetector' ? `?test=${crypto.randomUUID()}` : '');
    outputText = outputText.replaceAll(`'${name}'`, JSON.stringify(url));
  }
  // Re-evaluate the application's configuration with a fresh instance.
  outputText += `\n// ${crypto.randomUUID()}`;
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)).default;
}

export const i18n = await loadI18n();
