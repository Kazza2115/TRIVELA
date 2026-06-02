// Génère le SQL de seed pour match_schedule à partir de wc2026Matches.ts.
// Lecture par regex (pas d'import TS). Affiche les VALUES sur stdout.
import { readFileSync } from 'node:fs'

const FR = { Jan:0,Fév:1,Mar:2,Avr:3,Mai:4,Juin:5,Juil:6,Aoû:7,Sep:8,Oct:9,Nov:10,Déc:11 }
const src = readFileSync('src/data/wc2026Matches.ts', 'utf8')

const rows = []
for (const obj of src.match(/\{[^{}]*\}/g) ?? []) {
  const id   = obj.match(/id:\s*'([^']+)'/)?.[1]
  const date = obj.match(/date:\s*'([^']+)'/)?.[1]
  const time = obj.match(/time:\s*'([^']+)'/)?.[1]
  if (!id || !date || !time) continue
  const [d, moname] = date.split(' ')
  const mon = FR[moname?.slice(0,4)] ?? FR[moname?.slice(0,3)]
  if (mon == null) { console.error(`mois inconnu: "${date}" (${id})`); continue }
  const [hh, mm] = time.split(':')
  const iso = `2026-${String(mon+1).padStart(2,'0')}-${String(+d).padStart(2,'0')}T${hh.padStart(2,'0')}:${mm}:00Z`
  rows.push(`  ('${id}', '${iso}')`)
}

console.error(`${rows.length} matchs`)
console.log(`insert into match_schedule (match_id, kickoff) values\n${rows.join(',\n')}\non conflict (match_id) do update set kickoff = excluded.kickoff;`)
