import { useState } from "react";
import TableSearch from "./TableSearch/TableSearch.jsx";
import TableForm from "./TableForm/TableForm.jsx";
import ModalHeader from "../Components/ModalHeader.jsx";
import { fetchTableRecord } from "../api/table.js";

function getPrimaryKeyField(tableConfig) {
  if (!tableConfig.partitionKey) {
    console.error("This card has no partitionKey defined");
    return null;
  }
  const pkField = tableConfig.fields?.find((f) => f.id === tableConfig.partitionKey);
  if (!pkField) {
    console.error(`Primary key "${tableConfig.partitionKey}" is not defined in fields.`);
    return null;
  }
  return pkField;
}

function buildInitialFormValues(tableConfig, record) {
  const vals = {};
  tableConfig.fields?.forEach((f) => {
    const src = f.isPayload ? record?.payload : record;
    const raw = src ? (src[f.id] ?? f.defaultValue ?? "") : (f.defaultValue ?? "");
    vals[f.id] = f.type === "boolean" ? (raw === true || raw === "true") : raw;
  });
  return vals;
}

export default function TableModal({ tableConfig, onClose }) {
  const [view, setView] = useState("search");
  const [formMode, setFormMode] = useState("edit");
  const [initialValues, setInitialValues] = useState({});
  const [fetchError, setFetchError] = useState(null);
  const [loadingPkValue, setLoadingPkValue] = useState(null);

  const pkField = getPrimaryKeyField(tableConfig);

  const handleCreate = () => {
    if (!pkField) return;
    const vals = {};
    tableConfig.fields?.forEach((f) => {
      const raw = f.defaultValue ?? "";
      vals[f.id] = f.type === "boolean" ? (raw === true || raw === "true") : raw;
    });
    setInitialValues(vals);
    setFormMode("create");
    setFetchError(null);
    setView("form");
  };

  const handleOpen = async (pkValue) => {
    if (loadingPkValue) return;
    setLoadingPkValue(pkValue);
    try {
      const record = await fetchTableRecord(tableConfig.tableName, pkField?.id, pkValue);
      if (!record) { setFetchError("Failed to load record — please try again."); return; }
      setFetchError(null);
      setInitialValues(buildInitialFormValues(tableConfig, record));
      setFormMode("edit");
      setView("form");
    } catch {
      setFetchError("Failed to load record — please try again.");
    } finally {
      setLoadingPkValue(null);
    }
  };

  const handleDuplicate = async (pkValue) => {
    if (loadingPkValue) return;
    setLoadingPkValue(pkValue);
    try {
      const record = await fetchTableRecord(tableConfig.tableName, pkField?.id, pkValue);
      if (!record) { setFetchError("Failed to load record — please try again."); return; }
      setFetchError(null);
      const vals = buildInitialFormValues(tableConfig, record);
      if (pkField) vals[pkField.id] = "";
      setInitialValues(vals);
      setFormMode("duplicate");
      setView("form");
    } catch {
      setFetchError("Failed to load record — please try again.");
    } finally {
      setLoadingPkValue(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        role="button"
        aria-label="Close modal"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
      />
      <div id="table-modal" className="fixed top-5 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col">
        <ModalHeader
          title={tableConfig.title}
          description={tableConfig.description}
          formMode={view === "form" ? formMode : undefined}
          onBack={view === "form" ? () => setView("search") : undefined}
          onClose={onClose}
        />
        {view === "search" && (
          <>
            {fetchError && (
              <div className="mx-8 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {fetchError}
              </div>
            )}
            <TableSearch
              tableConfig={tableConfig}
              pkField={pkField}
              onOpen={handleOpen}
              onDuplicate={handleDuplicate}
              onCreateNew={handleCreate}
              loadingPkValue={loadingPkValue}
            />
          </>
        )}
        {view === "form" && (
          <TableForm
            key={`${formMode}-${initialValues[pkField?.id] ?? "new"}`}
            tableConfig={tableConfig}
            pkField={pkField}
            formMode={formMode}
            initialValues={initialValues}
            onDone={() => setView("search")}
          />
        )}
      </div>
    </>
  );
}
