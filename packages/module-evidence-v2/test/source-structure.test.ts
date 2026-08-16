import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION,
  EVIDENCE_V2_SOURCE_STRUCTURE_SCHEMA_VERSION,
  createEvidenceV2SourceIndex,
  deriveEvidenceV2SourceStructure,
  verifyEvidenceV2SourceStructure,
} from '../src/index.js';

/**
 * Failure shape 1 (R-03).
 *
 * A sentence starts at the tail of a line and continues after a page marker.
 * The tail word also occurs earlier on the same line, which is exactly what
 * made `"Kamel"` and `"Hussein"` unbindable in the real binder and aborted a
 * paid analysis job non-retryably.
 */
const repeatedTailWord = [
  'inte vad Kamel Kawtharanis mamma heter men hans pappa heter Amin Kawtharani. Kamel',
  'HEMLIG',
  'och hans bröder tillhörde Baz-partiet i Tofata. Kamel blev sedan skjuten av en',
  'okänd person samma kväll.',
].join('\n');

/** Failure shape 2 (R-01): a table-of-contents page with dot leaders. */
const tableOfContents = [
  'Förhör med annan, Lindkvist, Lena Anette A106 Undersköterska ..................119',
  'Förhör med annan, Foldevi, Sigun Margareta Åsgatan.Festen.....................121',
  'Förhör med annan, Bergh, Lina Maria ..........................................124',
  'Förhör med vittne, Strömfors, Kim Carl Erik Ev iakttagelse av flyende ........128',
  'Förhör med vittne, Heedman, Inez Gerda Florence K 39890-04 ...................131',
  'Förhör med annan, Åberg, Nils Erik Trädröjare vid Västra vägen ...............134',
].join('\n');

/**
 * Failure shape 3 (R-02).
 *
 * The header line opening a part names one interview while the body it
 * introduces reports a different date. Verified on five consecutive parts of
 * the real binder. The structure layer may not resolve this by guessing; it
 * may only refuse to treat the title as identity or as a clock.
 */
const offsetHeaderAndBody = [
  'Förhör med Ammouri, HUSSEIN; 2004-11-09 10:55   diarienr: 0500-K39890-04',
  'Förhörsdatum',
  '2004-11-29',
  'Förhör påbörjat',
  '12:15',
  'Berättelse',
  'Hussein har varit med sin brors familj till Libanon. Han berättar lite om resan.',
].join('\n');

