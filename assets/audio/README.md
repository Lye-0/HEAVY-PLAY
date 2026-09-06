# Impact audio

The original 23 supplied MP3/WAV files are preserved in `source/`.
`sources.json` records their supplied names and file checksums.
The active mix selects 20 short contacts from eight recordings.

| Group | Purpose |
| --- | --- |
| light | Small contacts using keys, short metal hits, and cutlery |
| medium | Direct metal contacts |
| heavy | Strong contacts using metal strikes and blade recordings |
| floor | Short spoon/fork contacts for every body weight |

Each physical impact starts one short sample. Actual collision timing creates
the rhythm when many parts fall. The floor palette remains the same at all
weights; impact speed and body mass control its level.

Floor audio is emitted on a new landing, with a minimum approach speed.
Continuous support corrections remain silent. Enabling sound does not trigger
an impact. Pause, rebuild, help, and quality changes fade active sounds out.

`cues.json` records every selected source interval, processing gain, and PCM
checksum. `metal-impacts.json` contains mono 32 kHz signed 16-bit PCM, embedded
by `npm run build:preview` for offline and direct-file playback.

The provenance notice in `LICENSE.txt` applies to the supplied recordings.
