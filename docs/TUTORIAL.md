# ARCLUX Complete Tutorial 📚

**Learn ARCLUX from complete beginner to advanced user in 1-2 hours.**

This is the ONLY guide you need. It covers everything step-by-step.

---

## 📋 Table of Contents

- [Part 1: Setup & Installation](#part-1-setup--installation)
- [Part 2: Your First Analysis](#part-2-your-first-analysis)
- [Part 3: Understanding The Output](#part-3-understanding-the-output)
- [Part 4: Finding & Fixing Issues](#part-4-finding--fixing-issues)
- [Part 5: Team Workflow](#part-5-team-workflow)
- [Part 6: Advanced Features](#part-6-advanced-features)
- [Part 7: CI/CD Integration](#part-7-cicd-integration)
- [Part 8: Contributing to ARCLUX](#part-8-contributing-to-arclux)

---

# Part 1: Setup & Installation

## Prerequisites

Before starting, make sure you have:

```bash
# Check Node.js version (need 18+)
node --version

# Check npm
npm --version

# If Node version < 18, download from https://nodejs.org
```

## Installation (3 minutes)

### Step 1: Clone ARCLUX

```bash
# Copy the repository
git clone https://github.com/GSF-001/ARCLUX.git
cd ARCLUX
```

### Step 2: Install Dependencies

```bash
# Install pnpm (package manager ARCLUX uses)
npm install -g pnpm

# Install ARCLUX dependencies
pnpm install

# This takes 2-3 minutes first time. Be patient!
```

### Step 3: Verify Installation

```bash
# Check if ARCLUX works
npx tsx apps/cli/index.ts --help

# You should see list of commands. If yes, you're good! 
```

## Success Checklist

- ✅ Node.js 18+ installed
- ✅ pnpm installed globally
- ✅ ARCLUX cloned locally
- ✅ `pnpm install` completed without errors
- ✅ `npx tsx apps/cli/index.ts --help` works

**If all , move to Part 2!**

---

# Part 2: Your First Analysis

## Scenario

You have a small JavaScript/TypeScript project. You want to understand its structure.

## Step 1: Analyze Your First Project

```bash
# Go to your project folder
cd /path/to/your/project

# Run ARCLUX analysis
npx tsx /path/to/ARCLUX/apps/cli/index.ts analyze .
```

Or if analyzing ARCLUX itself:

```bash
cd ARCLUX
npx tsx apps/cli/index.ts analyze .
```

## Expected Output

```
 ARCLUX Analysis Report

  Project Summary
  • Total modules: 42
  • Total files: 156
  • Languages: TypeScript, JavaScript

 Frameworks Detected
  ✓ React
  ✓ Next.js
  ✓ TypeScript

  Issues Found: 7

   Circular Dependencies (2)
     Issue #1: src/utils/auth.ts → src/hooks/useAuth.ts → src/utils/auth.ts
     Issue #2: src/lib/form.ts → src/components/Form.tsx → src/lib/form.ts

     Unused Exports (3)
     • src/utils/old-helper.ts
     • src/config/deprecated.ts
     • src/types/legacy.ts

     Orphan Files (2)
     • src/pages/old-feature.tsx
     • src/unused/module.ts
```

## What Just Happened?

ARCLUX:
1. ✅ Scanned ALL your files
2. ✅ Parsed them (understood the code)
3. ✅ Built a dependency graph
4. ✅ Found problems automatically
5. ✅ Generated this report

**In seconds!** 

---

# Part 3: Understanding The Output

## The Report Sections (READ CAREFULLY)

###  Project Summary

```
Total modules: 42
```
**Translation:** Your project has 42 "units" of code (files/folders that can be imported).

```
Total files: 156
```
**Translation:** ARCLUX found 156 actual files.

```
Languages: TypeScript, JavaScript
```
**Translation:** Your code uses these languages.

###  Frameworks Detected

```
✓ React
✓ Next.js
```

**Translation:** ARCLUX recognized you're using React (UI library) and Next.js (web framework).

**Why it matters:** Helps ARCLUX check framework-specific conventions.

###  Issues Found

This is the IMPORTANT part. Let's break it down:

---

## Issue Type 1: Circular Dependencies 

```
Issue #1: src/utils/auth.ts → src/hooks/useAuth.ts → src/utils/auth.ts
```

### What Does This Mean?

Imagine:
```
auth.ts: "I need useAuth.ts to work"
useAuth.ts: "I need auth.ts to work"
```

**They need each other = CIRCULAR!**

### Visual:

```
     auth.ts
      /    \
     /      \
useAuth.ts ←→ (goes in circle!)
```

### Why Is This Bad?

1. **Hard to understand** - Which one to look at first?
2. **Hard to test** - Can't test one without the other
3. **Build problems** - Can cause bundle errors
4. **Performance** - Extra memory usage

### How to Fix

1. Open `src/utils/auth.ts` and `src/hooks/useAuth.ts`
2. Look at their imports
3. One of them doesn't ACTUALLY need the import from the other
4. Remove that import
5. Test your code
6. Done! ✅

**Example Fix:**

```javascript
// BEFORE (Circular)
// auth.ts
export function validateToken(token) { ... }
import { useAuth } from './hooks/useAuth'  // UNNECESSARY!

// useAuth.ts
import { validateToken } from './auth'

// AFTER (Fixed)
// auth.ts
export function validateToken(token) { ... }
// Removed: import { useAuth } - not needed here!

// useAuth.ts
import { validateToken } from './auth'  // Good!
```

---

## Issue Type 2: Unused Exports 

```
• src/utils/old-helper.ts
• src/config/deprecated.ts
```

### What Does This Mean?

```javascript
// In old-helper.ts
export function helpMe() {
  return "I help!"
}

// But in your entire project...
// NOBODY imports helpMe()
// It's never used!
```

### Why Is This Bad?

1. **Dead code** - Takes up space, confuses devs
2. **Maintenance burden** - "Do I need to update this?"
3. **Bundle bloat** - Extra bytes shipped to users

### How to Fix

**Option 1: Delete it** (if truly not used)

```bash
# Delete the file
rm src/utils/old-helper.ts

# Commit
git add .
git commit -m "Remove unused helper"
```

**Option 2: Use it somewhere**

```javascript
// If it's actually useful, import it!
import { helpMe } from './old-helper'

// Use it
const result = helpMe()
```

**Option 3: Document it**

```javascript
// If keeping for backwards compatibility:
/**
 * @deprecated Use newHelper() instead
 * Kept for backwards compatibility with v1.0
 */
export function helpMe() { ... }
```

---

## Issue Type 3: Orphan Files 

```
• src/pages/old-feature.tsx
• src/unused/module.ts
```

### What Does This Mean?

```
File exists: YES
Is it imported by anything: NO
Is it used: NO
= ORPHAN!
```

**It's a file with zero connections to your project.**

### Why Is This Bad?

1. **Confuses developers** - "Why is this file here?"
2. **Takes up space** - Waste of storage
3. **Maintenance burden** - "Should I update this?"

### How to Fix

**Option 1: Delete it**

```bash
rm src/pages/old-feature.tsx
git add .
git commit -m "Delete orphan file: old-feature"
```

**Option 2: Archive it** (if might need later)

```bash
mkdir -p archive
mv src/pages/old-feature.tsx archive/old-feature-backup.tsx
git add .
git commit -m "Archive: old-feature (not in use)"
```

**Option 3: Actually use it**

```javascript
// If the file should be used but isn't:
import { Feature } from './pages/old-feature'

// Add it to your app
export default function App() {
  return <Feature />
}
```

---

# Part 4: Finding & Fixing Issues

## Real Example: Fixing Your Project

Let's say ARCLUX found these issues:

```
Issues Found: 5
  - 1 circular dependency
  - 2 unused exports
  - 2 orphan files
```

### Step-by-Step Fix

#### Issue 1: Fix Circular Dependency (5 minutes)

```bash
# 1. Note the circular dep
# Issue: src/utils/auth.ts ↔ src/hooks/useAuth.ts

# 2. Open both files
code src/utils/auth.ts
code src/hooks/useAuth.ts

# 3. Find the unnecessary import
# Remove it

# 4. Test your code
npm run test

# 5. Run ARCLUX again
npx tsx apps/cli/index.ts analyze .
# Circular deps should be gone!
```

#### Issue 2: Remove Unused Export (3 minutes)

```bash
# 1. Confirm it's unused
# Manual check: search project for "old-helper"
grep -r "old-helper" src/
# No results = truly unused

# 2. Delete
rm src/utils/old-helper.ts

# 3. Test
npm run test

# 4. Verify
npx tsx apps/cli/index.ts analyze .
```

#### Issue 3: Delete Orphan File (1 minute)

```bash
# 1. Check if it's needed
# (probably not, since it's orphan)

# 2. Delete or archive
rm src/pages/old-feature.tsx
# OR
mv src/pages/old-feature.tsx archive/

# 3. Test
npm run test

# 4. Verify
npx tsx apps/cli/index.ts analyze .
```

### After Fixes

```bash
# Run ARCLUX again
npx tsx apps/cli/index.ts analyze .
```

Expected output:
```
Issues Found: 0 
```

**Congratulations! Clean codebase!** 

---

# Part 5: Team Workflow

## Problem Scenario

You work with 5 developers. Code quality is declining.

## Solution: ARCLUX + Team Standards

### Step 1: Add to CI/CD (GitHub Actions)

Create `.github/workflows/arclux.yml`:

```yaml
name: ARCLUX Code Quality Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  arclux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm install -g pnpm
      - run: pnpm install
      
      - name: ARCLUX Doctor
        run: npx tsx apps/cli/index.ts doctor
      
      - name: ARCLUX Verify
        run: npx tsx apps/cli/index.ts verify .
```

**Result:** Every PR gets automatic code quality check! 

### Step 2: Add Pre-Commit Hook

Create `.githooks/pre-commit`:

```bash
#!/bin/bash

echo " Running ARCLUX check..."
npx tsx apps/cli/index.ts doctor

if [ $? -ne 0 ]; then
  echo " Issues found! Fix before committing."
  exit 1
fi

echo " Code passed!"
```

Enable it:
```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

**Result:** Developers can't commit bad code! ���

### Step 3: Team Standards Document

Create `ARCLUX_STANDARDS.md`:

```markdown
# Our ARCLUX Standards

## Rules

1. ❌ Zero circular dependencies (MANDATORY)
2. ❌ No orphan files (MANDATORY)
3. ✅ Framework conventions followed (MANDATORY)
4.  Minimize unused exports (SHOULD)

## Workflow

Before committing:
```bash
npm run check  # runs ARCLUX doctor
```

Before opening PR:
```bash
npm run verify  # checks conventions
```

## Weekly Review

Every Monday: `npm run report`
Team discusses: What improved? What to fix next week?
``

---

# Part 6: Advanced Features

## Feature 1: Impact Analysis

**Scenario:** You want to refactor a file but scared it will break things.

```bash
# See what breaks if you change this file
npx tsx apps/cli/index.ts impact --file src/utils/auth.ts .
```

**Output:**

```
Files that depend on src/utils/auth.ts:

Direct consumers:
  • src/hooks/useAuth.ts
  • src/components/Login.tsx

Transitive consumers:
  • src/pages/index.tsx (via Login.tsx)
  • src/pages/admin.tsx (via useAuth.ts)
```

**Meaning:** If you change auth.ts, you MUST test these 4 files.

**Action:** Refactor safely knowing exactly what to test! 

---

## Feature 2: Dependency Graph Export

```bash
# Export full dependency graph
npx tsx apps/cli/index.ts graph . -o graph.json
```

**Now you can:**
1. Visualize in tools like D3.js
2. Process with custom scripts
3. Share with team
4. Analyze programmatically

---

## Feature 3: Verify Framework Conventions

For Next.js projects:

```bash
npx tsx apps/cli/index.ts verify .
```

**Checks:**
- ✓ Routes in correct folders
- ✓ API handlers structured right
- ✓ Imports follow patterns
- ✓ No convention violations

---

## Feature 4: Doctor Check (Quick Scan)

```bash
# Quick health check
npx tsx apps/cli/index.ts doctor
```

**Shows:**
- Any circular dependencies
- Layer violations
- Major architecture issues

**Use:** Before every commit!

---

# Part 7: CI/CD Integration

## GitHub Actions (Most Common)

We covered basic setup. Here's production-ready version:

### `.github/workflows/arclux.yml`

```yaml
name: ARCLUX Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main, develop]

jobs:
  arclux:
    name: Code Analysis
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: pnpm
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run ARCLUX Analysis
        id: arclux
        run: |
          npx tsx apps/cli/index.ts analyze . | tee analysis.log
          npx tsx apps/cli/index.ts doctor | tee doctor.log
          npx tsx apps/cli/index.ts verify . | tee verify.log
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const logs = fs.readFileSync('doctor.log', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## ARCLUX Analysis\n\n\`\`\`\n${logs}\n\`\`\``
            });
      
      - name: Fail if issues
        run: |
          if grep -q "Circular" doctor.log; then
            echo " Circular dependencies found!"
            exit 1
          fi
```

**Result:**
- ✅ Every PR analyzed automatically
- ✅ Results commented on PR
- ✅ Build fails if circular deps found
- ✅ Team sees quality metrics

---

# Part 8: Contributing to ARCLUX

## Scenario: You Want to Extend ARCLUX

Three ways to contribute:

### Way 1: Report Issues

```bash
# Found a bug?
# Go to: https://github.com/GSF-001/ARCLUX/issues
# Click "New Issue"
# Describe problem + how to reproduce
```

### Way 2: Suggest Features

```bash
# Want new feature?
# Go to: https://github.com/GSF-001/ARCLUX/issues
# Click "New Issue"
# Describe: what you want + why useful
```

### Way 3: Submit Code (Advanced)

#### Create Custom Detector

```typescript
// packages/detectors/detectMyIssue.ts

import { Repository, Finding } from "@arclux/shared/types";

export function detectMyIssue(repository: Repository): Finding[] {
  const findings: Finding[] = [];

  repository.modules.forEach(module => {
    // Check for your issue
    if (hasMyIssue(module)) {
      findings.push({
        type: "my-issue",
        severity: "warning",
        module: module.id,
        message: "Clear description of issue",
        affected: [module.id]
      });
    }
  });

  return findings;
}
```

#### Register It

In `packages/detectors/index.ts`:

```typescript
import { detectMyIssue } from "./detectMyIssue";

export const DETECTOR_REGISTRY = [
  // ... existing detectors ...
  detectMyIssue  // ADD YOUR DETECTOR
];
```

#### Test It

```bash
pnpm test
npx tsx apps/cli/index.ts doctor  # Your detector runs!
```

#### Submit PR

```bash
git push origin feature/detect-my-issue
# Open PR on GitHub
# Explain what your detector does
# GSF-001 reviews + merges! 🎉
```

---

## Recap: A-Z Journey

| Stage | What | Time | Result |
|-------|------|------|--------|
| 1 | Install & Setup | 5 min | Working ARCLUX |
| 2 | First Analysis | 5 min | Understand your project |
| 3 | Read Output | 10 min | Know what problems exist |
| 4 | Fix Issues | 15 min | Clean codebase |
| 5 | Team Setup | 15 min | CI/CD + standards |
| 6 | Advanced | 15 min | Impact analysis + graphs |
| 7 | Integration | 20 min | Production-ready workflow |
| 8 | Contribute | 30 min | Submit to ARCLUX |

**TOTAL: ~2 hours to become ARCLUX power user!** 

---

## Common Questions (FAQ)

### Q: How often should I run ARCLUX?

**A:**
- **Before committing:** Every time
- **Before PR:** Every time
- **Weekly:** Generate report for team
- **CI/CD:** Automatically on every PR

### Q: Can ARCLUX delete files?

**A:** NO! ARCLUX only READS. It never modifies your code.

### Q: What if I disagree with ARCLUX findings?

**A:** That's fine! ARCLUX is technical (circular deps ARE bad). If you disagree, document why.

### Q: Can I ignore certain issues?

**A:** Yes! Discuss with team. If consensus: can document as intentional.

### Q: How fast is ARCLUX?

**A:**
- Small project (50 files): <1 second
- Medium project (500 files): 5-10 seconds
- Large project (5000 files): 30-60 seconds

### Q: What's the learning curve?

**A:** This tutorial covers 90% of what you need!

---

## Next Steps

1. **Now:** Run ARCLUX on your project
2. **Today:** Fix any issues found
3. **Tomorrow:** Setup CI/CD with GitHub Actions
4. **This week:** Add to team workflow
5. **Next month:** Consider contributing code

---

## Resources

- Original repo: https://github.com/GSF-001/ARCLUX
- Fork your copy: Click "Fork" button
- Submit feedback: Open issue on GitHub
- Chat with community: GitHub Discussions

---

**You've completed ARCLUX Tutorial!** 🎓

You now know:
- ✅ How to install
- ✅ How to analyze projects
- ✅ How to understand output
- ✅ How to fix issues
- ✅ How to use in teams
- ✅ How to use advanced features
- ✅ How to integrate with CI/CD
- ✅ How to contribute

**Go make your codebase amazing!** 🚀
