// src/workflows/Insights.jsx

import { useEffect } from "react";

import "./Insights.css";

/*
 * The Insights page.
 *
 * A read-only dashboard over what the project currently holds: how many
 * data items, how they break down by geometry type, and how many
 * boundaries, layers and aggregates have been built on top of them.
 *
 * It is deliberately a shell. The numbers it shows today are simple
 * counts, because a project's fields are schema-defined and its
 * locations are arbitrary, so there is little that can be said about
 * every project in general. The value is the frame: a routed page on
 * every engine, with its own runtime-level insights object, that later
 * analysis modes can be added into rather than bolted somewhere else.
 *
 * Everything it renders comes from `insights` (see
 * src/insights/utils/computeProjectInsights.js). This page does no
 * counting of its own - it decides layout and empty states only.
 */
function Insights({ insights, setCurrentPage }) {
  useEffect(() => {
    setCurrentPage("insights");
  }, [setCurrentPage]);

  if (!insights) return null;

  const {
    projectName,
    projectDescription,
    dataItemCount,
    boundaryCount,
    layerCount,
    aggregateCount,
    geometryCounts,
    maxGeometryCount,
    withoutGeometry,
    hasDeclaredGeometryTypes,
  } = insights;

  const stats = [
    { key: "dataItems", label: "Data Items", value: dataItemCount },
    { key: "boundaries", label: "Boundaries", value: boundaryCount },
    { key: "layers", label: "Layers", value: layerCount },
    { key: "aggregates", label: "Aggregates", value: aggregateCount },
  ];

  return (
    <div className="insights-page">
      <div className="insights-content">
        <header className="insights-header">
          <h1 className="insights-title">
            {projectName || "Untitled Project"}
          </h1>

          {projectDescription && (
            <p className="insights-description">{projectDescription}</p>
          )}
        </header>

        <section className="insights-stat-grid" aria-label="Project totals">
          {stats.map((stat) => (
            <div className="insights-stat-card" key={stat.key}>
              <span className="insights-stat-value">{stat.value}</span>
              <span className="insights-stat-label">{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="insights-card" aria-label="Geometry types">
          <h2 className="insights-card-title">Geometry Types</h2>

          {!hasDeclaredGeometryTypes ? (
            <p className="insights-empty">
              This project&apos;s schema does not declare any geometry types.
            </p>
          ) : dataItemCount === 0 ? (
            <p className="insights-empty">
              No data items yet - counts will appear here once the project has
              some.
            </p>
          ) : (
            <ul className="insights-bar-chart">
              {geometryCounts.map((row) => {
                /*
                 * Scaled against the largest bar, not the total, so a
                 * spread-out project still reads clearly. Guarded
                 * because every bar can legitimately be 0.
                 */
                const widthPercent =
                  maxGeometryCount > 0
                    ? (row.count / maxGeometryCount) * 100
                    : 0;

                return (
                  <li className="insights-bar-row" key={row.type}>
                    <span className="insights-bar-label">
                      {row.type}
                      {!row.declared && (
                        <span
                          className="insights-bar-tag"
                          title="Present in the data but not declared by the schema"
                        >
                          undeclared
                        </span>
                      )}
                    </span>

                    <span className="insights-bar-track">
                      <span
                        className={`insights-bar-fill${
                          row.declared ? "" : " insights-bar-fill-undeclared"
                        }`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </span>

                    <span className="insights-bar-value">{row.count}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/*
           * Only shown when it is actually non-zero: an item with no
           * geometry at all belongs to no bar above, so without this
           * the chart would silently fail to account for it.
           */}
          {withoutGeometry > 0 && (
            <p className="insights-footnote">
              {withoutGeometry} item{withoutGeometry === 1 ? "" : "s"} with no
              geometry.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default Insights;
