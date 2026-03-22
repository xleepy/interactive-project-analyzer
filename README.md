# Interactive Project Analyzer

Visualize the dependency graph of any TypeScript/JavaScript project as an interactive, collapsible folder tree.

## Setup

```bash
npm install
```

## Analyze a project

```bash
npm run analyze -- <path-to-project>
```

Output is written to `src/data/analysis/` by default:

| File | Description |
|---|---|
| `dependencies.json` | Flat adjacency list — `{ "src/foo.ts": ["src/bar.ts"] }` |
| `tree.json` | Nested folder hierarchy with imports/importedBy per node |
| `circular.json` | Circular dependency chains |
| `meta.json` | File count, edge count, extension breakdown, timestamp |

### Examples

```bash
# analyze this project itself
npm run analyze -- .

# analyze another project
npm run analyze -- ../my-other-project

# custom output directory
npm run analyze -- ../my-other-project --out public/analysis
```

## Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to explore the graph.

## Build

```bash
npm run build
```
