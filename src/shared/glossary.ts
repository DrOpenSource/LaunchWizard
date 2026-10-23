export interface GlossaryEntry {
  code: string;
  badge: string;
  friendlyTitle: string;
  explanation: string;
  whyItBreaks: string;
  actionPrompt: string;
  autoFixAvailable: boolean;
  healerId?: string;
}

export const ERROR_GLOSSARY: Record<string, GlossaryEntry> = {
  // TypeScript Module & Import Errors
  TS2307: {
    code: 'TS2307',
    badge: '📦 Missing Module',
    friendlyTitle: 'Cannot Find Module or File',
    explanation:
      'Your code imports a file, component, or package that does not exist or has a typo in its path.',
    whyItBreaks:
      'Vercel and Cloudflare production bundlers will halt the build immediately if an import path cannot be resolved.',
    actionPrompt:
      'Check the import spelling, verify the relative path (e.g. "./components/Button"), or install the missing package.',
    autoFixAvailable: true,
    healerId: 'fix-missing-import',
  },

  // TypeScript Type Mismatch
  TS2322: {
    code: 'TS2322',
    badge: '⚡ Type Mismatch',
    friendlyTitle: 'Value Type Does Not Match',
    explanation:
      'You are trying to pass a value of one type into a property or variable expecting a different type (for example, passing text into a number field).',
    whyItBreaks:
      'TypeScript strict mode in production builds prevents potential runtime crashes by rejecting mismatched types.',
    actionPrompt:
      'Convert the value to the expected type or update the interface/prop definition.',
    autoFixAvailable: true,
    healerId: 'safe-type-cast',
  },

  // TypeScript Property Does Not Exist / Possible Undefined
  TS2339: {
    code: 'TS2339',
    badge: '🔍 Missing Property',
    friendlyTitle: 'Property Does Not Exist on Object',
    explanation:
      'You are accessing a field on an object (e.g., `user.avatar`) that TypeScript does not know about.',
    whyItBreaks:
      'If the object does not have that field at runtime, your web page may crash with a white screen.',
    actionPrompt:
      'Use optional chaining (`user?.avatar`) or define the property in the TypeScript type.',
    autoFixAvailable: true,
    healerId: 'optional-chaining',
  },

  // TypeScript Implicit Any
  TS7006: {
    code: 'TS7006',
    badge: '🏷️ Missing Type',
    friendlyTitle: 'Parameter Needs a Type',
    explanation:
      'A function argument was created without an explicit type, so TypeScript defaulted it to "any".',
    whyItBreaks:
      'Next.js and strict TypeScript setups reject implicit "any" parameters during `next build`.',
    actionPrompt:
      'Add a type annotation to the parameter (e.g. `(id: string)` or `(item: any)`).',
    autoFixAvailable: true,
    healerId: 'annotate-param',
  },

  // TypeScript Overload Call Mismatch
  TS2769: {
    code: 'TS2769',
    badge: '⚠️ Argument Mismatch',
    friendlyTitle: 'Wrong Arguments Passed to Function',
    explanation:
      'The arguments passed to this function call do not match any of its expected parameter signatures.',
    whyItBreaks:
      'Strict production compilers catch function signature mismatches to prevent runtime invocation exceptions.',
    actionPrompt:
      'Check the function definition and supply the required arguments in the correct order.',
    autoFixAvailable: false,
  },

  // TypeScript Empty Config Inputs
  TS18003: {
    code: 'TS18003',
    badge: '⚙️ Config Issue',
    friendlyTitle: 'No Matching Files in TypeScript Config',
    explanation:
      'The "include" glob in tsconfig.json did not match any source files.',
    whyItBreaks:
      'The build system cannot locate entry points to compile.',
    actionPrompt:
      'Verify that tsconfig.json has a valid include rule, such as ["src/**/*", "app/**/*"].',
    autoFixAvailable: true,
    healerId: 'fix-tsconfig-include',
  },

  // Next.js Server / Client Component Boundary Traps
  USE_CLIENT_MISSING: {
    code: 'USE_CLIENT_MISSING',
    badge: '⚛️ Missing "use client"',
    friendlyTitle: 'Interactive Hook in Server Component',
    explanation:
      'You used a React Hook (`useState`, `useEffect`, `useRouter`) or browser event (`onClick`) inside a Next.js Server Component.',
    whyItBreaks:
      'Next.js App Router renders server components on the server where browser hooks and click events do not exist.',
    actionPrompt:
      'Add \'use client\'; as the very first line of this file.',
    autoFixAvailable: true,
    healerId: 'add-use-client',
  },

  // SSR Window / Document Undefined
  SSR_WINDOW_UNDEFINED: {
    code: 'SSR_WINDOW_UNDEFINED',
    badge: '🌐 Window / Document in SSR',
    friendlyTitle: 'Browser API Called on Server',
    explanation:
      'Code directly referenced `window`, `document`, or `localStorage` during server-side prerendering.',
    whyItBreaks:
      'During static generation (SSG) on Vercel, Node.js has no `window` object, crashing the build.',
    actionPrompt:
      'Wrap browser API calls in a `useEffect` hook or check `typeof window !== "undefined"`.',
    autoFixAvailable: true,
    healerId: 'guard-window-check',
  },

  // Environment Variable Leaks & Unprefixed Client Secrets
  ENV_LEAK_OR_UNDEFINED: {
    code: 'ENV_LEAK_OR_UNDEFINED',
    badge: '🔐 Client Secret Trap',
    friendlyTitle: 'Missing NEXT_PUBLIC_ Prefix',
    explanation:
      'This client component reads an environment variable that is missing the "NEXT_PUBLIC_" prefix.',
    whyItBreaks:
      'Next.js hides non-public environment variables from client bundles for security. In production, this value will be undefined.',
    actionPrompt:
      'If the value is safe for anyone to see, rename it to NEXT_PUBLIC_<NAME> in your code AND in your .env file. If it is private, read it in server code (a Route Handler or Server Action) instead.',
    autoFixAvailable: false,
  },

  // Import path letter case differs from the file on disk
  IMPORT_CASE_MISMATCH: {
    code: 'IMPORT_CASE_MISMATCH',
    badge: '🔤 Import Letter Case',
    friendlyTitle: 'Import Works Here, Breaks on the Server',
    explanation:
      'An import uses different capital letters than the real file name (e.g. "./button" for "Button.tsx").',
    whyItBreaks:
      'Windows and macOS ignore letter case, so it works on your machine. Vercel and Cloudflare build on Linux, which treats it as a missing file.',
    actionPrompt:
      'Use the 1-click fix to match the import to the exact file name.',
    autoFixAvailable: true,
  },

  // .env value cut off at '#'
  ENV_VALUE_TRUNCATED: {
    code: 'ENV_VALUE_TRUNCATED',
    badge: '✂️ .env Value Cut Off',
    friendlyTitle: 'Part of This .env Value Is Ignored',
    explanation:
      'A value in your .env file contains "#" without quotes, so everything after it is treated as a comment.',
    whyItBreaks:
      'Passwords and URLs with "#" silently arrive shortened, causing login and connection failures that are hard to trace.',
    actionPrompt:
      'Wrap the value in double quotes. The 1-click fix does this for you.',
    autoFixAvailable: true,
  },

  // Next.js build-time type error
  NEXT_TYPE_ERROR: {
    code: 'NEXT_TYPE_ERROR',
    badge: '🧩 Build Type Error',
    friendlyTitle: 'The Production Build Found a Type Error',
    explanation:
      'Next.js type-checks your code during `next build` and found a problem.',
    whyItBreaks:
      'Vercel runs the same build, so this exact error will stop your deployment.',
    actionPrompt:
      'Open the file and line shown and fix the type mismatch, then run the build check again.',
    autoFixAvailable: false,
  },

  // Build failed without a parseable error
  BUILD_FAILED: {
    code: 'BUILD_FAILED',
    badge: '🏗️ Build Failed',
    friendlyTitle: 'The Production Build Failed',
    explanation:
      'Your framework\'s production build stopped with an error. The last lines of its output are shown.',
    whyItBreaks:
      'The deploy server runs the same build command, so the deployment will fail the same way.',
    actionPrompt:
      'Open the LaunchWizard output log to see the full build output, fix the first error, and try again.',
    autoFixAvailable: false,
  },

  BUILD_TIMEOUT: {
    code: 'BUILD_TIMEOUT',
    badge: '⏱️ Build Timed Out',
    friendlyTitle: 'The Production Build Took Too Long',
    explanation:
      'The build was stopped before it finished, so its result is unknown.',
    whyItBreaks:
      'An unfinished build is not a passing build.',
    actionPrompt:
      'Check the output log for a step that hangs (often a network fetch during pre-rendering).',
    autoFixAvailable: false,
  },

  BUNDLE_GROWTH: {
    code: 'BUNDLE_GROWTH',
    badge: '📈 Bundle Grew',
    friendlyTitle: 'Your JavaScript Got Much Bigger',
    explanation:
      'The JavaScript visitors download grew noticeably since your last build.',
    whyItBreaks:
      'It won\'t break the build, but pages load slower, especially on phones and slow connections.',
    actionPrompt:
      'Check the largest files listed. A new heavy library or a whole-library import (instead of one function) is the usual cause.',
    autoFixAvailable: false,
  },

  BUNDLE_OVER_BUDGET: {
    code: 'BUNDLE_OVER_BUDGET',
    badge: '⚖️ Over Size Budget',
    friendlyTitle: 'JavaScript Is Over Your Size Budget',
    explanation:
      'Visitors download more JavaScript than the budget you set.',
    whyItBreaks:
      'It won\'t break the build, but large bundles slow down first load and hurt mobile users.',
    actionPrompt:
      'Lazy-load heavy components, remove unused libraries, or raise the budget in settings if this size is expected.',
    autoFixAvailable: false,
  },

  // Secret-looking variable read from browser code
  ENV_SECRET_IN_CLIENT: {
    code: 'ENV_SECRET_IN_CLIENT',
    badge: '🔐 Secret in Browser Code',
    friendlyTitle: 'Private Value Read in the Browser',
    explanation:
      'Browser code reads an environment variable whose name looks like a secret (a key, token or password).',
    whyItBreaks:
      'The value is undefined in the browser. Adding a public prefix would "fix" that by publishing your secret to every visitor.',
    actionPrompt:
      'Move this read into server code (a Route Handler, Server Action or API endpoint) and send the browser only the result it needs.',
    autoFixAvailable: false,
  },

  // TypeScript missing from the project
  TS_NOT_INSTALLED: {
    code: 'TS_NOT_INSTALLED',
    badge: '📦 Dependencies Missing',
    friendlyTitle: 'TypeScript Is Not Installed Yet',
    explanation:
      'This project uses TypeScript, but the compiler is not in node_modules, so LaunchWizard could not check your code.',
    whyItBreaks:
      'Without a type check, LaunchWizard cannot tell you the project is safe to ship. The deploy server will install packages and may fail there instead.',
    actionPrompt:
      'Run your install command (e.g. `npm install`) in the project folder, then run the check again.',
    autoFixAvailable: false,
  },

  // Type check exceeded its time budget
  PREFLIGHT_TIMEOUT: {
    code: 'PREFLIGHT_TIMEOUT',
    badge: '⏱️ Check Timed Out',
    friendlyTitle: 'The Type Check Took Too Long',
    explanation:
      'The TypeScript check was stopped before it finished, so its result is unknown.',
    whyItBreaks:
      'An unfinished check is not a passing check. Errors may still be hiding in your project.',
    actionPrompt:
      'Raise the "LaunchWizard: Preflight Timeout Seconds" setting for large projects and run the check again.',
    autoFixAvailable: false,
  },

  // Compiler failed with unreadable output
  TSC_UNPARSED: {
    code: 'TSC_UNPARSED',
    badge: '⚠️ Check Failed',
    friendlyTitle: 'The Type Check Failed Unexpectedly',
    explanation:
      'The TypeScript compiler stopped with an error LaunchWizard could not read. The message shows its last output lines.',
    whyItBreaks:
      'The same failure will most likely stop your production build.',
    actionPrompt:
      'Run `npx tsc --noEmit` in a terminal in the project folder to see the full message.',
    autoFixAvailable: false,
  },

  // Vite Process Env Misuse
  VITE_PROCESS_ENV_USAGE: {
    code: 'VITE_PROCESS_ENV_USAGE',
    badge: '⚡ Vite Env Syntax',
    friendlyTitle: 'Use import.meta.env in Vite',
    explanation:
      'Vite does not provide Node.js `process.env` in the browser bundle.',
    whyItBreaks:
      'Accessing `process.env` in the browser under Vite throws a runtime "process is not defined" error.',
    actionPrompt:
      'Use `import.meta.env.VITE_<NAME>` instead of `process.env.<NAME>`, and rename the variable to VITE_<NAME> in .env. Only do this for values that are safe for anyone to see.',
    autoFixAvailable: false,
  },

  // Next.js Unconfigured Image Hostname
  NEXT_IMAGE_HOSTNAME: {
    code: 'NEXT_IMAGE_HOSTNAME',
    badge: '🖼️ Image Host Unconfigured',
    friendlyTitle: 'External Image Domain Not Allowed',
    explanation:
      'You loaded an image from an external URL that is not listed in `next.config.js` `images.remotePatterns`.',
    whyItBreaks:
      'Next.js Image Optimization blocks unconfigured external hostnames to prevent SSRF vulnerabilities.',
    actionPrompt:
      'Add the domain hostname to the `images.remotePatterns` array in your `next.config.js` or `next.config.mjs`.',
    autoFixAvailable: true,
    healerId: 'add-image-domain',
  },

  // Rollup / Vite Unresolved Import
  ROLLUP_UNRESOLVED_IMPORT: {
    code: 'ROLLUP_UNRESOLVED_IMPORT',
    badge: '📦 Bundler Import Error',
    friendlyTitle: 'Bundler Cannot Bundle Asset',
    explanation:
      'The bundler encountered an import it could not bundle into the final production chunk.',
    whyItBreaks:
      'Production bundling fails when an asset or package cannot be compiled into client static chunks.',
    actionPrompt:
      'Check that the dependency is in package.json dependencies, not just local workspace cache.',
    autoFixAvailable: false,
  },
};
