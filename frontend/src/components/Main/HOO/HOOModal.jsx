import { useState } from "react";
import ModalHeader from "../Components/ModalHeader.jsx";
import HOOSearch from "./HOOSearch/HOOSearch.jsx";
import HOOWeekView from "./HOOWeekView/HOOWeekView.jsx";
import HOOForm from "./HOOForm/HOOForm.jsx";
import { buildFormValues } from "./buildFormValues.js";

export default function HOOModal({ hooConfig, onClose }) {
  const [view, setView] = useState("search");
  const [formMode, setFormMode] = useState("create");
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [formInitialValues, setFormInitialValues] = useState({});

  // Opens the week view — no pre-fetch needed, HOOWeekView fetches its own records
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

  const handleFormDone = () => setView("search");

  const handleBack = () => {
    setSelectedQueue(null);
    setView("search");
  };

  return (
    <>
      {/* out side click close modal */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        role="button"
        aria-label="Close modal"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
      />
      <div id="hoo-modal" className="fixed top-5 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-2xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col">
        {/* HOO modal header*/}
        <ModalHeader
          title={hooConfig.title}
          description={hooConfig.description}
          formMode={view === "form" ? formMode : undefined}
          onBack={view === "form" || view === "week" ? handleBack : undefined}
          onClose={onClose}
          badge={view === "week" && selectedQueue ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
              {selectedQueue.queueName}
            </span>
          ) : null}
        />
        {/* HOO search by queue name */}
        {view === "search" && (
          <HOOSearch
            hooConfig={hooConfig}
            onViewAll={handleOpen}
            onCreateNew={handleCreateNew}
          />
        )}
        {/* week view for schedule and exception */}
        {view === "week" && (
          <HOOWeekView
            key={selectedQueue?.queueArn}
            hooConfig={hooConfig}
            selectedQueue={selectedQueue}
          />
        )}
        {/* credit,edit and duplicate option */}
        {view === "form" && (
          <HOOForm
            hooConfig={hooConfig}
            formMode={formMode}
            initialValues={formInitialValues}
            onDone={handleFormDone}
            onCancel={handleBack}
          />
        )}
      </div>
    </>
  );
}
