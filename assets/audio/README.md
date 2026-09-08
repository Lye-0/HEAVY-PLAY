# Impact audio

The original 24 supplied MP3/WAV files are preserved in `source/`.
`sources.json` records their supplied names and file checksums.
The active mix selects 20 short contacts from 8 recordings.

| Group | Purpose |
| --- | --- |
| light | 3 of 5 variants use the new actual-metal recording |
| medium | 3 of 5 variants use the new actual-metal recording |
| heavy | 3 of 4 variants use the new actual-metal recording |
| floor | 4 of 6 variants use actual-metal, with short cutlery alternatives |

The retained metal-strike cue uses 28% lower amplitude
(about 2.9 dB) to soften their presence among the other contacts.

The supplied `actual-metal.mp3` is preserved intact. Thirteen of the twenty
variants are 155–550 ms excerpts from this recording, retaining the recorded decay.
Half-cosine release fades last 109–200 ms; dense clatter also decays gently
after its attack. Attack levels and selection proportions are preserved. Each group keeps its existing number of variants.

For the new recording only, one or two distinct impacted bodies within the
last 250 ms use 3% of the normal playback gain. Gain rises smoothly to full
level at eight bodies. Repeated bounces of one body do not increase it.
Existing recordings keep their levels, and active tails finish naturally.

Each physical impact starts one short sample. Actual collision timing creates
the rhythm when many parts fall. The floor palette remains the same at all
weights; impact speed and body mass control its level.
Each floor clip includes a brief accent from `coins-spill-04.mp3`, mixed at
at most 10% of the main hit in both peak and RMS amplitude. It shares the
same trigger; the coin accent keeps its original short duration while the
main recording can ring out. Source intervals are recorded in `cues.json`.

Floor audio is emitted on a new landing, with a minimum approach speed.
Continuous support corrections remain silent. Enabling sound does not trigger
an impact. Pause, rebuild, help, and quality changes fade active sounds out.

`cues.json` records every selected source interval, processing gain, and PCM
checksum. `metal-impacts.json` contains mono 32 kHz signed 16-bit PCM, embedded
by `npm run build:preview` for offline and direct-file playback.

The provenance notice in `LICENSE.txt` applies to the supplied recordings.
