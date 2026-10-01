/**
 * The café evaluation, from the command line.
 *
 *   npx tsx tests/eval/cafe/run.ts --set dev                      deterministic only
 *   npx tsx tests/eval/cafe/run.ts --set dev --ai openai/gpt-oss-120b:low,openai/gpt-oss-20b:low
 *   npx tsx tests/eval/cafe/run.ts --set dev --ai … --record      record missing batches first (needs GROQ_API_KEY)
 *   … --detail                                                    list every unsafe and every miss
 *
 * GROQ_API_KEY is read from the environment, or from .env.local when unset. It is never printed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { explain, scoreReading, type Reading } from '../reader-eval';
import { aiOnlyReading, combinedReading, deterministicReading } from '../ai-reader-eval';
import { breakdown, cafeLine, isUnsafe, loadCafeSet, summariseCafe, toV2, unsafeOf, type CafeExample } from './cafe-eval';
import { loadCafeRecording, parseCafeRecording, recordCafe, type CafeAiConfig } from './cafe-ai';
import { routeForAi } from '@/lib/ai/route';
import { getPackOrFallback } from '@/lib/packs';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? '');
};
const flag = (name: string) => args.includes(`--${name}`);

const set = arg('set') ?? 'dev';
const file = `tests/eval/cafe/${set}.json`;
if (!existsSync(file)) throw new Error(`No ${file}`);
const examples: CafeExample[] = loadCafeSet(file);
const conv = examples.map((e) => toV2(e));
const v2 = conv.map((c) => c.v2);

if (!process.env.GROQ_API_KEY && existsSync('.env.local')) {
  const m = /^GROQ_API_KEY="?([^"\r\n]+)/m.exec(readFileSync('.env.local', 'utf8'));
  if (m) process.env.GROQ_API_KEY = m[1];
}
delete process.env.REPOS_AI_DISABLED;
process.env.REPOS_AI_PRIMARY = 'groq';

const pack = getPackOrFallback('restaurant');
const pct = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`);
const median = (xs: number[]) => (xs.length === 0 ? 0 : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!);

function report(name: string, readings: Reading[]) {
  const scored = v2.map((e, i) => scoreReading(e, readings[i]!));
  const s = summariseCafe(conv, scored);
  console.log(cafeLine(name, s));
  if (flag('detail')) {
    for (const x of scored) if (isUnsafe(unsafeOf(x))) console.log(`   UNSAFE ${explain(x)}`);
    if (flag('misses')) for (const x of scored) if (!x.exact && !isUnsafe(unsafeOf(x))) console.log(`   miss ${explain(x)}`);
  }
  if (flag('breakdown')) {
    for (const b of breakdown(examples, scored)) console.log(`   ${b.group.padEnd(28)} n=${String(b.n).padStart(3)} exact ${pct(b.exact, b.n).padStart(6)} sentiment ${pct(b.sentiment, b.n).padStart(6)} unsafe ${b.unsafe}`);
  }
  return { scored, s };
}

(async () => {
  console.log(`café set "${set}": ${examples.length} examples; taxonomy gaps (must-labels with no topic): ${conv.reduce((n, c) => n + c.gaps.length, 0)}`);
  const routed = examples.filter((e) => routeForAi({ text: e.text, stars: e.stars }, pack).needsAi).length;
  console.log(`router would send ${routed}/${examples.length} (${pct(routed, examples.length)}) to the AI reader`);
  report('A deterministic', v2.map((e) => deterministicReading(e)));

  const configs: CafeAiConfig[] = (arg('ai') ?? '')
    .split(',')
    .filter(Boolean)
    .map((s) => {
      const [model, effort] = s.split(':');
      return { model: model!, effort: (effort && effort !== 'default' ? effort : null) as CafeAiConfig['effort'] };
    });
  for (const c of configs) {
    let rec = loadCafeRecording(set, c);
    if (flag('record')) rec = await recordCafe(set, examples, c, (l) => console.log(l));
    if (!rec) {
      console.log(`B/C ${c.model}:${c.effort ?? 'default'}: NOT RECORDED`);
      continue;
    }
    const p = parseCafeRecording(rec, examples);
    console.log(
      `-- ${c.model}:${c.effort ?? 'default'}: batches ${p.batches} (failed ${p.failedBatches}), rows parsed ${p.rowsParsed}/${p.rowsSent}, median ${median(p.ms)}ms, max ${Math.max(...p.ms)}ms, median out ${median(p.outTokens)} tok, max out ${Math.max(0, ...p.outTokens)} tok`,
    );
    report(`B AI alone   `, v2.map((e) => aiOnlyReading(p.readings.get(e.id))));
    report(`C combined   `, v2.map((e) => combinedReading(e, p.readings.get(e.id))));
  }
})();
