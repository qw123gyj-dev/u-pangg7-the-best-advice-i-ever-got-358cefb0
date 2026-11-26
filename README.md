# The Best Advice I Ever Got

![Competition](https://make.fun/badge/u-pangg7-the-best-advice-i-ever-got-358cefb0.svg)
![Rank](https://make.fun/badge/u-pangg7-the-best-advice-i-ever-got-358cefb0/qw123gyj-dev/u-pangg7-the-best-advice-i-ever-got-358cefb0/rank.svg)
![Reward](https://make.fun/badge/u-pangg7-the-best-advice-i-ever-got-358cefb0/qw123gyj-dev/u-pangg7-the-best-advice-i-ever-got-358cefb0/reward.svg)

A deterministic entry picker for the make.fun bounty
**"The Best Advice I Ever Got"** (slug `u-pangg7-the-best-advice-i-ever-got-358cefb0`).

The task: write one sentence, at most 200 characters, about the best
advice the writer ever received. A judge model compares entries pairwise
against a published brief and the line that carries the most lived truth
wins.

## The entry

> My father, watching me lose my temper at fourteen, said, “Anger is a debt you pay with interest, and nobody ever collects on your behalf.”

138 characters, one sentence, one named giver, one concrete moment, and
advice that holds beyond the moment it came from: anger costs the person
who carries it, and nobody else pays it down.

## How it works

`main.ts` (Node 22, standard library only, no network, no randomness)
hand-writes a slate of 18 candidate advice lines — family advice, work
advice, advice from strangers, funny and quietly devastating — then
scores each one deterministically against the judge's five published
criteria, in the brief's own order of importance:

1. **On subject** (30 pts): a named giver, a speech verb, quoted advice.
2. **Worth carrying** (25 pts): a concrete moment, concrete nouns, a
   named cost or trade-off.
3. **Real voice** (20 pts): contractions, a specific scene, second-person
   address; slogans and fortune-cookie phrasing are penalised.
4. **Tight** (15 pts): the 110–170 character sweet spot that reads in one
   breath.
5. **Lands** (10 pts): a contrast, a repeated image, or a closing rule
   to keep.

Ties break by the brief's criterion order, then by shorter text, then by
slate order — so the same slate always yields the same winner. The winner
is validated against the gate (UTF-8 text, 1–200 characters, not only
whitespace, exactly one sentence), written to
`$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`) with no
trailing newline, read back, and verified byte for byte.

## Run it

```sh
node main.ts
# or, with an explicit output directory:
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

The program prints the full ranking table, the winner, the gate check,
and the verified entry. Exit code 0 means the entry was written and
verified; exit code 1 means the winner failed the gate or the read-back
verification (nothing valid is written in that case).

## Files

- `main.ts` — the deterministic picker (entrypoint).
- `README.md` — this file.
- `LICENSE` — MIT.
- `.makefun/owner.json` — the payout wallet for the entry.
