import ResultRow from "../Result/Result.jsx";

export default function Search({
  pkField,
  searchInput,
  setSearchInput,
  onSearch,
  searching,
  results,
  onOpen,
  onDuplicate,
  onDelete,
  onCreateNew,
}) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex gap-3 mb-6 max-w-2xl">
        <input
          type="text"
          aria-label={`Search by ${pkField?.title ?? "primary key"}`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder={`Search by ${pkField?.title ?? "primary key"}…`}
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#d4c4d4] rounded-xl focus:outline-none focus:border-rose-400 text-[#3b1a3b] placeholder-[#a090a0]"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={searching}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-900 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-5 py-2.5 text-sm font-semibold text-[#5b2d5b] bg-white border border-[#d4c4d4] rounded-xl hover:bg-[#f5f0f5] active:scale-95 transition-all cursor-pointer"
        >
          New Record
        </button>
      </div>

      {results === null && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          Enter a value and click Search to find records.
        </p>
      )}
      {results !== null && results.length === 0 && (
        <p className="text-sm text-[#a090a0] text-center py-12">
          No records found for &ldquo;{searchInput}&rdquo;.
        </p>
      )}
      {results !== null && results.length > 0 && (
        <div className="flex flex-col gap-3 max-w-2xl">
          <p className="text-xs text-[#8b6b8b] mb-1">
            {results.length} record{results.length !== 1 ? "s" : ""} found
          </p>
          {results.map((pkValue) => (
            <ResultRow
              key={pkValue}
              pkTitle={pkField?.title ?? "PK"}
              pkValue={pkValue}
              onOpen={onOpen}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
