/**
 * Border registry.
 * Each entry: { id, name, src (path relative to root), innerR }
 * innerR: radius in canvas pixels (out of 256) where the portrait is cut; set it a little
 * past the border's inner edge so the portrait tucks under it.
 * To add a new border: drop a 512×512 WebP (transparent) in assets/borders/ and add an entry here.
 */
const BORDERS = [
  { id: 'iron-ring',       name: 'Iron Ring',       src: 'assets/borders/iron-ring.webp',       innerR: 220 },
  { id: 'celtic-gold',     name: 'Celtic Gold',     src: 'assets/borders/celtic-gold.webp',     innerR: 204 },
  { id: 'vine-serpent',    name: 'Vine Serpent',    src: 'assets/borders/vine-serpent.webp',    innerR: 206 },
  { id: 'blood-ruby',      name: 'Blood Ruby',      src: 'assets/borders/blood-ruby.webp',      innerR: 201 },
  { id: 'runic-amethyst',  name: 'Runic Amethyst',  src: 'assets/borders/runic-amethyst.webp',  innerR: 205 },
  { id: 'sapphire-knot',   name: 'Sapphire Knot',   src: 'assets/borders/sapphire-knot.webp',   innerR: 210 },
  { id: 'dragon-coil',     name: 'Dragon Coil',     src: 'assets/borders/dragon-coil.webp',     innerR: 203 },
  { id: 'dwarven-rune',    name: 'Dwarven Rune',    src: 'assets/borders/dwarven-rune.webp',    innerR: 199 },
  { id: 'iron-barb',       name: 'Iron Barb',       src: 'assets/borders/iron-barb.webp',       innerR: 203 },
  { id: 'copper-vine',     name: 'Copper Vine',     src: 'assets/borders/copper-vine.webp',     innerR: 201 },
];
