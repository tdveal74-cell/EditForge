/**
 * What an asset *is*, separate from where it is kept.
 *
 * The catalog store reaches the filesystem, so a client page importing a runtime
 * value from it drags `fs` into the browser bundle and the build fails. The
 * shape belongs on its own anyway: a page renders the type list, it does not
 * need the store to do it.
 */

export const ASSET_TYPES = ["video", "audio", "image", "project", "document"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export function isAssetType(v: string): v is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(v);
}

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  tags: string[];
  /** Where the bytes actually are. The index exists to answer this. */
  location?: string;
  addedAt: string;
};
