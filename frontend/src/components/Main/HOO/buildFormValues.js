export function buildFormValues(hooConfig, record) {
  const vals = {};
  hooConfig.fields?.forEach((f) => {
    const src = f.isPayload ? record?.payload : record;
    if (!record && f.autoGenerate === "uuid") {
      vals[f.id] = crypto.randomUUID();
    } else {
      vals[f.id] = src ? (src[f.id] ?? f.defaultValue ?? "") : (f.defaultValue ?? "");
    }
  });
  return vals;
}
