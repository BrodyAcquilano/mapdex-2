// src/map/tools/GeometryToolbar.jsx

import { useEffect, useState } from "react";

import "./GeometryToolbar.css";

function PointToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="4"
        className="geometry-icon-fill"
      />
    </svg>
  );
}

function LineToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <line
        x1="5"
        y1="17"
        x2="19"
        y2="7"
        className="geometry-icon-line"
      />

      <circle
        cx="5"
        cy="17"
        r="2.2"
        className="geometry-icon-node"
      />

      <circle
        cx="19"
        cy="7"
        r="2.2"
        className="geometry-icon-node"
      />
    </svg>
  );
}

function PolygonToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <polygon
        points="12,4 20,10 17,19 7,19 4,10"
        className="geometry-icon-polygon"
      />

      <circle cx="12" cy="4" r="1.6" className="geometry-icon-node" />
      <circle cx="20" cy="10" r="1.6" className="geometry-icon-node" />
      <circle cx="17" cy="19" r="1.6" className="geometry-icon-node" />
      <circle cx="7" cy="19" r="1.6" className="geometry-icon-node" />
      <circle cx="4" cy="10" r="1.6" className="geometry-icon-node" />
    </svg>
  );
}

function EditToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <path
        d="M5 3 L17 13 L11.5 14 L9 20 Z"
        className="geometry-icon-cursor"
      />

      <circle
        cx="18"
        cy="17"
        r="2.5"
        className="geometry-icon-edit-node"
      />
    </svg>
  );
}

function MovePointToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="3"
        className="geometry-icon-fill"
      />

      <path
        d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22"
        className="geometry-icon-line"
      />

      <path
        d="M9 4 L12 1 L15 4 M9 20 L12 23 L15 20"
        className="geometry-icon-line"
      />

      <path
        d="M4 9 L1 12 L4 15 M20 9 L23 12 L20 15"
        className="geometry-icon-line"
      />
    </svg>
  );
}

function MidpointToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <line
        x1="4"
        y1="17"
        x2="20"
        y2="7"
        className="geometry-icon-line"
      />

      <circle cx="4" cy="17" r="1.8" className="geometry-icon-node" />
      <circle cx="20" cy="7" r="1.8" className="geometry-icon-node" />

      <circle
        cx="12"
        cy="12"
        r="3.5"
        className="geometry-icon-midpoint-circle"
      />

      <line
        x1="9.8"
        y1="12"
        x2="14.2"
        y2="12"
        className="geometry-icon-midpoint-plus"
      />

      <line
        x1="12"
        y1="9.8"
        x2="12"
        y2="14.2"
        className="geometry-icon-midpoint-plus"
      />
    </svg>
  );
}

function RemovePointToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <line
        x1="4"
        y1="16"
        x2="20"
        y2="8"
        className="geometry-icon-line"
      />

      <circle cx="4" cy="16" r="1.8" className="geometry-icon-node" />
      <circle cx="20" cy="8" r="1.8" className="geometry-icon-node" />

      <circle
        cx="12"
        cy="12"
        r="4"
        className="geometry-icon-remove-circle"
      />

      <line
        x1="9.5"
        y1="12"
        x2="14.5"
        y2="12"
        className="geometry-icon-remove-line"
      />
    </svg>
  );
}

function MergeToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <polygon
        points="3,6 9,6 9,12 3,12"
        className="geometry-icon-polygon"
      />

      <polygon
        points="15,12 21,12 21,18 15,18"
        className="geometry-icon-polygon"
      />

      <path
        d="M9 9 L13 12"
        className="geometry-icon-line"
      />

      <path
        d="M15 15 L13 12"
        className="geometry-icon-line"
      />

      <polygon
        points="10.5,10 15.5,12 10.5,14"
        className="geometry-icon-merge-arrow"
      />
    </svg>
  );
}

function SplitToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="geometry-tool-icon"
      aria-hidden="true"
    >
      <line
        x1="3"
        y1="18"
        x2="9"
        y2="12"
        className="geometry-icon-line"
      />

      <line
        x1="15"
        y1="12"
        x2="21"
        y2="6"
        className="geometry-icon-line"
      />

      <circle cx="3" cy="18" r="1.8" className="geometry-icon-node" />
      <circle cx="9" cy="12" r="1.8" className="geometry-icon-node" />
      <circle cx="15" cy="12" r="1.8" className="geometry-icon-node" />
      <circle cx="21" cy="6" r="1.8" className="geometry-icon-node" />

      <path
        d="M9 7 L9 4 M15 17 L15 20"
        className="geometry-icon-line"
      />

      <path
        d="M7 6 L9 4 L11 6 M13 18 L15 20 L17 18"
        className="geometry-icon-line"
      />
    </svg>
  );
}

const DRAW_TOOLS = [
  {
    key: "point",
    geometryType: "Point",
    label: "Point",
    icon: <PointToolIcon />,
  },
  {
    key: "line",
    geometryType: "LineString",
    label: "Line",
    icon: <LineToolIcon />,
  },
  {
    key: "polygon",
    geometryType: "Polygon",
    label: "Polygon",
    icon: <PolygonToolIcon />,
  },
];

