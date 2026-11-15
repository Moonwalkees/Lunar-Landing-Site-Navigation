// The areas the 3D terrain view has detailed terrain for (see doc/3d-view.md).
// Each is a 16 km square of LOLA data, given by its corner in south polar
// stereographic metres (x = r sin lon, y = r cos lon, r = 2 R tan((90 + lat) / 2)).

export interface TerrainTile {
  name: string;
  cornerX: number;
  cornerY: number;
  size: number;
}

export const TERRAIN_TILES: TerrainTile[] = [
  { name: "Connecting Ridge", cornerX: -18998.047, cornerY: -19998.047, size: 15996.095 },
  { name: "Shackleton rim", cornerX: -8998.047, cornerY: -14998.047, size: 15996.095 },
  { name: "Shackleton crater", cornerX: -296.096, cornerY: -14396.096, size: 15992.191 },
  { name: "Peak near Shackleton", cornerX: 22003.904, cornerY: -27996.096, size: 15992.191 },
  { name: "Malapert Massif", cornerX: -10994.876, cornerY: 111005.124, size: 20989.751 },
];

const MOON_RADIUS_M = 1737400;

// The tile that holds a site, or null if the 3D view has no terrain there.
export function terrainTileFor(lat: number, lon: number): TerrainTile | null {
  const r = 2 * MOON_RADIUS_M * Math.tan(((90 + lat) / 2) * (Math.PI / 180));
  const x = r * Math.sin(lon * (Math.PI / 180));
  const y = r * Math.cos(lon * (Math.PI / 180));
  return (
    TERRAIN_TILES.find(
      (t) => x >= t.cornerX && x <= t.cornerX + t.size && y >= t.cornerY && y <= t.cornerY + t.size,
    ) ?? null
  );
}
