import { useState } from "react";
import Cards from "./Cards/Cards.jsx";
import CardDetailModel from "./CardDetailModal/CardDetailModal.jsx";
import uiSchema from "../../uiSchemaTable.json"
const data = [
  { title: "Users", description: "Manage users" },
  { title: "Orders", description: "View orders" },
  { title: "Products", description: "Inventory list" },
  { title: "Reports", description: "Analytics data" },
];

export default function Main() {
  const [cardDetail, setCardDetail] = useState(null);
  return (
    <main className="flex-1 overflow-y-auto py-8 px-4 space-y-6 bg-[#e8e0e8]">
      <section>
        <h2 className="text-lg font-bold mb-3 pl-3 border-l-4 border-rose-900 text-[#5b2d5b]">
          Section One
        </h2>
        <div className="grid grid-cols-10 gap-3">
          {uiSchema.map((table) => (
            <Cards key={table.id}
              title={table.title}
              description={table.description}
              onClick={() => setCardDetail(table)} />
          ))}
        </div>
      </section>
      {cardDetail && (
        <CardDetailModel
          key={cardDetail.id}
          card={cardDetail}
          onClose={() => setCardDetail(null)}
        />
      )}

      <hr className="border-t border-[#b8a8b8]" />


      {/* Sample or more cases can be added based on requirement */}
      <section>
        <h2 className="text-lg font-bold mb-3 pl-3 border-l-4 border-rose-900 text-[#5b2d5b]">
          Section Two
        </h2>
        <div className="grid grid-cols-10 gap-3">
          {data.map((item, index) => (
            <Cards key={index} title={item.title} description={item.description} />
          ))}
        </div>
      </section>
      <hr className="border-t border-[#b8a8b8]" />
    </main>
  );
}