const EDIT_TOOLS = [
  {
    key: "move",
    label: "Move",
    ariaLabel: "Move Geometry Points",
    tooltip: "Move geometry.",
    comingSoon: false,
    icon: <MovePointToolIcon />,
  },
  {
    key: "midpoint",
    label: "Midpoint",
    ariaLabel: "Insert Midpoint",
    tooltip: "Select two adjacent points to insert a midpoint between them.",
    comingSoon: false,
    icon: <MidpointToolIcon />,
  },
  {
    key: "remove",
    label: "Remove",
    ariaLabel: "Remove Geometry Point",
    tooltip: "Select a point on a line or polygon to remove it.",
    comingSoon: false,
    icon: <RemovePointToolIcon />,
  },
  {
    key: "merge",
    label: "Merge",
    ariaLabel: "Merge Geometry",
    tooltip: "Merge: feature coming soon.",
    comingSoon: true,
    icon: <MergeToolIcon />,
  },
  {
    key: "split",
    label: "Split",
    ariaLabel: "Split Geometry",
    tooltip: "Split: feature coming soon.",
    comingSoon: true,
    icon: <SplitToolIcon />,
  },
];

const EDIT_TOOL_KEYS =
  EDIT_TOOLS.map((tool) => tool.key);

const DRAW_TOOL_KEYS =
  DRAW_TOOLS.map((tool) => tool.key);

const DEFAULT_EDIT_TOOL = "move";

export default function GeometryToolbar({
  geometryTool = null,
  setGeometryTool,
  geometryTypes,
}) {
  const [isEditToolbarOpen, setIsEditToolbarOpen] =
    useState(false);

  const allowedGeometryTypes =
    Array.isArray(geometryTypes)
      ? geometryTypes
      : [];

  const visibleDrawTools =
    DRAW_TOOLS.filter((tool) =>
      allowedGeometryTypes.includes(
        tool.geometryType,
      ),
    );

  useEffect(() => {
    if (
      EDIT_TOOL_KEYS.includes(
        geometryTool,
      )
    ) {
      setIsEditToolbarOpen(true);
      return;
    }

    if (
      geometryTool === null ||
      DRAW_TOOL_KEYS.includes(
        geometryTool,
      )
    ) {
      setIsEditToolbarOpen(false);
    }
  }, [geometryTool]);

  function handleDrawToolClick(
    toolKey,
  ) {
    setIsEditToolbarOpen(false);

    setGeometryTool?.(
      geometryTool === toolKey
        ? null
        : toolKey,
    );
  }

  function handleEditButtonClick() {
    if (isEditToolbarOpen) {
      setIsEditToolbarOpen(false);

      setGeometryTool?.(null);

      return;
    }

    setIsEditToolbarOpen(true);

    /*
     * Move is the default editing tool.
     */
    setGeometryTool?.(
      DEFAULT_EDIT_TOOL,
    );
  }

  function handleEditToolClick(tool) {
    if (tool.comingSoon) {
      return;
    }

    /*
     * Edit mode stays active until
     * the main Edit button is closed.
     */
    setGeometryTool?.(
      tool.key,
    );
  }

  return (
    <div className="geometry-toolbar-wrapper">
      <div
        className="geometry-toolbar"
        role="toolbar"
        aria-label="Geometry drawing tools"
      >
        {visibleDrawTools.map((tool) => {
          const isActive =
            geometryTool === tool.key;

          return (
            <button
              key={tool.key}
              type="button"
              className={`geometry-toolbar-button ${
                isActive ? "active" : ""
              }`}
              aria-label={tool.label}
              aria-pressed={isActive}
              title={tool.label}
              onClick={() =>
                handleDrawToolClick(
                  tool.key,
                )
              }
            >
              {tool.icon}

              <span className="geometry-tool-label">
                {tool.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className={`geometry-toolbar-button ${
            isEditToolbarOpen
              ? "active"
              : ""
          }`}
          aria-label="Edit Geometry"
          aria-pressed={
            isEditToolbarOpen
          }
          title="Edit Geometry"
          onClick={
            handleEditButtonClick
          }
        >
          <EditToolIcon />

          <span className="geometry-tool-label">
            Edit
          </span>
        </button>
      </div>

      {isEditToolbarOpen && (
        <div
          className="geometry-toolbar geometry-edit-toolbar"
          role="toolbar"
          aria-label="Geometry editing tools"
        >
          {EDIT_TOOLS.map((tool) => {
            const isActive =
              !tool.comingSoon &&
              geometryTool ===
                tool.key;

            return (
              <button
                key={tool.key}
                type="button"
                className={`geometry-toolbar-button ${
                  isActive
                    ? "active"
                    : ""
                }`}
                aria-label={
                  tool.ariaLabel
                }
                aria-pressed={
                  isActive
                }
                aria-disabled={
                  tool.comingSoon
                }
                title={
                  tool.tooltip
                }
                data-tooltip={
                  tool.tooltip
                }
                onClick={() =>
                  handleEditToolClick(
                    tool,
                  )
                }
              >
                {tool.icon}

                <span className="geometry-tool-label">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
