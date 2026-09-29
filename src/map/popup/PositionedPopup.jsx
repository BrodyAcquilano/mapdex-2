// src/map/popup/PositionedPopup.jsx

import "./PositionedPopup.css";

import DataItemPopupContent from "./DataItemPopupContent.jsx";

/*
 * Positions the shared DataItemPopupContent card at a screen pixel
 * coordinate, with a small triangle tail pointing down at that exact
 * spot - useful for telling which item a popup belongs to when
 * several are close together in a cluster.
 *
 * Both MapboxSelectedItemPopup and LeafletSelectedItemPopup use this
 * same wrapper, only differing in how they compute {x, y} (Mapbox via
 * mapboxMap.project(), Leaflet via map.latLngToContainerPoint()), so
 * popups look and behave identically regardless of which map engine
 * is active.
 */
export default function PositionedPopup({ x, y, headerText, lines, onClose }) {
  return (
    <div className="mapdex-positioned-popup" style={{ left: x, top: y }}>
      <DataItemPopupContent
        headerText={headerText}
        lines={lines}
        onClose={onClose}
      />

      <div className="mapdex-popup-tip" />
    </div>
  );
}
