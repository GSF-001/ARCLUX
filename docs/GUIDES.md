# Framework-Specific Guides 

Using ARCLUX with your specific framework? Here's what to look for!

---

## Next.js Projects 

### What ARCLUX Checks for Next.js

When you run:
```bash
npx tsx apps/cli/index.ts verify .
```

ARCLUX checks:
1. App Router structure (pages in `/app`)
2. API routes (must be in `/app/api`)
3. Layout organization
4. Component placement

### Expected Output Example

```
Next.js Convention Check
========================

✓ Route /dashboard → app/dashboard/page.tsx exists
✓ API /api/users → app/api/users/route.ts exists
✗ Route /old-page → NO CORRESPONDING FILE FOUND
✗ Component imports server-only lib in client component
```

### Common Issues & Fixes

**Issue: "Route /old-page → NO CORRESPONDING FILE FOUND"**
- **Meaning:** You have a route defined but no actual file
- **Fix:** Create the missing page.tsx OR remove the reference

**Issue: "Component imports server-only lib in client component"**
- **Meaning:** Using server-only code in client component
- **Fix:** Add `"use client"` directive at top of file

### Tips for Next.js

```bash
# Check your Next.js project
npx tsx apps/cli/index.ts verify .

# Analyze impact before refactoring app structure
npx tsx apps/cli/index.ts impact --file app/layout.tsx .

# Find unused components in your app
npx tsx apps/cli/index.ts doctor
```

---

## NestJS Projects 

### What ARCLUX Checks for NestJS

ARCLUX verifies:
1. Module organization
2. Service dependencies
3. Controller structure
4. Circular dependencies (major issue!)

### Expected Structure

```
src/
  ├── users/
  │   ├── users.module.ts
  │   ├── users.service.ts
  │   └── users.controller.ts
  ├── auth/
  │   ├── auth.module.ts
  │   ├── auth.service.ts
  │   └── auth.controller.ts
```

### Common Issues & Fixes

**Issue: "Circular dependency in NestJS modules"**
- **Meaning:** Module A imports Module B, and vice versa
- **Fix:** Refactor to extract shared logic to third module

**Issue: "Service imported directly instead of via Module"**
- **Meaning:** Breaking NestJS dependency injection pattern
- **Fix:** Import via Module, not direct service

### Tips for NestJS

```bash
# Check module structure
npx tsx apps/cli/index.ts analyze .

# Find problematic circular imports
npx tsx apps/cli/index.ts doctor | grep Circular

# Check what depends on auth module
npx tsx apps/cli/index.ts impact --file src/auth/auth.module.ts .
```

---

## Express Projects 

### What ARCLUX Checks for Express

ARCLUX verifies:
1. Route organization
2. Middleware structure
3. Controller isolation
4. Service layer separation

### Expected Structure

```
src/
  ├── routes/
  │   ├── users.ts
  │   └── products.ts
  ├── controllers/
  │   ├── usersController.ts
  │   └── productsController.ts
  ├── services/
  │   ├── userService.ts
  │   └── productService.ts
  └── app.ts (entry point)
```

### Common Issues & Fixes

**Issue: "Controller imports from routes"**
- **Meaning:** Breaking layer separation
- **Fix:** Routes import controllers, not vice versa

**Issue: "Business logic in routes"**
- **Meaning:** Not using controller/service pattern
- **Fix:** Move logic to service, call from controller

### Tips for Express

```bash
# Analyze your Express project
npx tsx apps/cli/index.ts analyze .

# Check if controllers are properly separated
npx tsx apps/cli/index.ts graph --filter controllers

# Find unused services
npx tsx apps/cli/index.ts doctor
```

---

## React Projects 

### What ARCLUX Checks for React

ARCLUX verifies:
1. Component structure
2. Hook organization
3. State management patterns
4. Dead components

### Expected Structure

```
src/
  ├── components/
  │   ├── Button/
  │   ├── Card/
  │   └── Modal/
  ├── hooks/
  │   ├── useAuth.ts
  │   └── useForm.ts
  ├── pages/
  │   └── Home.tsx
  └── App.tsx
```

