
import "../workspace/MainApp.css";

export default function FilterToggle({showFilter, setShowFilter}) {

  return (
    <button
      className={`left-side-toggle left-toggle ${
        showFilter ? "" : "left-collapsed-toggle"
      }`}
      aria-label="Toggle Filter Panel"
      onClick={() => setShowFilter(!showFilter)}
    >
      ☰
    </button>
  );
}
