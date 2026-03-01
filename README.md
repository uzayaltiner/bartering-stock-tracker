# BDO Bartering Stock Tracking Tool

A single-page web app for tracking [Black Desert Online](https://www.naeu.playblackdesert.com/) barter item inventory across all 5 tiers.

## Features

- **68 barter items** with local icons (T1-T5)
- **Dark / Light theme** toggle
- **TR / EN** language switch
- **Tier filtering** with multi-select (pick any combination of tiers)
- **Sorting** by tier or stock count (ascending / descending)
- **Search** across item names in both languages
- **localStorage** persistence — data survives page reloads
- **No build tools** — pure HTML, CSS, JS

## Usage

Open `index.html` in a browser, or serve locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Item Tier Colors

| Tier | Color | Hex |
|------|-------|-----|
| T1 | White | `#FFFFFF` |
| T2 | Green | `#5FF369` |
| T3 | Blue | `#02B3F1` |
| T4 | Yellow | `#F6C232` |
| T5 | Orange | `#FF7C01` |

## Tech Stack

- Vanilla HTML / CSS / JS
- [Outfit](https://fonts.google.com/specimen/Outfit) font
- CSS custom properties for theming
- No frameworks, no dependencies

## License

[MIT](LICENSE)
