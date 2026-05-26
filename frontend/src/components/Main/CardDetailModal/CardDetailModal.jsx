import { useState } from "react";
import mockData from "../../../mockApiData.json";
import StringField from "./Type/String.jsx";
import DropDownField from "./Type/DropDown.jsx";
import BooleanField from "./Type/Boolean.jsx";

const FIELD_COMPONENTS = {
  string: StringField,
  dropdown: DropDownField,
  boolean: BooleanField,
};

function normalizeValue(field, raw) {
  const val = raw !== undefined ? raw : field.defaultValue;
  if (field.type === "boolean") {
    if (val === "True" || val === "true") return true;
    if (val === "False" || val === "false") return false;
  }
  return val;
}

function getInitialValues(card) {
  // Replace mockData lookup with: await fetch(`/api/${card.tableName}`)
  const current = mockData[card.tableName] ?? {};
  const initial = {};
  card.fields?.forEach((f) => {
    initial[f.id] = normalizeValue(f, current[f.id]);
  });
  return initial;
}

export default function CardDetailModel({ card, onClose }) {
  const [formValues, setFormValues] = useState(() => getInitialValues(card));
  const [errors, setErrors] = useState({});

  const handleChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: false }));
  };

  const handleSubmit = async () => {
    const newErrors = {};
    card.fields?.forEach((f) => {
      if (f.required && (formValues[f.id] ?? "") === "") newErrors[f.id] = true;
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    // Strip fields where value is "" — they won't be created in the database
    const payload = Object.fromEntries(
      Object.entries(formValues).filter(([, v]) => v !== "")
    );

    // Replace with: await fetch(`/api/${card.tableName}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    console.log("Saving to", card.tableName, payload);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-16 left-0 right-0 bottom-0 z-50 bg-[#e8e0e8] rounded-tl-3xl rounded-tr-3xl shadow-2xl border-l-4 border-l-rose-900 flex flex-col">

        {/* Header — stays pinned, never scrolls */}
        <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b border-[#c8b8c8] shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#3b1a3b]">{card.title}</h2>
            <p className="text-sm text-[#5b2d5b] mt-0.5">{card.description}</p>
          </div>
          <div className="flex gap-2 items-center shrink-0 ml-4">
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-rose-700 rounded-lg border border-rose-800 hover:bg-rose-900 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              Submit
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-semibold text-[#5b2d5b] bg-[#d4c8d4] rounded-lg border border-[#b8a8b8] hover:bg-[#c0b0c0] active:scale-95 transition-all duration-150 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Fields — only this area scrolls */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex flex-col gap-4 max-w-lg">
            {card.fields?.map((field) => {
              const Component = FIELD_COMPONENTS[field.type] ?? StringField;
              return (
                <Component
                  key={field.id}
                  field={field}
                  value={formValues[field.id]}
                  onChange={handleChange}
                  error={errors[field.id]}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
