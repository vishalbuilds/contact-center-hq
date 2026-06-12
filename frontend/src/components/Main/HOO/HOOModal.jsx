import { useState } from "react";
import ModalHeader from "../Components/ModalHeader.jsx";
import HOOSearch from "./HOOSearch/HOOSearch.jsx";
import HOOWeekView from "./HOOWeekView/HOOWeekView.jsx";
import HOOForm from "./HOOForm/HOOForm.jsx";
import HOOBulkEditForm from "./HOOBulkEditForm/HOOBulkEditForm.jsx";
import { buildFormValues } from "./buildFormValues.js";

export default function HOOModal({ hooConfig, resourceType, onClose }) {
  const [view, setView] = useState("search");
  const [formMode, setFormMode] = useState("create");
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [formInitialValues, setFormInitialValues] = useState({});
  const [bulkQueues, setBulkQueues] = useState([]);

  const handleOpen = (queueArn, queueName) => {
    setSelectedQueue({ queueArn, queueName });
    setView("week");
  };

  const handleCreateNew = (queueArn, queueName) => {
    const vals = buildFormValues(hooConfig, null);
    if (queueArn) {
      vals[hooConfig.partitionKey] = queueArn;
      vals[hooConfig.GSIKey] = queueName ?? "";
    }
    setFormInitialValues(vals);
    setFormMode("create");
    setSelectedQueue(queueArn ? { queueArn, queueName } : null);
    setView("form");
  };

  const handleBulkEdit = (queues) => {
    setBulkQueues(queues);
    setView("bulkEdit");
  };

  const handleFormDone = () => setView("search");

  const handleBack = () => {
    setSelectedQueue(null);
    setBulkQueues([]);
    setView("search");
  };

  const headerBadge =
    view === "week" && selectedQueue ? (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
        {selectedQueue.queueName}
      </span>
    ) : view === "bulkEdit" ? (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
        Bulk Edit — {bulkQueues.length} queue{bulkQueues.length !== 1 ? "s" : ""}
      </span>
    ) : null;

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
      <div
        id="hoo-modal"
        className="fixed top-5 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col"
      >
        <ModalHeader
          title={hooConfig.title}
          description={hooConfig.description}
          formMode={view === "form" ? formMode : undefined}
          onBack={view !== "search" ? handleBack : undefined}
          onClose={onClose}
          badge={headerBadge}
        />

        {view === "search" && (
          <HOOSearch
            hooConfig={hooConfig}
            resourceType={resourceType}
            onViewAll={handleOpen}
            onCreateNew={handleCreateNew}
            onBulkEdit={handleBulkEdit}
          />
        )}
        {view === "week" && (
          <HOOWeekView
            key={selectedQueue?.queueArn}
            hooConfig={hooConfig}
            resourceType={resourceType}
            selectedQueue={selectedQueue}
          />
        )}
        {view === "form" && (
          <HOOForm
            hooConfig={hooConfig}
            resourceType={resourceType}
            formMode={formMode}
            initialValues={formInitialValues}
            onDone={handleFormDone}
            onCancel={handleBack}
          />
        )}
        {view === "bulkEdit" && (
          <HOOBulkEditForm
            hooConfig={hooConfig}
            selectedQueues={bulkQueues}
            onDone={handleBack}
            onCancel={handleBack}
          />
        )}
      </div>
    </>
  );
}
