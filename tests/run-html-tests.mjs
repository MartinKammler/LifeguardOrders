import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanupLeftovers() {
  const projectRoot = path.resolve(__dirname, '..');
  const [testFiles, rootFiles] = await Promise.all([
    fs.readdir(__dirname),
    fs.readdir(projectRoot),
  ]);
  const toDelete = [
    ...testFiles.filter(n => /^\.tmp_test_.*\.mjs$/.test(n)).map(n => path.join(__dirname, n)),
    ...rootFiles.filter(n => /^\.tmp_boot_.*\.mjs$/.test(n)).map(n => path.join(projectRoot, n)),
  ];
  await Promise.all(toDelete.map(f => fs.unlink(f).catch(() => {})));
}

async function main() {
  await cleanupLeftovers();
  const requested = process.argv.slice(2);
  const htmlFiles = requested.length
    ? requested.map(file => path.resolve(process.cwd(), file))
    : (await fs.readdir(__dirname))
        .filter(name => /^test_.*\.html$/i.test(name))
        .map(name => path.join(__dirname, name))
        .sort();

  if (!htmlFiles.length) {
    console.error('Keine HTML-Testdateien gefunden.');
    process.exitCode = 1;
    return;
  }

  let passedSuites = 0;

  for (const htmlFile of htmlFiles) {
    const result = await runHtmlTest(htmlFile);
    if (result.ok) {
      passedSuites += 1;
      console.log(`PASS ${path.basename(htmlFile)} — ${result.summary}`);
    } else {
      console.log(`FAIL ${path.basename(htmlFile)} — ${result.summary}`);
      if (result.details) {
        console.log(result.details);
      }
      process.exitCode = 1;
    }
  }

  console.log(`${passedSuites}/${htmlFiles.length} HTML-Testseiten bestanden`);
}

async function runHtmlTest(htmlFile) {
  const html = await fs.readFile(htmlFile, 'utf8');
  const script = extractModuleScript(html);
  if (!script) {
    return { ok: false, summary: 'Kein <script type="module"> gefunden' };
  }

  const seedElements = extractSeedElements(html);
  const tempModule = path.join(
    path.dirname(htmlFile),
    `.tmp_${path.basename(htmlFile, '.html')}_${process.pid}_${Date.now()}.mjs`
  );

  const wrapped = [
    `import { installTestDom } from './test-env.mjs';`,
    `installTestDom(${JSON.stringify(seedElements)});`,
    script,
    `export const __htmlTestSnapshot = globalThis.__htmlTestHarness__.snapshot();`,
  ].join('\n\n');

  await fs.writeFile(tempModule, wrapped, 'utf8');

  try {
    const mod = await import(`${pathToFileURL(tempModule).href}?ts=${Date.now()}`);
    return analyseSnapshot(mod.__htmlTestSnapshot);
  } catch (error) {
    return {
      ok: false,
      summary: error.message,
      details: error.stack,
    };
  } finally {
    await fs.unlink(tempModule).catch(() => {});
  }
}

function extractModuleScript(html) {
  const match = html.match(/<script\s+type="module">([\s\S]*?)<\/script>/i);
  return match ? match[1].trim() : '';
}

function extractSeedElements(html) {
  const elements = [];
  const regex = /<([a-z0-9]+)\b[^>]*\sid="([^"]+)"[^>]*>/ig;

  for (const match of html.matchAll(regex)) {
    elements.push({ tagName: match[1], id: match[2] });
  }

  return elements;
}

function analyseSnapshot(snapshot) {
  const texts = Object.values(snapshot?.elements || {}).map(element => element.textContent || '');
  const joined = texts.join('\n');

  const bestanden = joined.match(/(\d+)\s*\/\s*(\d+)\s*(?:Tests\s*)?bestanden(?:\s*—\s*(\d+)\s*fehlgeschlagen)?/i);
  if (bestanden) {
    const passed = Number(bestanden[1]);
    const total = Number(bestanden[2]);
    const failed = bestanden[3] ? Number(bestanden[3]) : (total - passed);
    return {
      ok: failed === 0,
      summary: `${passed}/${total} bestanden`,
      details: failed === 0 ? '' : joined,
    };
  }

  const passedFailed = joined.match(/(\d+)\s+passed,\s+(\d+)\s+failed/i);
  if (passedFailed) {
    const passed = Number(passedFailed[1]);
    const failed = Number(passedFailed[2]);
    return {
      ok: failed === 0,
      summary: `${passed} passed, ${failed} failed`,
      details: failed === 0 ? '' : joined,
    };
  }

  return {
    ok: false,
    summary: 'Keine auswertbare Zusammenfassung gefunden',
    details: joined,
  };
}

await main();
