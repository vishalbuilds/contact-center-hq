import { useState } from "react";
import Card from "./Components/Card.jsx";
import TableModal from "./Table/TableModal.jsx";
import HOOModal from "./HOO/HOOModal.jsx";
import schema from "../../schema.json";

/*
  componentMap — the routing table that connects a schema type to its modal.

  schema.json has two schema types: "table" and "hoo".
  When Main renders it needs to know:
    1. Which modal component to open  →  Modal
    2. Which prop name to pass the config under  →  propKey

  "table" configs are passed to TableModal as  tableConfig={...}
  "hoo"   configs are passed to HOOModal   as  hooConfig={...}

  If a new schema type is added to schema.json in the future, just add
  a new entry here — no other change needed in Main.
*/
const componentMap = {
  table: { Modal: TableModal, propKey: "tableConfig" },
  hoo:   { Modal: HOOModal,   propKey: "hooConfig"   },
};

export default function Main() {
  /*
    selected — tracks which card the user clicked.
    Starts as null (no modal open).
    When a Card is clicked it becomes an object:
      {
        config:   the full item object from schema.json (tableName, fields, etc.)
        Modal:    the React component to render (TableModal or HOOModal)
        propKey:  the prop name to pass config under ("tableConfig" or "hooConfig")
      }
    Setting it back to null closes the modal.
  */
  const [selected, setSelected] = useState(null);

  return (
    /*
      <main> — the scrollable page body that sits below the top navbar.

      Tailwind classes explained:
        flex-1          → takes all remaining vertical space (navbar gets the rest)
        overflow-y-auto → adds a vertical scrollbar if content is taller than the screen
        py-8 px-4       → 32px top/bottom padding, 16px left/right padding
        space-y-6       → 24px gap between each <section> child
        bg-[#e8e0e8]    → the soft lavender/mauve page background colour
    */
    <main className="flex-1 overflow-y-auto py-8 px-4 space-y-6 bg-[#e8e0e8]">

      {/*
        schema.map() — loops over every top-level group in schema.json.
        schema.json currently has two groups:
          1. schemaType "table"  →  "Voice Channel Table Configuration"
          2. schemaType "hoo"    →  "Hours Of Operation Configuration"

        Each group produces one <section> block on the page.

        componentMap lookup:
          If the schemaType is not in componentMap (i.e. unknown type),
          Modal and propKey will be undefined and the section is skipped
          with `return null` — a safety guard against bad schema entries.
      */}
      {schema.map((section) => {
        const { Modal, propKey } = componentMap[section.schemaType] ?? {};
        if (!Modal) return null;

        return (
          /*
            <section> — one visual group on the page (e.g. all Table cards,
            or all HOO cards). The key is the schemaType string so React can
            track each group efficiently when the list re-renders.
          */
          <section key={section.schemaType}>

            {/*
              Section heading — the bold title displayed above the card grid.
              Comes from section.title in schema.json, e.g.
              "Voice Channel Table Configuration".

              Tailwind classes:
                text-lg font-bold   → large, bold text
                mb-3                → 12px gap below the heading before the card grid
                pl-3                → 12px left padding so the text is indented
                border-l-4          → a 4px thick left border (the accent stripe)
                border-rose-900     → dark rose/crimson colour for that stripe
                text-[#5b2d5b]      → medium purple text colour
            */}
            <h2 className="text-lg font-bold mb-3 pl-3 border-l-4 border-rose-900 text-[#5b2d5b]">
              {section.title}
            </h2>

            {/*
              Card grid — lays out all the clickable cards for this section.
              Each item in section.schema becomes one Card.

              Tailwind classes:
                grid grid-cols-10   → 10 equal columns side by side
                gap-3               → 12px gap between every card
            */}
            <div className="grid grid-cols-10 gap-3">

              {/*
                section.schema.map() — loops over every item inside this group.
                For "table" this gives: Initial Config, User DID Mapping,
                Voicemail Access, Outbound Mapping.
                For "hoo" this gives: Queue Schedule, Queue Exception.

                Each item from schema.json looks like:
                  {
                    id:          "schedule"              ← unique ID for the card
                    title:       "Queue Schedule Table Config"
                    description: "Table for Queue Schedule table configuration"
                    tableName:   "CCaaS-queue-schedule-config"
                    partitionKey, sortKey, GSIKey, fields, ...
                  }

                The Card component only needs title, description, and onClick.
                The full item object is captured in the closure so it can be
                passed to setSelected when the user clicks.

                NO API CALL happens here — Main.jsx only decides which modal
                to open. The actual network requests happen inside the modal:
                  • TableModal  →  fetches/creates/updates/deletes DynamoDB
                                   records via /api/v1/table/...
                  • HOOModal    →  HOOSearch calls searchQueues() to find queues
                                   via the GSI, then HOOWeekView calls
                                   getQueueRecords() to load existing HOO records.
                                   HOOForm calls createHooRecord() or
                                   updateHooRecord() to save changes.
                                   deleteHooRecord() is called from HOOWeekView
                                   when the user confirms a delete.
              */}
              {section.schema.map((item) => (
                <Card
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  /*
                    onClick — when the user clicks this card, setSelected stores
                    the full item config, the right Modal component, and the
                    correct prop name. This triggers a re-render and the modal
                    appears on screen (see the modal block at the bottom).
                  */
                  onClick={() => setSelected({ config: item, Modal, propKey })}
                />
              ))}
            </div>

            {/*
              Divider line — a thin horizontal rule rendered below each section's
              card grid to visually separate it from the next section.

              Tailwind classes:
                border-t            → top border only (makes it a horizontal line)
                border-[#b8a8b8]    → muted mauve/grey colour
                mt-6                → 24px space above the line
            */}
            <hr className="border-t border-[#b8a8b8] mt-6" />
          </section>
        );
      })}

      {/*
        Modal renderer — sits outside the section loop so it always renders
        on top of the page content rather than inside a specific section.

        Only renders when `selected` is not null (i.e. a card was clicked).

        How the dynamic props work:
          selected.Modal is either TableModal or HOOModal.
          selected.propKey is either "tableConfig" or "hooConfig".
          The spread  { [selected.propKey]: selected.config }  turns into
          either  tableConfig={selected.config}  or  hooConfig={selected.config}
          so each modal receives its config under the correct prop name.

          key={selected.config.id} forces a full remount when the user closes
          one modal and opens a different card — clears all internal state
          (search results, form values, selected queue, etc.) from the previous
          card so the new modal always starts clean.

        onClose={() => setSelected(null)} — when the user closes the modal
          (clicks the backdrop, the ✕ button, or presses Back to search and
          then closes) setSelected returns to null, the modal unmounts, and
          the page returns to its normal card-grid state.
      */}
      {selected && (
        <selected.Modal
          key={selected.config.id}
          {...{ [selected.propKey]: selected.config }}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
