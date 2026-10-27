import { fitParser } from '@/services/import/fitParser';
import { gpxParser } from '@/services/import/gpxParser';
import { tcxParser } from '@/services/import/tcxParser';
import { ImportError, type ActivityFileInput, type ActivityParser, type ParsedActivity } from '@/services/import/types';

/**
 * Picks the parser for an upload and runs it.
 *
 * The extension and the content must AGREE: a `.tcx` whose bytes are FIT, or
 * a `.fit` that is really XML, is refused. Either alone can be wrong by
 * accident or on purpose; requiring both means a renamed file never reaches a
 * parser that was not written for it.
 *
 * Open/closed: a new format is a new parser in the list passed in, nothing else.
 */
export interface ParserRegistry {
  parse(input: ActivityFileInput): ParsedActivity;
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase();
}

export function createParserRegistry(parsers: readonly ActivityParser[]): ParserRegistry {
  return {
    parse(input: ActivityFileInput): ParsedActivity {
      if (input.bytes.byteLength === 0) throw new ImportError('empty');
      const extension = extensionOf(input.fileName);
      const byExtension = parsers.find((p) => p.extensions.includes(extension));
      if (byExtension === undefined) throw new ImportError('unsupported-extension');
      if (!byExtension.canParse(input)) {
        const actual = parsers.find((p) => p !== byExtension && p.canParse(input));
        throw new ImportError(
          actual === undefined ? 'unreadable' : 'content-mismatch',
          actual === undefined ? undefined : `${extension} file contains ${actual.format}`,
        );
      }
      return byExtension.parse(input);
    },
  };
}

/** The formats HorsePowr reads today. */
export const DEFAULT_PARSERS: readonly ActivityParser[] = [tcxParser, gpxParser, fitParser];

export const defaultParserRegistry = createParserRegistry(DEFAULT_PARSERS);
