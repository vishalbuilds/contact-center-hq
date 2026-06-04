import { useState } from "react";
import Card from "./Components/Card.jsx";
import TableModal from "./Table/TableModal.jsx";
import HOOModal from "./HOO/HOOModal.jsx";
import schema from "../../schema.json";

const componentMap = {
  table: { Modal: TableModal, propKey: "tableConfig" },
  hoo:   { Modal: HOOModal,   propKey: "hooConfig"   },
};

export default function Main() {
  const [selected, setSelected] = useState(null);

  return (
    <main className="flex-1 overflow-y-auto py-8 px-4 space-y-6 bg-[#e8e0e8]">
      {schema.map((section) => {
        const { Modal, propKey } = componentMap[section.schemaType] ?? {};
        if (!Modal) return null;

        return (
          <section key={section.schemaType}>
            <h2 className="text-lg font-bold mb-3 pl-3 border-l-4 border-rose-900 text-[#5b2d5b]">
              {section.title}
            </h2>
            <div className="grid grid-cols-10 gap-3">
              {section.schema.map((item) => (
                <Card
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  onClick={() => setSelected({ config: item, Modal, propKey })}
                />
              ))}
            </div>
            <hr className="border-t border-[#b8a8b8] mt-6" />
          </section>
        );
      })}
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
