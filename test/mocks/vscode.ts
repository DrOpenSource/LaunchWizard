/**
 * A small in-memory stand-in for the `vscode` module, enough to activate the extension and
 * exercise commands, code actions and the save pipeline under Vitest (aliased in vitest.config.ts).
 */
import { vi } from 'vitest';
import * as path from 'node:path';

type Listener<T> = (e: T) => unknown;

export class EventEmitter<T> {
  private listeners: Array<Listener<T>> = [];
  public event = (listener: Listener<T>) => {
    this.listeners.push(listener);
    return { dispose: () => (this.listeners = this.listeners.filter((l) => l !== listener)) };
  };
  public fire(e: T): void {
    for (const l of [...this.listeners]) l(e);
  }
  public dispose(): void {
    this.listeners = [];
  }
}

export class Uri {
  private constructor(public readonly scheme: string, public readonly fsPath: string, public readonly query = '') {}
  public static file(p: string): Uri {
    return new Uri('file', path.normalize(p));
  }
  public static parse(s: string): Uri {
    return new Uri(s.split(':')[0], s);
  }
  public static from(parts: { scheme: string; path: string; query?: string }): Uri {
    return new Uri(parts.scheme, parts.path, parts.query);
  }
  public get path(): string {
    return this.fsPath;
  }
  public toString(): string {
    return `${this.scheme}://${this.fsPath}${this.query ? `?${this.query}` : ''}`;
  }
}

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;
  constructor(a: Position | number, b: Position | number, c?: number, d?: number) {
    if (typeof a === 'number') {
      this.start = new Position(a, b as number);
      this.end = new Position(c!, d!);
    } else {
      this.start = a;
      this.end = b as Position;
    }
  }
}

export class WorkspaceEdit {
  public readonly edits: Array<{ uri: Uri; range: Range; text: string }> = [];
  public replace(uri: Uri, range: Range, text: string): void {
    this.edits.push({ uri, range, text });
  }
  public insert(uri: Uri, pos: Position, text: string): void {
    this.edits.push({ uri, range: new Range(pos, pos), text });
  }
}

export class CodeAction {
  public edit?: WorkspaceEdit;
  public isPreferred?: boolean;
  constructor(public readonly title: string, public readonly kind: string) {}
}

export const CodeActionKind = { QuickFix: 'quickfix' };
export const StatusBarAlignment = { Left: 1, Right: 2 };
export const ProgressLocation = { SourceControl: 1, Window: 10, Notification: 15 };
export const QuickPickItemKind = { Separator: -1, Default: 0 };
export const ConfigurationTarget = { Global: 1, Workspace: 2 };
export class ThemeColor {
  constructor(public readonly id: string) {}
}

/** Builds a TextDocument-like object over a string. */
export function makeDocument(fsPath: string, text: string) {
  const offsetToPosition = (offset: number) => {
    const before = text.slice(0, offset).split('\n');
    return new Position(before.length - 1, before[before.length - 1].length);
  };
  return {
    uri: Uri.file(fsPath),
    getText: () => text,
    lineAt: (n: number) => ({ text: text.split(/\r?\n/)[n] ?? '' }),
    positionAt: offsetToPosition,
    save: vi.fn(async () => true),
  };
}

const registry = new Map<string, (...args: unknown[]) => unknown>();
const saveListeners: Array<Listener<unknown>> = [];
const config = new Map<string, unknown>();
const secrets = new Map<string, string>();

export const __mock = {
  registry,
  saveListeners,
  config,
  secrets,
  workspaceRoot: '' as string,
  reset() {
    registry.clear();
    saveListeners.length = 0;
    config.clear();
    secrets.clear();
    vi.clearAllMocks();
  },
  makeContext(extensionPath: string, globalStoragePath: string) {
    const state = new Map<string, unknown>();
    const wsState = new Map<string, unknown>();
    return {
      subscriptions: [] as Array<{ dispose(): unknown }>,
      extensionUri: Uri.file(extensionPath),
      globalStorageUri: Uri.file(globalStoragePath),
      globalState: { get: (k: string) => state.get(k), update: async (k: string, v: unknown) => void state.set(k, v) },
      workspaceState: { get: (k: string) => wsState.get(k), update: async (k: string, v: unknown) => void wsState.set(k, v) },
      secrets: {
        get: async (k: string) => secrets.get(k),
        store: async (k: string, v: string) => void secrets.set(k, v),
        delete: async (k: string) => void secrets.delete(k),
      },
    };
  },
};

const statusItem = () => ({ text: '', tooltip: '', command: '', backgroundColor: undefined, show: vi.fn(), dispose: vi.fn() });

export const window = {
  createStatusBarItem: vi.fn(statusItem),
  showInformationMessage: vi.fn(async (..._args: unknown[]) => undefined as string | undefined),
  showWarningMessage: vi.fn(async (..._args: unknown[]) => undefined as string | undefined),
  showErrorMessage: vi.fn(async (..._args: unknown[]) => undefined as string | undefined),
  showInputBox: vi.fn(async (..._args: unknown[]) => undefined as string | undefined),
  showQuickPick: vi.fn(async (..._args: unknown[]) => undefined),
  showSaveDialog: vi.fn(async () => undefined),
  showTextDocument: vi.fn(async () => undefined),
  withProgress: vi.fn(async (_opts: unknown, task: (p: unknown, t: unknown) => unknown) =>
    task({ report: vi.fn() }, { onCancellationRequested: vi.fn(), isCancellationRequested: false })
  ),
  registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
  createOutputChannel: vi.fn(() => ({ append: vi.fn(), appendLine: vi.fn(), show: vi.fn(), dispose: vi.fn() })),
  createTerminal: vi.fn(() => ({ show: vi.fn(), sendText: vi.fn() })),
};

export const workspace = {
  get workspaceFolders() {
    return __mock.workspaceRoot ? [{ uri: Uri.file(__mock.workspaceRoot), name: 'ws', index: 0 }] : undefined;
  },
  textDocuments: [] as Array<ReturnType<typeof makeDocument>>,
  getConfiguration: vi.fn(() => ({
    get: (key: string, fallback?: unknown) => (config.has(key) ? config.get(key) : fallback),
    update: async (key: string, value: unknown) => void config.set(key, value),
  })),
  getWorkspaceFolder: vi.fn((uri: Uri) =>
    __mock.workspaceRoot && uri.fsPath.startsWith(path.normalize(__mock.workspaceRoot)) ? { uri: Uri.file(__mock.workspaceRoot) } : undefined
  ),
  onDidSaveTextDocument: vi.fn((listener: Listener<unknown>) => {
    saveListeners.push(listener);
    return { dispose: vi.fn() };
  }),
  openTextDocument: vi.fn(),
  applyEdit: vi.fn(async () => true),
  registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
  fs: { writeFile: vi.fn(async () => undefined) },
};

export const languages = {
  registerCodeActionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export const commands = {
  registerCommand: vi.fn((id: string, handler: (...args: unknown[]) => unknown) => {
    registry.set(id, handler);
    return { dispose: () => registry.delete(id) };
  }),
  executeCommand: vi.fn(async (id: string, ...args: unknown[]) => registry.get(id)?.(...args)),
};

export const env = {
  machineId: 'test-machine',
  clipboard: { writeText: vi.fn(async () => undefined) },
  openExternal: vi.fn(async () => true),
};
