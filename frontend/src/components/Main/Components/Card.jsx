/*
  Card.jsx — the clickable tile shown on the main page for each table/HOO item.

  Used by: Main.jsx inside the card grid. One Card is rendered per item in
  schema.json (e.g. "Initial Config", "Queue Schedule Table Config", etc.).

  WHAT IT LOOKS LIKE
  ──────────────────
  A square button with:
    • a dark-rose left accent stripe (border-l-4 border-l-rose-900)
    • the item title in small bold dark-plum text
    • the item description in even smaller medium-purple text below it
  When hovered it grows slightly (scale-105) and darkens.
  When clicked it shrinks a little more (scale-110) for a "press" feel.
  If onClick is not provided the card renders disabled (greyed out, no hover).

  PROPS
  ─────
  id          — optional HTML id attribute for the button element
  title       — the bold title text shown at the top of the card
                (comes from item.title in schema.json)
  description — the smaller description text below the title
                (comes from item.description in schema.json)
  onClick     — function to call when the card is clicked; if undefined the
                card is disabled (used as a placeholder for cards not yet wired up)
*/
export default function Card({ id, title, description, onClick }) {
  return (
    /*
      <button> — the whole card is a single button element so it is
      keyboard-accessible and semantically correct (a clickable action).

      Tailwind classes:
        aspect-square       → forces width = height, making it a perfect square
        rounded-lg          → slightly rounded corners
        border-l-4          → 4px thick left border only
        border-l-rose-900   → dark rose/crimson colour for the left accent stripe
        p-2                 → 8px padding on all sides inside the card
        flex flex-col gap-1 → stacks title and description vertically with 4px gap
        overflow-hidden     → hides text that is too long to fit
        bg-[#d4c8d4]        → muted lavender background
        text-left           → aligns text to the left (buttons default to centre)
        transition-all duration-200 → all style changes (size, colour) animate over 200ms

      Conditional classes (when onClick is provided):
        hover:bg-[#c4b0c4]   → slightly darker lavender on mouse hover
        hover:scale-105      → grows to 105% size on hover (subtle zoom in)
        active:bg-[#bda7bd]  → even darker background when mouse is pressed down
        active:scale-110     → grows to 110% when pressed (feels like a physical press)
        cursor-pointer       → shows the hand cursor icon on hover

      Conditional classes (when onClick is NOT provided — disabled state):
        opacity-60           → 60% opacity makes it look greyed out / unavailable
        cursor-default       → shows the normal arrow cursor (not clickable)
    */
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`aspect-square rounded-lg border-l-4 border-l-rose-900 p-2
        flex flex-col gap-1 overflow-hidden bg-[#d4c8d4] text-left
        transition-all duration-200
        ${
          onClick
            ? "hover:bg-[#c4b0c4] hover:scale-105 active:bg-[#bda7bd] active:scale-110 cursor-pointer"
            : "opacity-60 cursor-default"
        }`}
    >
      {/*
        Title — the main label for this card (e.g. "Initial Config").
        text-xs        → very small font (12px)
        font-semibold  → semi-bold weight
        text-[#3b1a3b] → dark plum colour
        wrap-break-word → allows long words to wrap so they don't overflow the card
      */}
      <div className="text-xs font-semibold text-[#3b1a3b] wrap-break-word">
        {title}
      </div>

      {/*
        Description — short subtitle below the title (e.g. "Table for initial configuration").
        text-[10px]    → even smaller font than the title
        text-[#5b2d5b] → medium purple, slightly lighter than the title
        wrap-break-word → same wrapping behaviour as the title
      */}
      <div className="text-[10px] text-[#5b2d5b] wrap-break-word">
        {description}
      </div>
    </button>
  );
}
