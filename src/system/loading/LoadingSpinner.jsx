import "./LoadingSpinner.css";

export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="loading-overlay" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <p className="loading-text">{text}</p>
    </div>
  );
}