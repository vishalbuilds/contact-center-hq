import { useState } from "react";
import TableSearch from "./TableSearch/TableSearch.jsx";
import TableForm from "./TableForm/TableForm.jsx";
import ModalHeader from "../Components/ModalHeader.jsx";
import { fetchTableRecord } from "../api/table.js";

/*
  TableModal.jsx — the popup modal for managing generic DynamoDB table records.

  Used by: Main.jsx when the user clicks a "table" type card
  (Initial Config, User DID Mapping, Voicemail Access, Outbound Mapping).

  VIEW FLOW
  ─────────
  The modal has two views controlled by the `view` state:

    "search" (default)  →  TableSearch: user types a primary key value to find records
    "form"              →  TableForm:   create / edit / duplicate a specific record

  The back arrow in ModalHeader (onBack) returns from "form" → "search".
  The Cancel button in ModalHeader (onClose) closes the whole modal.

  HOW THE PRIMARY KEY WORKS
  ─────────────────────────
  Every table in schema.json has a `partitionKey` field (e.g. "dins", "DID",
  "mailBoxNumber"). getPrimaryKeyField() finds the matching field object from
  tableConfig.fields so its title, type, and id can be used throughout the modal.
  If the partitionKey is misconfigured (missing from fields), an error is logged
  and pkField is null — the form and search refuse to operate without it.

  API CALLS
  ─────────
  This component itself calls fetchTableRecord() when the user clicks "Open" or
  "Duplicate" on a search result — it needs the full record before it can open
  the form. TableSearch handles its own search and delete API calls internally.
  TableForm handles create and update API calls internally.

  PROPS
  ─────
  tableConfig — the full config object from schema.json for this table
                (tableName, partitionKey, fields, title, description)
  onClose     — called when the user clicks Cancel in the header; closes the modal
*/

/*
  getPrimaryKeyField — finds the field object that matches tableConfig.partitionKey.
  Returns the field object (e.g. { id:"dins", title:"DINS", type:"string", ... })
  or null if the partitionKey is not defined or not found in the fields array.
  Logs a console.error in either case to help developers spot schema mismatches.
*/
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

/*
  buildInitialFormValues — converts a raw DynamoDB record object into the flat
  { fieldId: value } object that TableForm expects.

  For each field in tableConfig.fields:
    isPayload=true  → read from record.payload (nested object)
    isPayload=false → read from the record directly (top-level attribute)
  Falls back to field.defaultValue if the record doesn't have that field.
  Boolean fields are normalised to real JS booleans (DynamoDB may return "true" strings).
*/
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
  /*
    view          — "search" or "form"
    formMode      — "edit" | "create" | "duplicate" (only relevant when view="form")
    initialValues — pre-filled field values for TableForm
    fetchError    — error message shown in a red banner on the search screen when
                    fetching a record (Open/Duplicate) fails
    loadingPkValue — the primary key value currently being fetched; used to show
                     a spinner on the specific search result row being opened
  */
  const [view, setView] = useState("search");
  const [formMode, setFormMode] = useState("edit");
  const [initialValues, setInitialValues] = useState({});
  const [fetchError, setFetchError] = useState(null);
  const [loadingPkValue, setLoadingPkValue] = useState(null);

  /* pkField — the primary key field object; null if misconfigured */
  const pkField = getPrimaryKeyField(tableConfig);

  /*
    handleCreate — opens the form in create mode with all fields at their defaults.
    No API call needed here — defaults come from schema.json.
  */
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

  /*
    handleOpen — fetches the full record and opens the form in edit mode.
    Sets loadingPkValue while fetching so the correct row shows a spinner.
    On success: pre-fills the form with the fetched record's values.
    On failure: shows a red fetchError banner on the search screen.
    Guard: if a fetch is already in flight (loadingPkValue !== null), this
    function returns early to prevent concurrent fetches.
  */
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

  /*
    handleDuplicate — fetches the record, copies all values, then clears the
    primary key field so the user must enter a new unique key before creating.
    Same fetch/loading/error pattern as handleOpen.
  */
  const handleDuplicate = async (pkValue) => {
    if (loadingPkValue) return;
    setLoadingPkValue(pkValue);
    try {
      const record = await fetchTableRecord(tableConfig.tableName, pkField?.id, pkValue);
      if (!record) { setFetchError("Failed to load record — please try again."); return; }
      setFetchError(null);
      const vals = buildInitialFormValues(tableConfig, record);
      /* Clear the primary key so the user must provide a new unique value */
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
      {/*
        Dark backdrop — semi-transparent overlay covering the whole screen.
        fixed inset-0 → covers the entire viewport
        bg-black/50   → 50% opacity black (the page dims behind the modal)
        z-40          → sits below the modal (z-50) but above everything else

        Clicking the backdrop calls onClose() — same as pressing Cancel.
        onKeyDown Enter also fires onClose for keyboard accessibility.
      */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        role="button"
        aria-label="Close modal"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
      />

      {/*
        Modal panel — the main white/lavender rectangle.
        fixed top-5 left-0 right-0 bottom-0 → fills most of the screen,
                                              5px from the top edge
        z-50       → above the backdrop (z-40)
        bg-[#e8e0e8] → soft lavender background
        rounded-2xl shadow-2xl → large rounded corners, big drop shadow
        border-l-4 border-l-rose-900 → thick dark-rose left accent stripe
        flex flex-col → ModalHeader + content area stack vertically
      */}
      <div className="fixed top-5 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col">

        {/*
          ModalHeader — the title bar with back arrow and Cancel button.
          title / description → from tableConfig (schema.json item)
          formMode → only passed when on the form screen so the mode badge shows
          onBack   → only passed when on the form screen (back → "search")
          onClose  → always passed (Cancel button always visible)
          No badge prop here (badge is only used in HOOModal for queue name)
        */}
        <ModalHeader
          title={tableConfig.title}
          description={tableConfig.description}
          formMode={view === "form" ? formMode : undefined}
          onBack={view === "form" ? () => setView("search") : undefined}
          onClose={onClose}
        />

        {/*
          SEARCH SCREEN (view === "search")
          The default view. Shows a search input where the user types a primary
          key value (e.g. a phone number, DID, mailbox number).
          fetchError — a red banner shown above TableSearch if handleOpen or
          handleDuplicate failed to load a record.
          loadingPkValue — passed to TableSearch so the specific row being
          fetched can show a spinning icon instead of the options button.
        */}
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

        {/*
          FORM SCREEN (view === "form")
          Shown after clicking "New Record", "Open", or "Duplicate".
          key={`${formMode}-${initialValues[pkField?.id] ?? "new"}`}
            → forces a remount when the user opens a different record or switches
               mode; this clears all form state (errors, dirty check, etc.)
          onDone → returns to search screen after a successful save/create
        */}
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
