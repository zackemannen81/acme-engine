export type TextImportSourceTime = {
  readonly importId: string;
  readonly createdAt: string;
  readonly sourceProvenance?: { readonly acquiredAt: string };
};

export function textImportSourceTime(item: TextImportSourceTime): string {
  return item.sourceProvenance?.acquiredAt ?? item.createdAt;
}

export function compareTextImportsBySourceTime(
  left: TextImportSourceTime,
  right: TextImportSourceTime,
): number {
  return (
    textImportSourceTime(left).localeCompare(textImportSourceTime(right)) ||
    left.importId.localeCompare(right.importId)
  );
}

export function sortTextImportsBySourceTime<T extends TextImportSourceTime>(
  imports: readonly T[],
): T[] {
  return [...imports].sort(compareTextImportsBySourceTime);
}
