import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FrameworkInfo, PackageManager, SupportedFramework } from '../shared/types.js';

interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class FrameworkDetector {
  /**
   * Detects the web framework, package manager, and build scripts for a given project directory.
   */
  public static detect(projectRoot: string): FrameworkInfo {
    const pkgPath = path.join(projectRoot, 'package.json');
    let pkg: PackageJson = {};

    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        pkg = JSON.parse(raw) as PackageJson;
      } catch {
        // Fall back to empty package.json if malformed
        pkg = {};
      }
    }

    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const hasTsConfig = fs.existsSync(path.join(projectRoot, 'tsconfig.json'));
    const hasTypeScript = Boolean(hasTsConfig || allDeps.typescript);

    const packageManager = this.detectPackageManager(projectRoot);

    const { framework, displayName, defaultPort, version } = this.resolveFramework(allDeps);

    const devScript = pkg.scripts?.dev ? `${packageManager} run dev` : undefined;
    const buildScript = pkg.scripts?.build ? `${packageManager} run build` : undefined;

    return {
      framework,
      displayName,
      version,
      packageManager,
      hasTypeScript,
      devScript,
      buildScript,
      defaultPort,
    };
  }

  private static detectPackageManager(projectRoot: string): PackageManager {
    if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(projectRoot, 'bun.lockb')) || fs.existsSync(path.join(projectRoot, 'bun.lock'))) {
      return 'bun';
    }
    if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  private static resolveFramework(deps: Record<string, string>): {
    framework: SupportedFramework;
    displayName: string;
    defaultPort: number;
    version?: string;
  } {
    if (deps.next) {
      return { framework: 'nextjs', displayName: 'Next.js', defaultPort: 3000, version: deps.next };
    }
    if (deps.astro) {
      return { framework: 'astro', displayName: 'Astro', defaultPort: 4321, version: deps.astro };
    }
    if (deps['@sveltejs/kit']) {
      return { framework: 'sveltekit', displayName: 'SvelteKit', defaultPort: 5173, version: deps['@sveltejs/kit'] };
    }
    if (deps.nuxt || deps.nuxt3) {
      return { framework: 'nuxt', displayName: 'Nuxt', defaultPort: 3000, version: deps.nuxt || deps.nuxt3 };
    }
    if (deps['@remix-run/react'] || deps['@remix-run/node']) {
      return { framework: 'remix', displayName: 'Remix', defaultPort: 3000, version: deps['@remix-run/react'] };
    }
    if (deps.vite) {
      return { framework: 'vite', displayName: 'Vite', defaultPort: 5173, version: deps.vite };
    }
    if (deps['react-scripts']) {
      return { framework: 'cra', displayName: 'Create React App', defaultPort: 3000, version: deps['react-scripts'] };
    }
    if (deps.typescript) {
      return { framework: 'vanilla-ts', displayName: 'TypeScript Project', defaultPort: 3000, version: deps.typescript };
    }

    return { framework: 'unknown', displayName: 'Generic Web App', defaultPort: 3000 };
  }
}
