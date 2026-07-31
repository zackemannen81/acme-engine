import { describe, expect, it } from 'vitest';

import {
  deriveResearchPropositionKey,
  deriveResearchQuestionKey,
  deriveResearchSourceIndependenceKey,
  deriveResearchSourceKey,
  normalizeReferenceText,
  normalizeSourceUri,
} from '../src/identity.js';

describe('research identity algorithms', () => {
  it('reproduces the ADR-0009 golden vectors exactly', () => {
    expect(
      deriveResearchPropositionKey(
        'Water boils at 100 °C at standard atmospheric pressure.',
      ),
    ).toBe(
      'research_proposition_69ac03ae1accb381bf9b9478aebe6c8ac76969657b42b970b0849c7c287e0e71',
    );
    expect(deriveResearchSourceKey('https://example.com/evidence?id=42')).toBe(
      'research_source_a2b68eead8f666873382d7406331c2f9cbf88caf4fb6a1a3528bd7692a08837d',
    );
    expect(
      deriveResearchSourceIndependenceKey(
        'Example Research Consortium',
        'publisher',
      ),
    ).toBe(
      'research_independence_1f76b6d23335fec11b0efe3680612ae44e3cab1e831c781e8925fb4c140aa263',
    );
  });

  it('normalizes URIs per ADR-0009 without reordering the query', () => {
    expect(normalizeSourceUri('HTTPS://Example.COM:443/a/b?z=1&a=2#frag')).toBe(
      'https://example.com/a/b?z=1&a=2',
    );
    expect(normalizeSourceUri('http://example.com:80')).toBe(
      'http://example.com/',
    );
    expect(normalizeSourceUri('https://example.com')).toBe(
      'https://example.com/',
    );
    expect(() => normalizeSourceUri('ftp://example.com/file')).toThrowError(
      TypeError,
    );
    expect(() =>
      normalizeSourceUri('https://user:pw@example.com/'),
    ).toThrowError(TypeError);
    expect(() => normalizeSourceUri('/relative')).toThrowError();
  });

  it('treats a query difference as a different source but a fragment as the same', () => {
    const base = deriveResearchSourceKey('https://example.com/evidence?id=42');
    expect(
      deriveResearchSourceKey('https://example.com/evidence?id=42#a'),
    ).toBe(base);
    expect(
      deriveResearchSourceKey('https://example.com/evidence?id=43'),
    ).not.toBe(base);
    expect(
      deriveResearchSourceKey('https://example.com/evidence?a=1&b=2'),
    ).not.toBe(deriveResearchSourceKey('https://example.com/evidence?b=2&a=1'));
  });

  it('derives one independence key per declared authority and basis', () => {
    const publisher = deriveResearchSourceIndependenceKey(
      '  Example   Research Consortium ',
      'publisher',
    );
    expect(publisher).toBe(
      deriveResearchSourceIndependenceKey(
        'EXAMPLE RESEARCH CONSORTIUM',
        'publisher',
      ),
    );
    expect(publisher).not.toBe(
      deriveResearchSourceIndependenceKey(
        'Example Research Consortium',
        'editorial-group',
      ),
    );
    expect(publisher).not.toBe(
      deriveResearchSourceIndependenceKey('Other Consortium', 'publisher'),
    );
  });

  it('collapses proposition whitespace and case but not wording', () => {
    const key = deriveResearchPropositionKey('The kettle reached 100 °C.');
    expect(
      deriveResearchPropositionKey('  the   KETTLE reached 100 °C. '),
    ).toBe(key);
    expect(deriveResearchPropositionKey('The kettle reached 99 °C.')).not.toBe(
      key,
    );
  });

  it('derives deterministic question identity and rejects blank text', () => {
    expect(deriveResearchQuestionKey('  Which  Sources agree? ')).toBe(
      deriveResearchQuestionKey('which sources agree?'),
    );
    expect(() => normalizeReferenceText('   ')).toThrowError(TypeError);
    expect(() => deriveResearchQuestionKey('\t\n')).toThrowError(TypeError);
  });
});
