# Mandarin Deck — flashcard PWA

A small offline-capable flashcard app for studying language notes, installable on iPhone via "Add to Home Screen." Built as plain static files (HTML/CSS/JS) so it runs directly from GitHub Pages.

## What it does
- Flashcards drawn from `cards.json`, study by category or all at once
- Two directions: pinyin → English, or English → pinyin
- Right/wrong tracking with a **Leitner box** system (boxes 1–5) for spaced repetition
- Cards shuffled into random order each session (Fisher–Yates)
- Progress saved on-device, plus **export/import** so an iOS storage wipe can't lose your history
- Installs as a standalone app and works offline after the first load

## Deploy to GitHub Pages
1. Put every file in this folder into your repo (keep the `icons/` folder intact).
2. In the repo: **Settings → Pages → Build from a branch**, pick your branch and `/ (root)`.
3. Open `https://<user>.github.io/<repo>/` in **Safari on iPhone**.
4. Tap **Share → Add to Home Screen**.

All paths are relative, so it works whether the site is at the domain root or a `/<repo>/` subpath. No build step.

## Editing or adding cards
Edit `cards.json`. Each card is pinyin + English only:
```json
{ "id": 77, "front": "nǐ hǎo", "back": "hello", "category": "phrases", "type": "phrase" }
```
- `id` must be unique (used to track progress — don't reuse an old id for a different card).
- `category` must match a key in the `categories` map at the top of the file.
- `type` is `vocab`, `phrase`, or `grammar`.

After editing, bump `CACHE = 'mandarin-deck-v2'` in `sw.js` (e.g. `-v3`) so installed apps pull the update.

## Notes on the data
Cards are pinyin and English only. Pinyin from the source notes was normalised to standard tone diacritics (e.g. `Niˇ` → `nǐ`), and a few obvious tone typos in the original were corrected (e.g. `wǒ` is third tone).

## Files
| File | Purpose |
|------|---------|
| `index.html` | App shell / screens |
| `styles.css` | Styling |
| `app.js` | Card logic, Leitner scheduling, stats, backup |
| `cards.json` | The deck — edit this to add cards |
| `manifest.json` | PWA metadata |
| `sw.js` | Service worker (offline cache) |
| `icons/` | App icons incl. `apple-touch-icon.png` |

## Keyboard shortcuts (desktop testing)
`Space`/`Enter` flip · `→` got it · `←` missed
