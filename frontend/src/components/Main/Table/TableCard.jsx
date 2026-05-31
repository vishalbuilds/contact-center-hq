export default function TableCard({ title, description, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`aspect-square rounded-lg border-l-4 border-l-rose-900 p-2
            flex flex-col gap-1 overflow-hidden bg-[#d4c8d4] text-left
            transition-all duration-200
            ${onClick
                    ? "hover:bg-[#c4b0c4] hover:scale-105 active:bg-[#bda7bd] active:scale-110 cursor-pointer"
                    : "opacity-60 cursor-default"
                }`}
        >
            <div className="text-xs font-semibold text-[#3b1a3b] wrap-break-word">{title}</div>
            <div className="text-[10px] text-[#5b2d5b] wrap-break-word">{description}</div>
        </button>
    );
}