describe('evidence v2 source structure', () => {
  it('pins the schema and rule versions that derived identities depend on', () => {
    expect(EVIDENCE_V2_SOURCE_STRUCTURE_SCHEMA_VERSION).toBe(
      'evidence-v2-source-structure/1',
    );
    expect(EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION).toBe(
      'evidence-v2-source-structure-rules/1',
    );
  });

  it('covers every line exactly once', () => {
    const text = [tableOfContents, offsetHeaderAndBody, repeatedTailWord].join(
      '\n',
    );
    const structure = deriveEvidenceV2SourceStructure(text);

    expect(structure.lineCount).toBe(text.split('\n').length);
    let expected = 1;
    for (const part of structure.parts) {
      expect(part.startLine).toBe(expected);
      expected = part.endLine + 1;
    }
    expect(expected - 1).toBe(structure.lineCount);
    expect(verifyEvidenceV2SourceStructure(text, structure)).toEqual([]);
  });

  it('never emits a unit whose quote repeats inside its own range', () => {
    const structure = deriveEvidenceV2SourceStructure(repeatedTailWord);
    const units = structure.parts.flatMap((part) => part.units);

    expect(units.length).toBeGreaterThan(0);
    expect(
      verifyEvidenceV2SourceStructure(repeatedTailWord, structure),
    ).toEqual([]);

    // The degenerate one-word unit the frozen rules produced is gone: no unit
    // is the bare repeated word.
    expect(units.map((unit) => unit.exactQuote)).not.toContain('Kamel');
  });

  it('keeps every quote verbatim in the source', () => {
    const text = [offsetHeaderAndBody, repeatedTailWord].join('\n');
    const structure = deriveEvidenceV2SourceStructure(text);

    for (const part of structure.parts) {
      for (const unit of part.units) {
        const range = text
          .split('\n')
          .slice(unit.startLine - 1, unit.endLine)
          .join('\n');
        expect(range).toContain(unit.exactQuote);
      }
    }
  });

  it('classifies a dot-leader index region as index or front matter', () => {
    const structure = deriveEvidenceV2SourceStructure(tableOfContents);

    expect(structure.parts.length).toBeGreaterThan(0);
    for (const part of structure.parts) {
      expect(part.contentCharacter).toBe('index-or-front-matter');
    }
  });

  it('classifies interview prose as substantive', () => {
    const structure = deriveEvidenceV2SourceStructure(offsetHeaderAndBody);

    for (const part of structure.parts) {
      expect(part.contentCharacter).toBe('substantive');
    }
  });

  it('exposes a title only as a label with its own provenance', () => {
    const structure = deriveEvidenceV2SourceStructure(offsetHeaderAndBody);
    const [part] = structure.parts;

    if (part === undefined) throw new Error('expected one part');
    expect(part.title?.text).toBe(
      'Förhör med Ammouri, HUSSEIN; 2004-11-09 10:55   diarienr: 0500-K39890-04',
    );
    expect(part.title?.sourceLine).toBe(1);

    // The title says 2004-11-09; the body says 2004-11-29. The part must carry
    // no date and no subject identity, so nothing downstream can be ordered or
    // attributed by the wrong one.
    expect(Object.keys(part).sort()).toEqual([
      'contentCharacter',
      'endLine',
      'partId',
      'startLine',
      'title',
      'units',
    ]);
    expect(Object.keys(part.title ?? {}).sort()).toEqual([
      'sourceLine',
      'text',
    ]);
  });

  it('does not open a part for a reprinted page header', () => {
    // A long interview reprints its header at the top of every page. Treating
    // each reprint as a new document cut one interview into a part per page,
    // often mid-sentence: 357 such splits over the real binder.
    const header =
      'Förhör med Ammouri, HUSSEIN; 2004-11-29 12:15   diarienr: 0500-K39890-04';
    const text = [
      header,
      'Hussein berättar om resan till Libanon och om begravningen.',
      'HEMLIG',
      header,
      'Han fortsätter att berätta om bråket i byn Tofata.',
    ].join('\n');
    const structure = deriveEvidenceV2SourceStructure(text);

    expect(structure.parts).toHaveLength(1);
    expect(verifyEvidenceV2SourceStructure(text, structure)).toEqual([]);
  });

  it('does not treat a metadata label as a document header', () => {
    // "Förhör påbörjat" and "Förhör avslutat" are fields inside a header
    // block. The frozen slicer opened documents on them and produced chains
    // named after metadata. A real header carries a date or a case reference.
    const text = [
      'Förhör med Klint, Hans; 2004-10-19 17:00   diarienr: 0500-K39890-04',
      'Förhör påbörjat',
      '17:00',
      'Förhör avslutat',
      '18:12',
      'Berättelse',
      'Klint såg en man springa över gatan strax efter klockan sju.',
    ].join('\n');
    const structure = deriveEvidenceV2SourceStructure(text);

    expect(structure.parts).toHaveLength(1);
    expect(structure.parts[0]?.title?.text).toContain('Förhör med Klint, Hans');
  });

  it('is deterministic across derivations', () => {
    const text = [tableOfContents, offsetHeaderAndBody].join('\n');

    expect(deriveEvidenceV2SourceStructure(text)).toEqual(
      deriveEvidenceV2SourceStructure(text),
    );
  });

  it('bounds part size so no part is unrenderable', () => {
    const long = Array.from(
      { length: 1500 },
      (_, index) =>
        `Rad ${String(index + 1)} med lite text som fortsätter här.`,
    ).join('\n');
    const structure = deriveEvidenceV2SourceStructure(long);

    expect(structure.parts.length).toBeGreaterThan(1);
    for (const part of structure.parts) {
      expect(part.endLine - part.startLine + 1).toBeLessThanOrEqual(500);
    }
    expect(verifyEvidenceV2SourceStructure(long, structure)).toEqual([]);
  });

  it('looks up parts and units without re-deriving', () => {
    const text = [offsetHeaderAndBody, repeatedTailWord].join('\n');
    const structure = deriveEvidenceV2SourceStructure(text);
    const index = createEvidenceV2SourceIndex(structure);
    const [part] = structure.parts;
    const unit = part?.units[0];

    if (part === undefined || unit === undefined)
      throw new Error('expected a part with a unit');
    expect(index.part(part.partId)).toBe(part);
    expect(index.unit(unit.unitId)).toBe(unit);
    expect(index.partOfLine(part.startLine)).toBe(part);
    expect(index.partOfLine(0)).toBeUndefined();
    expect(index.partOfLine(structure.lineCount + 1)).toBeUndefined();
  });

  it('reports empty text instead of inventing a part', () => {
    const structure = deriveEvidenceV2SourceStructure('');

    expect(structure.parts).toEqual([]);
    expect(structure.diagnostics.map((item) => item.code)).toEqual([
      'EVIDENCE_V2_SOURCE_EMPTY',
    ]);
  });
});
