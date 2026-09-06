import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repository = process.env.GITHUB_REPOSITORY;
const repositoryName = repository?.split('/')[1];

if (!repositoryName) {
  throw new Error('GITHUB_REPOSITORY is required to prepare the Pages artifact.');
}

const basePath = `/${repositoryName}`;
const clientDirectory = path.resolve('dist/client');

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(entryPath);
      continue;
    }
    if (!entry.name.endsWith('.html') && !entry.name.endsWith('.rsc')) continue;

    const source = await readFile(entryPath, 'utf8');
    const prepared = source
      .replaceAll('/_next/', `${basePath}/_next/`)
      .replaceAll('href="/"', `href="${basePath}/"`);

    if (prepared !== source) await writeFile(entryPath, prepared);
  }
}

await visit(clientDirectory);
