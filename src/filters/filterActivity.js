import { isTextFilterActive } from "./inputs/Text.jsx";
import { isNumberFilterActive } from "./inputs/Number.jsx";
import { isPercentageFilterActive } from "./inputs/Percentage.jsx";
import { isCapacityFilterActive } from "./inputs/Capacity.jsx";
import { isDropdownFilterActive } from "./inputs/Dropdown.jsx";
import { isCheckboxFilterActive } from "./inputs/Checkbox.jsx";
import { isHoursFilterActive } from "./inputs/Hours.jsx";
import { isAgeRangeFilterActive } from "./inputs/AgeRange.jsx";
import { isPriceRangeArrayFilterActive } from "./inputs/PriceRangeArray.jsx";
import { isTagListFilterActive } from "./inputs/TagList.jsx";
import { isTimeFilterActive } from "./time/Time.jsx";
import { isGeometryFilterActive } from "./geometry/Geometry.jsx";
import { isUserNameFilterActive } from "./user/User.jsx";

export function isFilterActive(filterDef, filterState, timeFilterOverride) {
  const value = filterState?.[filterDef.id];
  if (!value) return false;

  switch (filterDef.type) {
    case "userName":
      return isUserNameFilterActive(value);

    case "text":
      return isTextFilterActive(value);

    case "number":
      return isNumberFilterActive(value);

    case "percentage":
      return isPercentageFilterActive(value);

    case "capacity":
      return isCapacityFilterActive(value);

    case "geometry":
      return isGeometryFilterActive(value, filterDef.schemaInput);

    case "checkbox":
      return isCheckboxFilterActive(value);

    case "dropdown":
      return isDropdownFilterActive(value);

    case "hours":
      return isHoursFilterActive(value);

    case "time":
      return isTimeFilterActive(value, timeFilterOverride);

    case "ageRange":
      return isAgeRangeFilterActive(value);

    case "priceRangeArray":
      return isPriceRangeArrayFilterActive(value);

    case "tagList":
      return isTagListFilterActive(value);

    default:
      return false;
  }
}

export function getActiveFilters(
  filterableInputs,
  filterState,
  timeFilterOverride
) {
  return filterableInputs.filter((f) =>
    isFilterActive(f, filterState, timeFilterOverride)
  );
}