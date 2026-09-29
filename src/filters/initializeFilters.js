import { createTextFilterState } from "./inputs/Text.jsx";
import { createNumberFilterState } from "./inputs/Number.jsx";
import { createPercentageFilterState } from "./inputs/Percentage.jsx";
import { createCapacityFilterState } from "./inputs/Capacity.jsx";
import { createDropdownFilterState } from "./inputs/Dropdown.jsx";
import { createCheckboxFilterState } from "./inputs/Checkbox.jsx";
import { createHoursFilterState } from "./inputs/Hours.jsx";
import { createAgeRangeFilterState } from "./inputs/AgeRange.jsx";
import { createPriceRangeArrayFilterState } from "./inputs/PriceRangeArray.jsx";
import { createTagListFilterState } from "./inputs/TagList.jsx";
import { createTimeFilterState } from "./time/Time.jsx";
import { createGeometryFilterState } from "./geometry/Geometry.jsx";
import { createUserNameFilterState } from "./user/User.jsx";

export function createFilterStateForType(type, schemaInput) {
  switch (type) {
    case "userName":
      return createUserNameFilterState();

    case "text":
      return createTextFilterState();

    case "number":
      return createNumberFilterState();

    case "percentage":
      return createPercentageFilterState();

    case "capacity":
      return createCapacityFilterState();

    case "dropdown":
      return createDropdownFilterState();

    case "checkbox":
      return createCheckboxFilterState();

    case "hours":
      return createHoursFilterState();

    case "ageRange":
      return createAgeRangeFilterState();

    case "priceRangeArray":
      return createPriceRangeArrayFilterState(schemaInput);

    case "tagList":
      return createTagListFilterState();

    case "time":
      return createTimeFilterState();

    case "geometry":
      return createGeometryFilterState(schemaInput);

    default:
      return createTextFilterState();
  }
}

export function buildInitialFilterState(schema) {
  if (!schema) return {};

  const initialState = {};

  if (schema.engineKey === "presence") {
    initialState.userName = createUserNameFilterState();
  }

  if (
    (schema?.time?.type === "Event" ||
      schema?.time?.type === "Motion") &&
    schema?.time?.isFilter === true
  ) {
    initialState.time = createTimeFilterState();
  }

  if (schema.geometry?.isFilter === true) {
    initialState.geometry = createGeometryFilterState(schema.geometry);
  }

  schema.sections?.forEach((schemaSection) => {
    schemaSection.inputs?.forEach((schemaInput) => {
      if (!schemaInput.isFilter) return;

      if (
        schemaInput.type === "website" ||
        schemaInput.type === "phoneNumber" ||
        schemaInput.type === "email" ||
        schemaInput.type === "notes"
      ) {
        return;
      }

      initialState[schemaInput.id] = createFilterStateForType(
        schemaInput.type,
        schemaInput,
      );
    });
  });

  return initialState;
}