### Common Issues & Fixes

**Issue: "Component never imported anywhere"**
- **Meaning:** Orphan component
- **Fix:** Delete or find use for it

**Issue: "Hook used in multiple places"**
- **Meaning:** Good! Reusable logic
- **Keep:** This is the pattern to follow

### Tips for React

```bash
# Analyze component structure
npx tsx apps/cli/index.ts analyze .

# Check what uses your custom hook
npx tsx apps/cli/index.ts impact --file src/hooks/useAuth.ts .

# Find unused components
npx tsx apps/cli/index.ts graph | grep "import.*component"
```

---

## TypeScript Projects 

### What ARCLUX Checks for TypeScript

ARCLUX verifies:
1. Type imports vs value imports
2. Module boundaries
3. Interface usage
4. Type organization

### Expected Structure

```
src/
  ├── types/
  │   ├── user.ts
  │   └── api.ts
  ├── interfaces/
  │   ├── IUser.ts
  │   └── IProduct.ts
  ├── models/
  │   └── User.ts
  └── index.ts
```

### Common Issues & Fixes

**Issue: "Type imported as value"**
- **Meaning:** Using `import { Type }` instead of `import type { Type }`
- **Fix:** Use `import type` for types only

**Issue: "Circular type dependencies"**
- **Meaning:** Type A references Type B, Type B references Type A
- **Fix:** Refactor to extract common types

### Tips for TypeScript

```bash
# Analyze type structure
npx tsx apps/cli/index.ts analyze .

# Check what depends on your types file
npx tsx apps/cli/index.ts impact --file src/types/user.ts .

# Find unused type definitions
npx tsx apps/cli/index.ts graph
```

---

## Multi-Language Projects 

### Using ARCLUX with Multiple Languages

ARCLUX supports:
- TypeScript
- JavaScript
- Python
- Go
- Java

### How to Use

```bash
# Analyze entire monorepo
npx tsx apps/cli/index.ts analyze .

# It will:
# - Parse TypeScript files with TS parser
# - Parse Python files with Tree-sitter
# - Parse Go files with Tree-sitter
# - Parse Java files with Tree-sitter
```

### Example: Mixed TS + Python Project

```
project/
  ├── frontend/      (TypeScript)
  ├── backend/       (Python)
  └── scripts/       (Go)
```

Output:
```
  Project Summary
  • Total modules: 35
  • Total files: 120
  • Languages: TypeScript, Python, Go
```

### Tips for Multi-Language Projects

```bash
# Analyze everything
npx tsx apps/cli/index.ts analyze .

# Check frontend specifically
npx tsx apps/cli/index.ts analyze ./frontend

# Check backend specifically
npx tsx apps/cli/index.ts analyze ./backend
```

---

## Monorepo Projects 

### Using ARCLUX with Monorepos

ARCLUX works great with monorepos:

```bash
# Analyze entire monorepo
npx tsx apps/cli/index.ts analyze .

# Or specific package
npx tsx apps/cli/index.ts analyze packages/ui
```

### Typical Monorepo Structure

```
monorepo/
  ├── packages/
  │   ├── core/
  │   ├── ui/
  │   ├── api/
  │   └── cli/
  └── apps/
      ├── web/
      └── mobile/
```

### Benefits for Monorepos

1. **See cross-package dependencies**
   ```bash
   npx tsx apps/cli/index.ts graph | grep "packages/"
   ```

2. **Check for circular imports between packages**
   ```bash
   npx tsx apps/cli/index.ts doctor
   ```

3. **Understand impact of changes**
   ```bash
   npx tsx apps/cli/index.ts impact --file packages/core/index.ts .
   ```

---

## Don't See Your Framework?

ARCLUX works with any TypeScript/JavaScript project!

The guides above are just recommendations.
You can still:
- ✅ Run `analyze`
- ✅ Find circular dependencies
- ✅ Check impact analysis
- ✅ Find dead code

It all works! Try it out! 

---

**Pick your framework above and get started! 🎉**
