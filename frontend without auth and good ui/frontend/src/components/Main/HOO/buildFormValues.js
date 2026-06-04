export function buildFormValues(hooConfig, record) {
  const vals = {};

  hooConfig.fields?.forEach((f) => {
    const src = f.isPayload ? record?.payload : record;
    const raw = src
      ? (src[f.id] ?? f.defaultValue ?? "")
      : (f.defaultValue ?? "");
    vals[f.id] = f.type === "boolean" ? raw === true || raw === "true" : raw;
  });

  return vals;
}
