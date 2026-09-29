import "./Tooltip.css";

export default function Tooltip({ text, position = "top" }) {
  return (
    <div
      className={`system-tooltip tooltip-${position}`}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}