# ARCLUX Architecture Deep Dive 🏗️

Understanding ARCLUX's internal design and how everything connects.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Data Model](#data-model)
3. [The Pipeline in Detail](#the-pipeline-in-detail)
4. [Parser Architecture](#parser-architecture)
5. [Indexer Algorithm](#indexer-algorithm)
6. [Graph Construction](#graph-construction)
7. [Detector Pattern](#detector-pattern)
8. [Performance Considerations](#performance-considerations)

---

## Core Concepts

### Repository Model

Everything in ARCLUX is about the `Repository` object:

```typescript
interface Repository {
  rootPath: string;
  modules: Module[];  // All code modules
  files: File[];      // All files
  dependencies: Map<string, Module[]>;  // What depends on what
  metadata: {
    detectedFrameworks: string[];
    languages: string[];
    totalLines: number;
  };
}
```

### The Three Levels of Abstraction

**Level 1: Files**
```
MyProject/
├── src/
│   ├── utils/
│   │   └── helper.ts
│   └── Button.tsx
```

**Level 2: Modules** (importable units)
```
src/utils/helper.ts exports:
  - function helper()

src/Button.tsx imports:
  - from src/utils/helper
```

**Level 3: Graph** (relationships)
```
Button.tsx → helper.ts
```

---

## Data Model

### Module

```typescript
interface Module {
  id: string;                    // unique ID
  name: string;                  // display name
  filePath: string;              // relative path
  type: "file" | "directory" | "virtual";
  
  imports: Import[];             // What this module imports
  exports: Export[];             // What this module exports
  dependencies: Dependency[];    // Resolved dependencies
  
  language: "typescript" | "python" | "go" | "java" | "javascript";
  content?: string;              // Optional file content
  warning?: string[];            // Issues found
}
```

### Import

```typescript
interface Import {
  source: string;               // raw import string: "./helper"
  resolvedTo?: string;          // resolved module ID
  line: number;                 // line number
  type: "es6" | "commonjs" | "path-alias" | "relative";
  
  // For TypeScript/JavaScript
  specifiers?: string[];        // what's being imported: ["Button", "useButton"]
  
  // Status
  resolved: boolean;            // Did we resolve it?
  warning?: string;             // Why didn't we resolve it?
}
```

### Export

```typescript
interface Export {
  name: string;                 // what's exported: "Button"
  type: "default" | "named";
  line: number;
  
  // Optional details
  kind?: "function" | "class" | "variable" | "type";
}
```

### Dependency

```typescript
interface Dependency {
  from: Module;
  to: Module;
  type: "import" | "require" | "circular";
  weight: number;               // connection strength
  transitiveDepth?: number;     // how many hops
}
```

---

## The Pipeline in Detail

### Step 1: Git Operations

```typescript
// packages/git/clone.ts
export async function cloneRepository(
  repoUrl: string,
  targetDir: string
): Promise<void> {
  // 1. Clone to temp directory
  // 2. Checkout default branch
  // 3. Return path
}
```

**What happens:**
```
Input: https://github.com/user/repo.git
  ↓
Git clone to /tmp/arclux-XXXXX
  ↓
Read .gitignore
  ↓
Checkout ARCLUX.main or main branch
  ↓
Output: /tmp/arclux-XXXXX
```

---

### Step 2: Parsing

```typescript
// packages/parser/index.ts
export class MultiLanguageParser {
  async parseFile(filePath: string): Promise<ParsedFile> {
    // 1. Detect language
    const language = this.detectLanguage(filePath);
    
    // 2. Get parser for language
    const parser = PARSER_REGISTRY.find(p => p.supports(filePath));
    
    // 3. Parse file
    return parser.parse(filePath);
  }
}
```

**For TypeScript:**
```typescript
// packages/parser/typescript/parse.ts
export function parseTypeScript(filePath: string): ParsedFile {
  // 1. Create AST using TypeScript Compiler API
  const ast = createSourceFile(
    filePath,
    readFileSync(filePath, "utf-8"),
    ScriptTarget.Latest,
    true
  );

  // 2. Walk AST and extract imports
  const imports = extractImports(ast, filePath);
  
  // 3. Walk AST and extract exports
  const exports = extractExports(ast);
  
  // 4. Walk AST and extract nodes (functions, classes)
  const nodes = extractNodes(ast);

  return { imports, exports, nodes, warnings: [] };
}

function extractImports(ast: SourceFile, filePath: string): Import[] {
  const imports: Import[] = [];

  visitNode(ast, node => {
    if (isImportDeclaration(node)) {
      const source = node.moduleSpecifier.text;
      const specifiers = node.importClause?.namedBindings
        ? /* extract names */
        : [];

      imports.push({
        source,
        specifiers,
        line: ast.getLineAndCharacterOfPosition(node.getStart()).line,
        type: detectImportType(source)
      });
    }
  });

  return imports;
}
```

---

### Step 3: Indexing

```typescript
// packages/indexer/buildIndex.ts
export async function buildIndex(
  rootPath: string,
  meta: AnalysisMeta
): Promise<Repository> {
  // 1. Collect all files
  const files = await collectFiles(rootPath);

  // 2. Parse all files in parallel
  const parsedFiles = await Promise.all(
    files.map(file => parser.parseFile(file))
  );

  // 3. Create modules from parsed files
  const modules = createModules(files, parsedFiles);

  // 4. CRITICAL: Resolve imports
  await resolveImports(modules, rootPath);

  // 5. Resolve exports
  resolveExports(modules);

  // 6. Build dependency map
  const dependencies = buildDependencyMap(modules);

  return {
    rootPath,
    modules,
    files,
    dependencies,
    metadata: meta
  };
}
```

### Import Resolution Deep Dive

This is the hardest part!

```typescript
// packages/indexer/resolveImports.ts
async function resolveImports(modules: Module[], rootPath: string) {
  modules.forEach(module => {
    module.imports.forEach(imp => {
      // 1. Try direct path
      imp.resolvedTo = tryResolvePath(imp.source, module, rootPath);

      // 2. Try TypeScript path aliases
      if (!imp.resolvedTo) {
        imp.resolvedTo = tryResolvePathAlias(imp.source, rootPath);
      }

      // 3. Try node_modules
      if (!imp.resolvedTo) {
        imp.resolvedTo = tryResolveNodeModule(imp.source, rootPath);
      }

      // 4. Try framework-specific resolution
      if (!imp.resolvedTo) {
        imp.resolvedTo = tryResolveFramework(imp.source, module, rootPath);
      }

      // 5. Mark as unresolved if failed
      if (!imp.resolvedTo) {
        imp.warning = `Could not resolve ${imp.source}`;
        imp.resolved = false;
      } else {
        imp.resolved = true;
      }
    });
  });
}

// Example: TypeScript path alias resolution
function tryResolvePathAlias(source: string, rootPath: string): string | undefined {
  const tsconfig = readTsconfigJson(rootPath);
  
  for (const [alias, paths] of Object.entries(tsconfig.compilerOptions.paths)) {
    if (source.startsWith(alias.replace("/*", ""))) {
      const actualPath = paths[0].replace("/*", "");
      return resolveToModule(actualPath, source, alias);
    }
  }
}
```

---

## Graph Construction

### Dependency Graph

```typescript
// packages/graph/buildDependencyGraph.ts
export function buildDependencyGraph(
  repository: Repository
): DependencyGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 1. Create node for each module
  repository.modules.forEach(module => {
    nodes.push({
      id: module.id,
      label: module.name,
      type: module.type,
      size: calculateSize(module),
      metadata: {
        path: module.filePath,
        language: module.language,
        imports: module.imports.length,
        exports: module.exports.length
      }
    });
  });

  // 2. Create edges for each import
  repository.modules.forEach(source => {
    source.imports.forEach(imp => {
      if (imp.resolved && imp.resolvedTo) {
        edges.push({
          source: source.id,
          target: imp.resolvedTo,
          type: "import",
          weight: calculateWeight(source, imp),
          transitivity: "direct"
        });
      }
    });
  });

  // 3. Calculate transitive edges
  calculateTransitiveDependencies(nodes, edges);

  return {
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      cycleCount: detectCycles(edges).length
    }
  };
}
```

### Call Graph (Advanced)

```typescript
// packages/graph/buildCallGraph.ts
export function buildCallGraph(repository: Repository): CallGraph {
  // 1. Extract all function definitions
  const functions = extractAllFunctions(repository);

  // 2. Extract all function calls
  const calls = extractAllCalls(repository);

  // 3. Match calls to definitions
  const edges: CallEdge[] = [];
  calls.forEach(call => {
    const definition = findFunctionDefinition(call.name, functions);
    if (definition) {
      edges.push({
        from: call,
        to: definition,
        type: "call"
      });
    }
  });

  return { functions, edges };
}

// This is complex because:
// - Same function name in different modules
// - Aliased imports
// - Dynamic calls (can't always resolve)
// - Metaprogramming
```

---

## Detector Pattern

All 20 detectors follow same pattern:

```typescript
export function detect<Issue>(repository: Repository): Finding[] {
  const findings: Finding[] = [];

  repository.modules.forEach(module => {
    // Check if this module has the issue

    if (hasIssue(module)) {
      findings.push({
        type: "issue-type",
        severity: "error" | "warning" | "info",
        module: module.id,
        message: "Clear message",
        affected: [module.id, ...otherAffectedModules],
        details: {
          // Custom details for this issue type
        }
      });
    }
  });

  return findings;
}
```

### Example: Circular Dependency Detection

```typescript
// packages/detectors/detectCircularDependency.ts
export function detectCircularDependency(
  repository: Repository
): Finding[] {
  const findings: Finding[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(moduleId: string, path: string[]): void {
    visited.add(moduleId);
    recursionStack.add(moduleId);

    const module = repository.modules.find(m => m.id === moduleId);
    if (!module) return;

    module.imports.forEach(imp => {
      if (!imp.resolved || !imp.resolvedTo) return;

      if (!visited.has(imp.resolvedTo)) {
        dfs(imp.resolvedTo, [...path, moduleId]);
      } else if (recursionStack.has(imp.resolvedTo)) {
        // Found cycle!
        const cycle = path.slice(
          path.indexOf(imp.resolvedTo)
        );

        findings.push({
          type: "circular-dependency",
          severity: "error",
          module: moduleId,
          message: `Circular dependency: ${cycle.join(" → ")}`,
          affected: cycle,
          details: {
            cycle: cycle.map(id => 
              repository.modules.find(m => m.id === id)?.name
            ),
            complexity: cycle.length
          }
        });
      }
    });

    recursionStack.delete(moduleId);
  }

  repository.modules.forEach(module => {
    if (!visited.has(module.id)) {
      dfs(module.id, []);
    }
  });

  return findings;
}
```

---

## Performance Considerations

### Why It's Fast

1. **Streaming parsing** - Parse files as read
2. **Parallel processing** - Parse multiple files at once
3. **Lazy evaluation** - Only compute what's needed
4. **Caching** - Cache results of expensive operations

### Bottlenecks

```
File I/O              60% (reading all files)
Parsing               25% (AST generation)
Resolution           10% (import resolution)
Analysis              5% (detectors)
```

### Optimization Strategies

```typescript
// Strategy 1: Parallel parsing
const results = await Promise.all(
  files.map(f => parseFile(f))
);

// Strategy 2: Cached resolution
const cache = new Map<string, string>();

function resolveWithCache(source: string): string | undefined {
  if (cache.has(source)) {
    return cache.get(source);
  }
  const result = slowResolve(source);
  cache.set(source, result);
  return result;
}

// Strategy 3: Limit depth
// Don't traverse too deeply into node_modules
```

---

## Thread Model

ARCLUX is **synchronous** by design:

```
Input
  ↓
Sequential processing (no race conditions)
  ↓
Output
```

Benefits:
- Easy to understand
- No race conditions
- Simple error handling

Trade-off:
- Slower than parallel on large projects
- But still fast enough!

---

## Extensibility Hooks

Where you can extend ARCLUX:

1. **Add parser** → `PARSER_REGISTRY`
2. **Add detector** → `DETECTOR_REGISTRY`
3. **Add graph type** → Call from CLI
4. **Add rule** → `RULES_REGISTRY`
5. **Custom analysis** → Use programmatic API

All without modifying core!

---

## Error Handling

```typescript
// ARCLUX defines custom error type
export class ArcluxError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message);
  }
}

// Usage:
throw new ArcluxError(
  "UNRESOLVED_IMPORT",
  `Could not resolve: ${source}`,
  { source, from: modulePath }
);
```

---

## Design Principles

1. **Single Responsibility** - Each package does one thing
2. **Dependency Injection** - Pass Repository around
3. **Immutability** - Don't modify Repository
4. **Composition** - Build complex behavior from simple pieces
5. **Testability** - Everything can be tested in isolation

These make ARCLUX:
- Easy to understand
- Easy to extend
- Easy to test
- Easy to maintain

---

**Ready to dive into code? Start with `packages/engine/pipeline.ts`! 🚀**
