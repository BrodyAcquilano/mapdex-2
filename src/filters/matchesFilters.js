import { matchesUserNameFilter } from "./user/User.jsx";
import { matchesTimeFilter } from "./time/Time.jsx";
import { matchesGeometryFilter } from "./geometry/Geometry.jsx";
import { matchesTextFilter } from "./inputs/Text.jsx";
import { matchesNumberFilter } from "./inputs/Number.jsx";
import { matchesPercentageFilter } from "./inputs/Percentage.jsx";
import { matchesCapacityFilter } from "./inputs/Capacity.jsx";
import { matchesDropdownFilter } from "./inputs/Dropdown.jsx";
import { matchesCheckboxFilter } from "./inputs/Checkbox.jsx";
import { matchesHoursFilter } from "./inputs/Hours.jsx";
import { matchesAgeRangeFilter } from "./inputs/AgeRange.jsx";
import { matchesPriceRangeArrayFilter } from "./inputs/PriceRangeArray.jsx";
import { matchesTagListFilter } from "./inputs/TagList.jsx";

/*
 * `boundariesById` is a Map of boundary id -> boundary document,
 * needed only by the geometry filter's own boundary clip - the one
 * filter whose stored value (an id) can't be evaluated without data
 * from outside filterState. Callers that have no boundaries can omit
 * it; the geometry filter treats an unresolvable id as "no clip".
 */
export function matchesAllActiveFilters({
  dataItem,
  activeFilters,
  filterState,
  schema,
  filterTimeZone,
  boundariesById,
}) {
  for (const f of activeFilters) {
    const filterValue = filterState[f.id];

    if (f.source === "user") {
      if (!matchesUserNameFilter(filterValue, dataItem)) {
        return false;
      }
      continue;
    }

    if (f.source === "time") {
      if (!matchesTimeFilter(filterValue, dataItem?.time, filterTimeZone)) {
        return false;
      }
      continue;
    }

    if (f.source === "geometry") {
      if (!matchesGeometryFilter(filterValue, dataItem?.geometry, boundariesById)) {
        return false;
      }
      continue;
    }

    const schemaSectionId = schema.sections[f.sectionIndex].id;
    const dataSection = dataItem.sectionById?.get(schemaSectionId);
    const dataInput = dataSection?.inputById?.get(f.id);

    switch (f.type) {
      case "text":
        if (!matchesTextFilter(filterValue, dataInput)) return false;
        break;

      case "number":
        if (!matchesNumberFilter(f.schemaInput, filterValue, dataInput)) {
          return false;
        }
        break;

      case "percentage":
        if (!matchesPercentageFilter(f.schemaInput, filterValue, dataInput)) {
          return false;
        }
        break;

      case "capacity":
        if (!matchesCapacityFilter(f.schemaInput, filterValue, dataInput)) {
          return false;
        }
        break;

      case "checkbox":
        if (!matchesCheckboxFilter(filterValue, dataInput)) return false;
        break;

      case "dropdown":
        if (!matchesDropdownFilter(filterValue, dataInput)) return false;
        break;

      case "hours":
        if (!matchesHoursFilter(filterValue, dataInput)) {
          return false;
        }
        break;

      case "ageRange":
        if (!matchesAgeRangeFilter(f.schemaInput, filterValue, dataInput)) {
          return false;
        }
        break;

      case "priceRangeArray":
        if (
          !matchesPriceRangeArrayFilter(f.schemaInput, filterValue, dataInput)
        ) {
          return false;
        }
        break;

      case "tagList":
        if (!matchesTagListFilter(filterValue, dataInput)) {
          return false;
        }
        break;

      default:
        break;
    }
  }

  return true;
}