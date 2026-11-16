import * as THREE from 'three';

/** Библиотека материалов, собирается один раз из набора текстур. */
export function buildMaterials(T) {
  const std = (map, opts = {}) => new THREE.MeshStandardMaterial({
    map, roughness: 0.92, metalness: 0.0, ...opts,
  });
  // стены и кровля — двухсторонние: изнутри здания видно и стену, и крышу
  const two = (map, opts = {}) => std(map, { side: THREE.DoubleSide, ...opts });

  const M = {
    grass: std(T.grass, { color: 0xffffff }),
    grassFar: std(T.grassFar, { color: 0x9fbb7a }),
    dirt: std(T.dirt),
    cobble: std(T.cobble, { roughness: 0.95 }),
    plaster: two(T.plaster),
    plasterWarm: two(T.plasterWarm),
    plasterGrey: two(T.plasterGrey),
    timber: two(T.wood),
    timberLight: two(T.woodLight),
    oakDoor: std(T.wood, { color: 0xd0a670, roughness: 0.72, metalness: 0.05 }),
    plank: two(T.plank),
    thatch: two(T.thatch, { roughness: 1.0 }),
    tile: two(T.tile),
    tileSlate: two(T.tileSlate),
    stone: two(T.stone),
    bone: std(T.bone, { color: 0xe8e0c8, roughness: 0.75 }),
    cave: two(T.cave),
    stoneDark: two(T.stone, { color: 0x9a958c }),
    fabric: std(T.fabric, { side: THREE.DoubleSide, roughness: 0.85, emissive: 0x2a1a10, emissiveIntensity: 0.5 }),
    fabric2: std(T.fabric2, { side: THREE.DoubleSide, roughness: 0.85, emissive: 0x2a1a10, emissiveIntensity: 0.5 }),
    leaf: std(T.leaf, { roughness: 0.95 }),
    leafAutumn: std(T.leafAutumn, { roughness: 0.95 }),
    leafPine: std(T.leafPine, { roughness: 0.95 }),

    // безтекстурные
    windowLit: new THREE.MeshStandardMaterial({
      map: T.windowLit, emissiveMap: T.windowLit, emissive: 0xffb055, emissiveIntensity: 2.6,
      roughness: 0.4, metalness: 0,
    }),
    windowDark: std(T.windowDark, { roughness: 0.35, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x9fc4cf, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.45,
    }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2e2b28, roughness: 0.62, metalness: 0.75 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb8863c, roughness: 0.4, metalness: 0.85 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xa89066, roughness: 1 }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff6a1e, emissive: 0xff5a12, emissiveIntensity: 2.2, roughness: 0.9,
    }),
    lampGlass: new THREE.MeshStandardMaterial({
      color: 0xffd9a0, emissive: 0xffb45a, emissiveIntensity: 3.4, roughness: 0.3,
      transparent: true, opacity: 0.92,
    }),
    wheat: new THREE.MeshStandardMaterial({ color: 0xd8bd6a, roughness: 1, side: THREE.DoubleSide }),
    hay: new THREE.MeshStandardMaterial({ color: 0xc9ab5c, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({
      map: T.water, color: 0x9fd0dc, roughness: 0.14, metalness: 0.25,
      transparent: true, opacity: 0.86,
    }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xc9b79a, roughness: 1 }),
    redCloth: new THREE.MeshStandardMaterial({ color: 0x9c4034, roughness: 1 }),
    greenCloth: new THREE.MeshStandardMaterial({ color: 0x5c7245, roughness: 1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd8a887, roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a231d, roughness: 0.9 }),
    foliageInstanced: std(T.leaf, { color: 0x93b158 }),
    flowerWhite: new THREE.MeshStandardMaterial({ color: 0xf6efd8, roughness: 0.9, side: THREE.DoubleSide }),
    flowerYellow: new THREE.MeshStandardMaterial({ color: 0xf3c743, roughness: 0.9, side: THREE.DoubleSide }),
    flowerViolet: new THREE.MeshStandardMaterial({ color: 0xa482c9, roughness: 0.9, side: THREE.DoubleSide }),
  };
  return M;
}
