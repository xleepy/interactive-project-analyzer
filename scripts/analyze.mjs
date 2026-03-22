#!/usr/bin/env node
/**
 * analyze.mjs
 * Usage: node scripts/analyze.mjs <path-to-project> [--out <output-dir>]
 *
 * Analyzes a TypeScript project and writes analysis JSON files to the output dir.
 * Output files:
 *   dependencies.json  — flat adjacency list (file → [imported files])
 *   tree.json          — folder hierarchy with file nodes and aggregated deps
 *   circular.json      — list of circular dependency chains
 *   meta.json          — project metadata (file count, ext breakdown, timestamp)
 */

import madge from 'madge';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, extname, join } from 'path';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('Usage: node scripts/analyze.mjs <project-path> [--out <dir>]');
  process.exit(0);
}

const projectPath = resolve(args[0]);
const outIndex = args.indexOf('--out');
const outputDir = resolve(outIndex !== -1 ? args[outIndex + 1] : 'src/data/analysis');

mkdirSync(outputDir, { recursive: true });

console.log(`Analyzing: ${projectPath}`);
console.log(`Output:    ${outputDir}\n`);

// ── Run madge ─────────────────────────────────────────────────────────────────

const result = await madge(projectPath, {
  fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  tsConfig: findTsConfig(projectPath),
  detectiveOptions: {
    ts: { skipTypeImports: false },
    tsx: { skipTypeImports: false },
  },
  excludeRegExp: [/node_modules/, /\.d\.ts$/],
});

const dependencies = result.obj();       // { 'src/foo.ts': ['src/bar.ts'] }
const circular     = result.circular();  // [['a.ts', 'b.ts', 'a.ts'], ...]
const warnings     = result.warnings();

// ── Build folder tree ─────────────────────────────────────────────────────────

function buildTree(deps) {
  const root = { name: '', type: 'folder', path: '', children: {}, imports: [], importedBy: [] };

  // build reverse map
  const importedBy = {};
  for (const [file, imports] of Object.entries(deps)) {
    for (const imp of imports) {
      (importedBy[imp] ??= []).push(file);
    }
  }

  // insert each file into the tree
  for (const [file, imports] of Object.entries(deps)) {
    const parts = file.split('/');
    let node = root;

    // create folder nodes along the path
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      node.children[part] ??= {
        name: part,
        type: 'folder',
        path: parts.slice(0, i + 1).join('/'),
        children: {},
        imports: [],
        importedBy: [],
      };
      node = node.children[part];
    }

    // create the file node
    const fileName = parts[parts.length - 1];
    node.children[fileName] = {
      name: fileName,
      type: 'file',
      path: file,
      ext: extname(fileName).slice(1),
      imports,
      importedBy: importedBy[file] ?? [],
    };
  }

  return collapseTree(root);
}

/** Convert children objects to sorted arrays, collapse single-child folders */
function collapseTree(node) {
  if (node.type === 'file') return node;

  const children = Object.values(node.children).map(collapseTree);
  children.sort((a, b) => {
    // folders first, then files, both alphabetically
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // aggregate imports/importedBy for folder nodes
  const allImports = new Set();
  const allImportedBy = new Set();
  for (const child of children) {
    child.imports?.forEach(i => allImports.add(i));
    child.importedBy?.forEach(i => allImportedBy.add(i));
  }

  return {
    ...node,
    children,
    imports: [...allImports],
    importedBy: [...allImportedBy],
  };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

function buildMeta(deps, projectPath) {
  const files = Object.keys(deps);
  const extCounts = {};
  for (const f of files) {
    const ext = extname(f).slice(1) || 'unknown';
    extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  }

  const allEdges = Object.values(deps).reduce((sum, imports) => sum + imports.length, 0);
  const externalDeps = new Set();
  for (const imports of Object.values(deps)) {
    for (const imp of imports) {
      if (!deps[imp] && !imp.startsWith('.')) externalDeps.add(imp);
    }
  }

  return {
    analyzedAt: new Date().toISOString(),
    projectPath,
    fileCount: files.length,
    edgeCount: allEdges,
    circularCount: circular.length,
    extensionBreakdown: extCounts,
    externalDependencies: [...externalDeps].sort(),
    warnings,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findTsConfig(dir) {
  const candidate = join(dir, 'tsconfig.json');
  return existsSync(candidate) ? candidate : undefined;
}

// ── Write output ──────────────────────────────────────────────────────────────

const tree = buildTree(dependencies);
const meta = buildMeta(dependencies, projectPath);

const write = (name, data) => {
  const filePath = join(outputDir, name);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  wrote ${name} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
};

write('dependencies.json', dependencies);
write('tree.json', tree);
write('circular.json', circular);
write('meta.json', meta);

console.log(`\nDone.`);
console.log(`  ${meta.fileCount} files, ${meta.edgeCount} edges, ${meta.circularCount} circular chains`);
if (warnings.skipped?.length) {
  console.warn(`  Warnings: ${warnings.skipped.length} files skipped`);
}
