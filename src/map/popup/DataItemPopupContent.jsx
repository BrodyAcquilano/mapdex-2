// src/map/popup/DataItemPopupContent.jsx

import "./DataItemPopupContent.css";

/*
 * The shared "card" popup content rendered by both map engines when a
 * data item is selected. Mapbox positions this itself (via
 * mapboxMap.project(), see MapboxSelectedItemPopup.jsx) since it has
 * no popup positioning of its own to reuse. Leaflet already has a
 * mature, battle-tested popup positioning system (react-leaflet's
 * <Popup>, anchored to the marker/shape it's nested in, auto-panning
 * near viewport edges, etc.), so the Leaflet layers keep using that
 * for positioning, with its default chrome (background, border, tip,
 * close button) stripped via CSS so this component supplies the only
 * visible box. Either way, this component owns no positioning of its
 * own - just the card look and the close button.
 */
export default function DataItemPopupContent({ headerText, lines, onClose }) {
  const safeLines = Array.isArray(lines) ? lines : [];

  return (
    <div className="mapdex-popup-card">
      {onClose && (
        <button
          type="button"
          className="mapdex-popup-close"
          onClick={onClose}
          aria-label="Close popup"
        >
          &times;
        </button>
      )}

      {headerText && <div className="mapdex-popup-header">{headerText}</div>}

      <div className="mapdex-popup-body">
        {safeLines.map((line, idx) => {
          const [label, ...rest] = String(line).split(": ");
          const value = rest.join(": ");

          return (
            <div key={idx} className="mapdex-popup-row">
              {rest.length > 0 ? (
                <>
                  <strong>{label}:</strong> {value}
                </>
              ) : (
                <strong>{label}</strong>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
