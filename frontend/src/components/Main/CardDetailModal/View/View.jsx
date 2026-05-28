import StringField from "../Type/String.jsx";
import DropDownField from "../Type/DropDown.jsx";
import BooleanField from "../Type/Boolean.jsx";

const FIELD_COMPONENTS = {
  string: StringField,
  dropdown: DropDownField,
  boolean: BooleanField,
};

export default function View({ card, pkField, formMode, formValues, errors, pkError, onChange }) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      {formMode === "duplicate" && (
        <div className="max-w-lg mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          All fields copied. Set a new unique{" "}
          <strong>{pkField?.title ?? "primary key"}</strong> before creating.
        </div>
      )}
      <div className="flex flex-col gap-4 max-w-lg">
        {card.fields?.map((field) => {
          const Component = FIELD_COMPONENTS[field.type] ?? StringField;
          const isPk = pkField && field.id === pkField.id;
          return (
            <div key={field.id}>
              <Component
                field={field}
                value={formValues[field.id]}
                onChange={onChange}
                error={errors[field.id]}
              />
              {isPk && pkError && (
                <p className="text-xs text-red-500 mt-1">{pkError}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
