type AssetTitleInput = {
  title?: unknown;
  modelName?: unknown;
  familyLabel?: unknown;
  specsJson?: unknown;
};

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Remove only a known appended classification; keep the user's model and title. */
export function assetDisplayTitle(input: AssetTitleInput): string {
  const specs = input.specsJson && typeof input.specsJson === 'object'
    ? input.specsJson as Record<string, unknown> : {};
  let title = clean(input.title);
  const model = clean(input.modelName || specs.modelName || specs.model_name || specs.typedModelName);
  const labels = [input.familyLabel, specs.basic_family_label, specs.familyLabel,
    specs.family_label, specs.equipmentFamilyLabel, specs.typeLabel, specs.type_label,
    specs.assetTypeLabel, specs.asset_type_label].map(clean).filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const label of labels) {
    // A family word can legitimately be part of a model supplied by the user.
    if (model && model.toLowerCase().endsWith(label.toLowerCase())) continue;
    const suffix = ` ${label}`;
    if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
      title = title.slice(0, -suffix.length).replace(/[\s·•—-]+$/, '').trim();
    }
  }
  return title || 'Unknown asset';
}
