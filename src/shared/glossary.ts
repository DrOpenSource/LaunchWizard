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
      'Rename the variable to NEXT_PUBLIC_<NAME> in your code and in your .env file.',
    autoFixAvailable: true,
    healerId: 'prefix-next-public',
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
      'Use `import.meta.env.VITE_<NAME>` instead of `process.env.<NAME>`.',
    autoFixAvailable: true,
    healerId: 'fix-vite-env',
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
