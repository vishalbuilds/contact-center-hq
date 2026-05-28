import { useState } from "react";
import Search from "./Search/Search.jsx";
import View from "./View/View.jsx";

function getPkField(card) {
  const found = card.fields?.find((f) => f.id === card.primaryKey);
  if (found) return found;
  if (card.primaryKey) return { id: card.primaryKey, title: card.primaryKey };
  return null;
}

function buildFormValues(card, record) {
  const vals = {};
  card.fields?.forEach((f) => {
    vals[f.id] = record[f.id] ?? f.defaultValue ?? "";
  });
  return vals;
}

async function apiSearch(card, searchValue) {
  const pkField = getPkField(card);
  if (!pkField || !searchValue.trim()) return [];
  const res = await fetch(
    `/api/records/${encodeURIComponent(card.tableName)}/search`,
    {
      headers: {
        "x-pk": pkField.id,
        "x-pk-value": searchValue,
      },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

async function apiCheckExists(tableName, pkId, pkValue) {
  const res = await fetch(
    `/api/records/${encodeURIComponent(tableName)}/${encodeURIComponent(pkValue)}`,
    { headers: { "x-pk": pkId } }
  );
  return res.ok;
}

async function apiGetRecord(tableName, pkId, pkValue) {
  const res = await fetch(
    `/api/records/${encodeURIComponent(tableName)}/${encodeURIComponent(pkValue)}`,
    { headers: { "x-pk": pkId } }
  );
  if (!res.ok) return null;
  return res.json();
}

async function apiDelete(tableName, pkId, pkValue) {
  await fetch(
    `/api/records/${encodeURIComponent(tableName)}/${encodeURIComponent(pkValue)}`,
    { method: "DELETE", headers: { "x-pk": pkId } }
  );
}

export default function CardDetailModal({ card, onClose }) {
  const [view, setView] = useState("search");
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [formMode, setFormMode] = useState("edit");
  const [formValues, setFormValues] = useState({});
  const [errors, setErrors] = useState({});
  const [pkError, setPkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  const pkField = getPkField(card);
  const isFormView = view === "form";

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setSearching(true);
    const data = await apiSearch(card, searchInput);
    setResults(data);
    setSearching(false);
  };

  const handleCreate = () => {
    if (!pkField) return;
    const vals = {};
    card.fields?.forEach((f) => { vals[f.id] = f.defaultValue ?? ""; });
    setFormValues(vals);
    setFormMode("create");
    setErrors({});
    setPkError("");
    setSubmitDone(false);
    setView("form");
  };

  const handleOpen = async (pkValue) => {
    const record = await apiGetRecord(card.tableName, pkField?.id, pkValue);
    if (!record) return;
    setFormValues(buildFormValues(card, record));
    setFormMode("edit");
    setErrors({});
    setPkError("");
    setSubmitDone(false);
    setView("form");
  };

  const handleDuplicate = async (pkValue) => {
    const record = await apiGetRecord(card.tableName, pkField?.id, pkValue);
    if (!record) return;
    const vals = buildFormValues(card, record);
    if (pkField) vals[pkField.id] = "";
    setFormValues(vals);
    setFormMode("duplicate");
    setErrors({});
    setPkError("");
    setSubmitDone(false);
    setView("form");
  };

  const handleDelete = async (pkValue) => {
    await apiDelete(card.tableName, pkField?.id, pkValue);
    setResults((prev) => prev?.filter((v) => v !== pkValue) ?? []);
  };

  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
    if (pkError && pkField && fieldId === pkField.id) setPkError("");
  };

  const handleSubmit = async () => {
    if (!pkField || submitting) return;

    const newErrors = {};
    card.fields?.forEach((f) => {
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const payload = Object.fromEntries(Object.entries(formValues).filter(([, v]) => v !== ""));
    const pkId = pkField.id;

    setSubmitting(true);
    try {
      if (formMode === "create" || formMode === "duplicate") {
        const pkVal = formValues[pkId];
        if (!pkVal || !String(pkVal).trim()) {
          setPkError(`${pkField.title ?? "Primary key"} is required.`);
          return;
        }
        const exists = await apiCheckExists(card.tableName, pkId, pkVal);
        if (exists) {
          setPkError(`A record with this ${pkField.title ?? "key"} already exists.`);
          return;
        }
        const postRes = await fetch(`/api/records/${encodeURIComponent(card.tableName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-pk": pkId },
          body: JSON.stringify(payload),
        });
        if (!postRes.ok) { setPkError("Failed to create record. Please try again."); return; }
      } else {
        const pkVal = formValues[pkId];
        const putRes = await fetch(
          `/api/records/${encodeURIComponent(card.tableName)}/${encodeURIComponent(pkVal)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-pk": pkId },
            body: JSON.stringify(payload),
          }
        );
        if (!putRes.ok) { setPkError("Failed to save record. Please try again."); return; }
      }
      setSubmitDone(true);
      setTimeout(() => {
        setSubmitDone(false);
        setView("search");
        setPkError("");
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const modeBadge = {
    create:    { label: "Creating",    cls: "bg-blue-100 text-blue-700 border-blue-200" },
    duplicate: { label: "Duplicating", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    edit:      { label: "Editing",     cls: "bg-green-100 text-green-700 border-green-200" },
  };

  const submitLabel = () => {
    if (submitDone) return formMode === "edit" ? "Saved!" : "Created!";
    if (submitting) return formMode === "edit" ? "Saving…" : "Creating…";
    return formMode === "edit" ? "Save" : "Create";
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" role="button" aria-label="Close modal" tabIndex={0} onClick={onClose} onKeyDown={(e) => e.key === "Enter" && onClose()} />
      <div className="fixed top-5 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col">

        <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b border-[#c8b8c8] shrink-0">
          <div className="flex items-center gap-3">
            {isFormView && !submitDone && (
              <button
                type="button"
                onClick={() => { setView("search"); setPkError(""); }}
                className="p-1.5 rounded-lg text-[#5b2d5b] hover:bg-[#d4c8d4] transition-colors cursor-pointer"
                title="Back to search"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#3b1a3b]">{card.title}</h2>
                {isFormView && !submitDone && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${modeBadge[formMode].cls}`}>
                    {modeBadge[formMode].label}
                  </span>
                )}
                {submitDone && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
                    {formMode === "edit" ? "Saved" : "Created"}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#5b2d5b] mt-0.5">{card.description}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center shrink-0 ml-4">
            {isFormView && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || submitDone}
                className={`px-4 py-1.5 text-sm font-semibold text-white rounded-lg border transition-all duration-150 cursor-pointer
                  ${submitDone
                    ? "bg-emerald-600 border-emerald-700"
                    : "bg-rose-700 border-rose-800 hover:bg-rose-900 active:scale-95 disabled:opacity-60"
                  }`}
              >
                {submitLabel()}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-semibold text-[#5b2d5b] bg-[#d4c8d4] rounded-lg border border-[#b8a8b8] hover:bg-[#c0b0c0] active:scale-95 transition-all duration-150 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

        {view === "search" && (
          <Search
            pkField={pkField}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSearch={handleSearch}
            searching={searching}
            results={results}
            onOpen={handleOpen}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onCreateNew={handleCreate}
          />
        )}

        {view === "form" && (
          <View
            card={card}
            pkField={pkField}
            formMode={formMode}
            formValues={formValues}
            errors={errors}
            pkError={pkError}
            onChange={handleChange}
          />
        )}
      </div>
    </>
  );
}
