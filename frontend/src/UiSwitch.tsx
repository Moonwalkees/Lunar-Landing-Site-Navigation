import { currentUi, switchUi } from "./uiChoice";

// One button that flips to the other UI (top-right in both). Each UI styles `.ui-switch` in its own CSS.
export default function UiSwitch() {
  const other = currentUi() === "board" ? "classic" : "board";
  return (
    <button type="button" className="ui-switch" onClick={() => switchUi(other)}>
      {other === "classic" ? "CLASSIC VIEW" : "BOARD VIEW"}
    </button>
  );
}
