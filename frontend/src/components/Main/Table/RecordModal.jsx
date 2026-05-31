import { useState } from "react";
import RecordSearch from "./RecordSearch/RecordSearch.jsx";
import RecordForm from "./RecordForm/RecordForm.jsx";
import ModalHeader from "./ModalHeader/ModalHeader.jsx";

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
    vals[f.id] = src ? (src[f.id] ?? f.defaultValue ?? "") : (f.defaultValue ?? "");
  });
  return vals;
}

async function fetchRecord(tableName, pkId, pkValue) {
  const res = await fetch(
    `/api/v1/table/records/${encodeURIComponent(tableName)}/${encodeURIComponent(pkValue)}`,
    { headers: { "x-pk": pkId } }
  );
  if (!res.ok) return null;
  return res.json();
}

export default function RecordModal({ tableConfig, onClose }) {
  const [view, setView] = useState("search");
  const [formMode, setFormMode] = useState("edit");
  const [initialValues, setInitialValues] = useState({});
  const [fetchError, setFetchError] = useState(null);

  const pkField = getPrimaryKeyField(tableConfig);

  const handleCreate = () => {
    if (!pkField) return;
    const vals = {};
    tableConfig.fields?.forEach((f) => { vals[f.id] = f.defaultValue ?? ""; });
    setInitialValues(vals);
    setFormMode("create");
    setFetchError(null);
    setView("form");
  };

  const handleOpen = async (pkValue) => {
    const record = await fetchRecord(tableConfig.tableName, pkField?.id, pkValue);
    if (!record) { setFetchError("Failed to load record — please try again."); return; }
    setFetchError(null);
    setInitialValues(buildInitialFormValues(tableConfig, record));
    setFormMode("edit");
    setView("form");
  };

  const handleDuplicate = async (pkValue) => {
    const record = await fetchRecord(tableConfig.tableName, pkField?.id, pkValue);
    if (!record) { setFetchError("Failed to load record — please try again."); return; }
    setFetchError(null);
    const vals = buildInitialFormValues(tableConfig, record);
    if (pkField) vals[pkField.id] = "";
    setInitialValues(vals);
    setFormMode("duplicate");
    setView("form");
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
      <div className="fixed top-5 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col">
        <ModalHeader
          tableConfig={tableConfig}
          view={view}
          setView={setView}
          formMode={formMode}
          onClose={onClose}
        />

        {view === "search" && (
          <>
            {fetchError && (
              <div className="mx-8 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {fetchError}
              </div>
            )}
            <RecordSearch
              tableConfig={tableConfig}
              pkField={pkField}
              onOpen={handleOpen}
              onDuplicate={handleDuplicate}
              onCreateNew={handleCreate}
            />
          </>
        )}

        {view === "form" && (
          <RecordForm
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
