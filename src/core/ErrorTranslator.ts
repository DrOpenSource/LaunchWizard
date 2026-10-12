import { ERROR_GLOSSARY, type GlossaryEntry } from '../shared/glossary.js';
import type { PreFlightError, TranslatedError } from '../shared/types.js';

export class ErrorTranslator {
  /**
   * Translates a raw PreFlightError or compiler line into a vibe-coder-friendly TranslatedError card.
   */
  public static translate(error: PreFlightError): TranslatedError {
    const entry = this.resolveGlossaryEntry(error);

    return {
      original: error,
      badge: entry.badge,
      friendlyTitle: entry.friendlyTitle,
      explanation: entry.explanation,
      whyItBreaks: entry.whyItBreaks,
      actionPrompt: entry.actionPrompt,
      autoFixAvailable: entry.autoFixAvailable,
    };
  }

  /**
   * Translates a list of PreFlightErrors into friendly cards.
   */
  public static translateBatch(errors: PreFlightError[]): TranslatedError[] {
    return errors.map((err) => this.translate(err));
  }

  private static resolveGlossaryEntry(error: PreFlightError): GlossaryEntry {
    // 1. Direct code lookup
    if (error.code && ERROR_GLOSSARY[error.code]) {
      return ERROR_GLOSSARY[error.code];
    }

    const msg = error.rawMessage.toLowerCase();

    // 2. Pattern matching based on raw error message
    if (msg.includes('cannot find module') || msg.includes("or its corresponding type declarations")) {
      return ERROR_GLOSSARY.TS2307;
    }

    if (msg.includes('not assignable to type')) {
      return ERROR_GLOSSARY.TS2322;
    }

    if (msg.includes('property') && msg.includes('does not exist on type')) {
      return ERROR_GLOSSARY.TS2339;
    }

    if (msg.includes('implicitly has an') && msg.includes('any')) {
      return ERROR_GLOSSARY.TS7006;
    }

    if (msg.includes('use client') || msg.includes('you\'re importing a component that needs usestate')) {
      return ERROR_GLOSSARY.USE_CLIENT_MISSING;
    }

    if (msg.includes('window is not defined') || msg.includes('document is not defined')) {
      return ERROR_GLOSSARY.SSR_WINDOW_UNDEFINED;
    }

    if (msg.includes('hostname') && msg.includes('is not configured under images')) {
      return ERROR_GLOSSARY.NEXT_IMAGE_HOSTNAME;
    }

    if (msg.includes('could not resolve') || msg.includes('failed to resolve import')) {
      return ERROR_GLOSSARY.ROLLUP_UNRESOLVED_IMPORT;
    }

    // 3. Calm fallback entry
    return {
      code: error.code || 'BUILD_ERROR',
      badge: '⚠️ Build Notice',
      friendlyTitle: 'Production Build Warning',
      explanation: error.rawMessage || 'An unexpected compilation error was detected in your project.',
      whyItBreaks: 'Vercel, Cloudflare, and Netlify require completely clean builds to produce static bundles.',
      actionPrompt: 'Check the file and line number shown above to fix the syntax or configuration.',
      autoFixAvailable: Boolean(error.healerId),
    };
  }
}
