import { describe, expect, it } from 'vitest';
import { findPack, getPackOrFallback, listPacks, _resetPackCache } from './packs';
import { classifyByKeywords, sanitiseTags } from './analysis/classify';

_resetPackCache();

const REQUIRED_PACKS = [
  'clinic',
  'restaurant',
  'salon',
  'gym',
  'coaching',
  'real_estate',
  'wedding_vendor',
];

describe('vertical packs', () => {
  it('ships every required vertical', () => {
    const ids = listPacks().map((p) => p.id);
    for (const id of REQUIRED_PACKS) expect(ids).toContain(id);
  });

  it('validates every pack against the schema at load time', () => {
    expect(() => listPacks()).not.toThrow();
    expect(listPacks().length).toBeGreaterThanOrEqual(REQUIRED_PACKS.length);
  });

  it('gives every pack a complete playbook', () => {
    for (const pack of listPacks()) {
      expect(pack.issueTaxonomy.length, pack.id).toBeGreaterThanOrEqual(5);
      expect(pack.praiseTaxonomy.length, pack.id).toBeGreaterThanOrEqual(5);
      expect(pack.headlineKpi.label, pack.id).toBeTruthy();
      expect(pack.voicePreset.bannedWords.length, pack.id).toBeGreaterThan(0);
      expect(pack.staffAskScript.line, pack.id).toBeTruthy();
      expect(pack.staffAskScript.marathiLine, pack.id).toBeTruthy();
      expect(pack.staffAskScript.doNot.length, pack.id).toBeGreaterThan(0);
      expect(pack.contentTemplates.length, pack.id).toBeGreaterThan(0);
      expect(pack.profileGapChecks.length, pack.id).toBeGreaterThan(0);
    }
  });

  it('gives every issue a recommended action, so the engine never invents one', () => {
    for (const pack of listPacks()) {
      for (const issue of pack.issueTaxonomy) {
        expect(issue.action, `${pack.id}/${issue.key}`).toBeTruthy();
        expect(issue.hints.length, `${pack.id}/${issue.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps taxonomy keys unique within a pack', () => {
    for (const pack of listPacks()) {
      const issueKeys = pack.issueTaxonomy.map((t) => t.key);
      const praiseKeys = pack.praiseTaxonomy.map((t) => t.key);
      expect(new Set(issueKeys).size, pack.id).toBe(issueKeys.length);
      expect(new Set(praiseKeys).size, pack.id).toBe(praiseKeys.length);
    }
  });

  it('bans review-gating language in every staff script', () => {
    for (const pack of listPacks()) {
      const script = JSON.stringify(pack.staffAskScript).toLowerCase();
      expect(script, pack.id).toContain('never');
      // The script must forbid incentives explicitly.
      expect(
        /discount|gift|reward|free/.test(script),
        `${pack.id} must explicitly forbid incentives`,
      ).toBe(true);
    }
  });

  it('falls back rather than throwing on an unknown vertical', () => {
    expect(findPack('does_not_exist')).toBeUndefined();
    expect(getPackOrFallback('does_not_exist').id).toBeTruthy();
  });
});

describe('keyword classifier against real packs', () => {
  it('tags an English complaint in the clinic pack', () => {
    const pack = getPackOrFallback('clinic');
    const c = classifyByKeywords('Waiting time was very long and reception was rude', 2, pack);
    expect(c.issueTags).toContain('wait_time');
    expect(c.issueTags).toContain('staff_behaviour');
    expect(c.sentiment).toBe('NEGATIVE');
  });

  it('tags Marathi feedback', () => {
    const pack = getPackOrFallback('clinic');
    const c = classifyByKeywords('डॉक्टर छान आहेत पण खूप उशीर झाला', null, pack);
    expect(c.issueTags).toContain('wait_time');
    expect(c.praiseTags).toContain('doctor_care');
    expect(c.sentiment).toBe('MIXED');
  });

  it('tags romanised Hinglish feedback', () => {
    const pack = getPackOrFallback('restaurant');
    const c = classifyByKeywords('Khana bahut accha tha lekin service slow thi', 3, pack);
    expect(c.praiseTags.length + c.issueTags.length).toBeGreaterThan(0);
    expect(c.issueTags).toContain('service_speed');
  });

  it('lets a supplied star rating decide sentiment', () => {
    const pack = getPackOrFallback('salon');
    expect(classifyByKeywords('Fine', 5, pack).sentiment).toBe('POSITIVE');
    expect(classifyByKeywords('Fine', 1, pack).sentiment).toBe('NEGATIVE');
    expect(classifyByKeywords('Fine', 3, pack).sentiment).toBe('MIXED');
  });

  it('does not tag unrelated text', () => {
    const pack = getPackOrFallback('gym');
    const c = classifyByKeywords('Went there on Tuesday', null, pack);
    expect(c.issueTags).toHaveLength(0);
    expect(c.praiseTags).toHaveLength(0);
  });
});

describe('sanitiseTags', () => {
  const pack = getPackOrFallback('clinic');

  it('drops keys that are not in the taxonomy', () => {
    const out = sanitiseTags(['wait_time', 'totally_made_up'], pack.issueTaxonomy);
    expect(out).toEqual(['wait_time']);
  });

  it('de-duplicates and returns taxonomy order', () => {
    const first = pack.issueTaxonomy[0]?.key as string;
    const second = pack.issueTaxonomy[1]?.key as string;
    expect(sanitiseTags([second, first, second], pack.issueTaxonomy)).toEqual([
      first,
      second,
    ]);
  });

  it('returns nothing for non-array input', () => {
    expect(sanitiseTags('wait_time', pack.issueTaxonomy)).toEqual([]);
    expect(sanitiseTags(null, pack.issueTaxonomy)).toEqual([]);
  });
});
