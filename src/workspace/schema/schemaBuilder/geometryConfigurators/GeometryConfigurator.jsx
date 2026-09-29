// src/workspace/schema/schemaBuilder/geometryConfigurators/GeometryConfigurator.jsx

import { GEOMETRY_LIMITS } from "../../../../../shared/validation/validationConstants.js";

function sortGeometryTypes(types) {
  return GEOMETRY_LIMITS.typeOptions.filter((type) =>
    types.includes(type),
  );
}

function GeometryConfigurator({
  geometry,
  geometryTypes,
  setDraftSchema,
  lockedFields = [],
}) {
  function isLockedField(fieldName) {
    return lockedFields.includes(fieldName);
  }

  function update(field, value) {
    if (isLockedField(field)) return;

    setDraftSchema((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        [field]: value,
      },
    }));
  }

  const rawTypes = Array.isArray(geometry?.types)
    ? geometry.types
    : [];

  const types = sortGeometryTypes(rawTypes);

  const allowedTypes = sortGeometryTypes(
    Array.isArray(geometryTypes)
      ? geometryTypes
      : [],
  );

  const addableTypes = allowedTypes.filter(
    (type) => !types.includes(type),
  );

  const isTypesLocked =
    isLockedField("types");

  function updateTypes(nextTypes) {
    if (isTypesLocked) return;

    const sortedNextTypes =
      sortGeometryTypes(nextTypes);

    if (sortedNextTypes.length === 0) {
      return;
    }

    setDraftSchema((prev) => ({
      ...prev,
      geometry: {
        ...prev.geometry,
        types: sortedNextTypes,
      },
    }));
  }

  function handleAddType(type) {
    if (
      !type ||
      isTypesLocked ||
      !allowedTypes.includes(type) ||
      types.includes(type)
    ) {
      return;
    }

    updateTypes([
      ...types,
      type,
    ]);
  }

  function handleDeleteType(type) {
    if (
      isTypesLocked ||
      types.length <= 1
    ) {
      return;
    }

    updateTypes(
      types.filter(
        (currentType) =>
          currentType !== type,
      ),
    );
  }

  return (
    <div className="input-configurator-group">
      <label className="input-configurator-option">
        <input
          type="checkbox"
          checked={!!geometry.isFilter}
          onChange={(e) =>
            update(
              "isFilter",
              e.target.checked,
            )
          }
          disabled={isLockedField("isFilter")}
        />
        Show as Filter Option
      </label>

      <label className="input-configurator-option">
        <input
          type="checkbox"
          checked={!!geometry.isDisplayed}
          onChange={(e) =>
            update(
              "isDisplayed",
              e.target.checked,
            )
          }
          disabled={isLockedField("isDisplayed")}
        />
        Display in Info Panel
      </label>

      <h3 className="input-configurator-subtitle">
        Allowed Geometry Types
      </h3>

      <ul className="input-configurator-static-list">
        {types.map((type) => (
          <li
            key={type}
            className="input-configurator-static-item"
          >
            <span className="input-configurator-static-list-label">
              - {type}
            </span>

            <span
              className="input-configurator-delete-option"
              onClick={() => {
                if (isTypesLocked) return;
                if (types.length <= 1) return;

                handleDeleteType(type);
              }}
              title={
                types.length <= 1
                  ? "At least one geometry type is required."
                  : "Delete Geometry Type"
              }
              style={{
                pointerEvents:
                  isTypesLocked ||
                  types.length <= 1
                    ? "none"
                    : "auto",
                opacity:
                  isTypesLocked ||
                  types.length <= 1
                    ? 0.5
                    : 1,
              }}
            >
              &minus;
            </span>
          </li>
        ))}
      </ul>

      {addableTypes.length > 0 && (
        <label className="input-configurator-option">
          Add Geometry Type:
          <select
            value=""
            onChange={(e) => {
              const nextType =
                e.target.value;

              if (
                !nextType ||
                isTypesLocked
              ) {
                return;
              }

              handleAddType(nextType);
            }}
            disabled={isTypesLocked}
          >
            <option value="">
              Select type...
            </option>

            {addableTypes.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export default GeometryConfigurator;