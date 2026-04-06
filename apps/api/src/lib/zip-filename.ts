/**
 * Deduplicates a ZIP entry filename by appending _2, _3, etc. after the base
 * name (before type/resolution parts) when a collision is detected.
 *
 * Mutates `usedNames` by adding the (possibly deduplicated) filename.
 */
export function deduplicateZipFilename(
  filename: string,
  usedNames: Set<string>,
): string {
  if (!usedNames.has(filename)) {
    usedNames.add(filename);
    return filename;
  }

  // Split into stem + extension: "photo_Favicon_128x128.png" -> ["photo_Favicon_128x128", "png"]
  const dotIdx = filename.lastIndexOf(".");
  const ext = dotIdx >= 0 ? filename.slice(dotIdx) : "";
  const stem = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;

  // Find the first underscore to split baseName from the rest (type/res parts)
  const firstUnderscore = stem.indexOf("_");
  const baseName = firstUnderscore >= 0 ? stem.slice(0, firstUnderscore) : stem;
  const suffix = firstUnderscore >= 0 ? stem.slice(firstUnderscore) : "";

  let counter = 2;
  let candidate: string;
  do {
    candidate = `${baseName}_${counter}${suffix}${ext}`;
    counter++;
  } while (usedNames.has(candidate));

  usedNames.add(candidate);
  return candidate;
}
