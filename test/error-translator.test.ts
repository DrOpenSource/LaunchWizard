import { describe, it, expect } from 'vitest';
import { ErrorTranslator } from '../src/core/ErrorTranslator.js';
import type { PreFlightError } from '../src/shared/types.js';

describe('ErrorTranslator', () => {
  it('translates TS2307 (missing module) with friendly title and whyItBreaks', () => {
    const error: PreFlightError = {
      file: 'src/components/Header.tsx',
      line: 3,
      column: 15,
      code: 'TS2307',
      rawMessage: "Cannot find module '@/components/Button' or its corresponding type declarations.",
      severity: 'error',
    };

    const card = ErrorTranslator.translate(error);
    expect(card.badge).toBe('📦 Missing Module');
    expect(card.friendlyTitle).toBe('Cannot Find Module or File');
    expect(card.whyItBreaks).toContain('Vercel and Cloudflare production bundlers');
    expect(card.autoFixAvailable).toBe(true);
  });

  it('translates TS2322 (type mismatch)', () => {
    const error: PreFlightError = {
      file: 'src/App.tsx',
      line: 22,
      column: 7,
      code: 'TS2322',
      rawMessage: "Type 'string' is not assignable to type 'number'.",
      severity: 'error',
    };

    const card = ErrorTranslator.translate(error);
    expect(card.badge).toBe('⚡ Type Mismatch');
    expect(card.friendlyTitle).toBe('Value Type Does Not Match');
  });

  it('translates USE_CLIENT_MISSING', () => {
    const error: PreFlightError = {
      file: 'app/dashboard/page.tsx',
      line: 1,
      column: 1,
      code: 'USE_CLIENT_MISSING',
      rawMessage: "You're importing a component that needs useState.",
      severity: 'error',
    };

    const card = ErrorTranslator.translate(error);
    expect(card.badge).toBe('⚛️ Missing "use client"');
    expect(card.explanation).toContain('Next.js Server Component');
    expect(card.actionPrompt).toContain("'use client'");
  });

  it('translates ENV_LEAK_OR_UNDEFINED', () => {
    const error: PreFlightError = {
      file: 'app/checkout/page.tsx',
      line: 10,
      column: 12,
      code: 'ENV_LEAK_OR_UNDEFINED',
      rawMessage: 'Environment variable "STRIPE_KEY" is accessed in a client component but lacks the "NEXT_PUBLIC_" prefix.',
      severity: 'error',
    };

    const card = ErrorTranslator.translate(error);
    expect(card.badge).toBe('🔐 Client Secret Trap');
    expect(card.friendlyTitle).toBe('Missing NEXT_PUBLIC_ Prefix');
  });

  it('falls back to pattern matching when compiler code is missing', () => {
    const rawError: PreFlightError = {
      file: 'src/lib/api.ts',
      line: 45,
      column: 10,
      code: '',
      rawMessage: "Rollup failed to resolve import '@/utils/date' from 'src/lib/api.ts'",
      severity: 'error',
    };

    const card = ErrorTranslator.translate(rawError);
    expect(card.badge).toBe('📦 Bundler Import Error');
    expect(card.friendlyTitle).toBe('Bundler Cannot Bundle Asset');
  });

  it('batches translations correctly', () => {
    const errors: PreFlightError[] = [
      {
        file: 'src/A.ts',
        line: 1,
        column: 1,
        code: 'TS2339',
        rawMessage: "Property 'age' does not exist on type 'User'.",
        severity: 'error',
      },
      {
        file: 'src/B.ts',
        line: 2,
        column: 2,
        code: 'TS7006',
        rawMessage: "Parameter 'e' implicitly has an 'any' type.",
        severity: 'error',
      },
    ];

    const cards = ErrorTranslator.translateBatch(errors);
    expect(cards).toHaveLength(2);
    expect(cards[0].code ?? cards[0].original.code).toBe('TS2339');
    expect(cards[1].original.code).toBe('TS7006');
  });
});
