# 🔥 Token Forge

> A self-contained, browser-based VTT token maker for Roll20, Foundry VTT, OwlBear Rodeo, and any other virtual tabletop platform.

![Token Forge](https://img.shields.io/badge/version-3.0.0-gold) ![License](https://img.shields.io/badge/license-MIT-blue) ![Deployed on Cloudflare](https://img.shields.io/badge/deployed-Cloudflare%20Pages-orange)

---

## ✨ Features

- **Upload any portrait** — PNG, JPG, or WEBP
- **10 built-in borders** — Iron Ring, Celtic Gold, Vine Serpent, Blood Ruby, Runic Amethyst, Sapphire Knot, Dragon Coil, Dwarven Rune, Iron Barb, Copper Vine
- **Drag to reposition** — click and drag the portrait inside the token frame
- **Scroll to zoom** — mousewheel over the preview to scale
- **Independent X/Y scaling** — stretch horizontally or vertically with separate sliders
- **Image adjustments** — brightness, contrast, saturation sliders; flip horizontal; rotate 90°
- **Custom borders** — upload your own 512×512 PNG border at any time
- **Safe area overlay** — toggle a ring to see what the border clips
- **Export** — downloads a 512×512 transparent PNG ready for any VTT

## 🚀 Usage

**Online:** visit the Cloudflare Pages deployment (no install required).

**Local dev:**

```bash
git clone https://github.com/Sectr99/Tokenizer.git
cd Tokenizer
npm start          # http://localhost:3000, no install needed
```

Or just open `index.html` directly.

## 🖼 Custom Borders

To use your own border art:

1. Create a **512×512 PNG** with a transparent background
2. Design your border ring in the center, leaving the middle clear for the portrait
3. Click **+ Add custom border** in the app to load it

## 📁 Project Structure

```
Tokenizer/
├── index.html        # App shell
├── css/
│   └── main.css      # All styles (DungeonTools tokens + components)
├── js/
│   ├── app.js        # Canvas logic + event handlers
│   └── borders.js    # Border definitions
├── assets/           # Border images
├── package.json      # Local server script
├── wrangler.jsonc    # Cloudflare Pages config
├── README.md         # This file
├── LICENSE           # MIT License
└── CHANGELOG.md      # Version history
```

## 🗺 Roadmap

- [ ] Color tint overlay per border
- [ ] Token size presets (Small / Medium / Large / Huge)
- [ ] Text label beneath token
- [ ] Batch export

## 📜 License

MIT — free to use, modify, and distribute. See [LICENSE](LICENSE) for details.
