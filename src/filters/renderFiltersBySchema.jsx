import "../styles/panels.css";

import { renderTextFilter } from "./inputs/Text.jsx";
import { renderNumberFilter } from "./inputs/Number.jsx";
import { renderPercentageFilter } from "./inputs/Percentage.jsx";
import { renderCapacityFilter } from "./inputs/Capacity.jsx";
import { renderDropdownFilter } from "./inputs/Dropdown.jsx";
import { renderCheckboxFilter } from "./inputs/Checkbox.jsx";
import { renderHoursFilter } from "./inputs/Hours.jsx";
import { renderAgeRangeFilter } from "./inputs/AgeRange.jsx";
import { renderPriceRangeArrayFilter } from "./inputs/PriceRangeArray.jsx";
import { renderTagListFilter } from "./inputs/TagList.jsx";
import { renderTimeFilterSection } from "./time/Time.jsx";
import { renderGeometryFilterSection } from "./geometry/Geometry.jsx";
import { renderUserFilterSection } from "./user/User.jsx";
import { renderCheckboxGateFilterSection } from "./conditionalSections/CheckboxGate.jsx";

export function renderFiltersBySchema({
  schema,
  filterState,
  setFilterState,
  boundaries,
  onSelectBoundary,
  filterTimeZone,
  setFilterTimeZone,
  filterTimezoneMode,
  setFilterTimezoneMode,
  viewerTimeZone,
  timeFilterOverride,
  setTimeFilterOverride,
  TIMEZONE_OPTIONS,
  tagFilterDrafts,
  setTagFilterDrafts,
  priceRangeFilterDrafts,
  setPriceRangeFilterDrafts,
}) {
  if (!schema) return null;

  const renderedBlocks = [];

  const userBlock = renderUserFilterSection({
    schema,
    filterState,
    setFilterState,
  });
  if (userBlock) {
    renderedBlocks.push(<div key="user-filter-block">{userBlock}</div>);
  }

  const geometryBlock = renderGeometryFilterSection({
    schema,
    filterState,
    setFilterState,
    boundaries,
    onSelectBoundary,
  });
  if (geometryBlock) {
    renderedBlocks.push(<div key="geometry-filter-block">{geometryBlock}</div>);
  }

  const timeBlock = renderTimeFilterSection({
    schema,
    filterState,
    setFilterState,
    filterTimeZone,
    setFilterTimeZone,
    filterTimezoneMode,
    setFilterTimezoneMode,
    viewerTimeZone,
    timeFilterOverride,
    setTimeFilterOverride,
    TIMEZONE_OPTIONS,
  });
  if (timeBlock) {
    renderedBlocks.push(<div key="time-filter-block">{timeBlock}</div>);
  }

  const sectionBlocks = renderSchemaSections({
    schema,
    filterState,
    setFilterState,
    tagFilterDrafts,
    setTagFilterDrafts,
    priceRangeFilterDrafts,
    setPriceRangeFilterDrafts,
  });
  if (sectionBlocks.length) renderedBlocks.push(...sectionBlocks);

  return renderedBlocks;
}

function renderSchemaSections({
  schema,
  filterState,
  setFilterState,
  tagFilterDrafts,
  setTagFilterDrafts,
  priceRangeFilterDrafts,
  setPriceRangeFilterDrafts,
}) {
  if (!schema?.sections) return [];

  return schema.sections
    .filter((schemaSection) =>
      schemaSection.inputs.some((schemaInput) => schemaInput.isFilter === true)
    )
    .map((schemaSection) => {
      if (schemaSection.conditionalSection === "checkboxGate") {
        return renderCheckboxGateFilterSection({
          schemaSection,
          filterState,
          setFilterState,
          tagFilterDrafts,
          setTagFilterDrafts,
          priceRangeFilterDrafts,
          setPriceRangeFilterDrafts,
          renderInputFilter,
        });
      }

      const renderedInputs = schemaSection.inputs
        .filter((schemaInput) => schemaInput.isFilter === true)
        .map((schemaInput) =>
          renderInputFilter({
            schemaInput,
            filterValue: filterState[schemaInput.id],
            setFilterValue: (newValue) =>
              setFilterState((prev) => ({
                ...prev,
                [schemaInput.id]: newValue,
              })),
            tagFilterDrafts,
            setTagFilterDrafts,
            priceRangeFilterDrafts,
            setPriceRangeFilterDrafts,
          })
        )
        .filter(Boolean);

      if (!renderedInputs.length) return null;

      return (
        <div
          key={schemaSection.id}
          className="section"
          role="region"
          aria-labelledby={`section-title-${schemaSection.id}`}
        >
          <h3 id={`section-title-${schemaSection.id}`}>{schemaSection.name}</h3>
          {renderedInputs}
        </div>
      );
    })
    .filter(Boolean);
}

export function renderInputFilter({
  schemaInput,
  filterValue,
  setFilterValue,
  tagFilterDrafts,
  setTagFilterDrafts,
  priceRangeFilterDrafts,
  setPriceRangeFilterDrafts,
}) {
  switch (schemaInput.type) {
    case "text":
      return renderTextFilter(schemaInput, filterValue, setFilterValue);

    case "number":
      return renderNumberFilter(schemaInput, filterValue, setFilterValue);

    case "percentage":
      return renderPercentageFilter(schemaInput, filterValue, setFilterValue);

    case "capacity":
      return renderCapacityFilter(schemaInput, filterValue, setFilterValue);

    case "checkbox":
      return renderCheckboxFilter(schemaInput, filterValue, setFilterValue);

    case "dropdown":
      return renderDropdownFilter(schemaInput, filterValue, setFilterValue);

    case "hours":
      return renderHoursFilter(schemaInput, filterValue, setFilterValue);

    case "ageRange":
      return renderAgeRangeFilter(schemaInput, filterValue, setFilterValue);

    case "priceRangeArray":
      return renderPriceRangeArrayFilter(
        schemaInput,
        filterValue,
        setFilterValue,
        priceRangeFilterDrafts,
        setPriceRangeFilterDrafts
      );

    case "tagList":
      return renderTagListFilter(
        schemaInput,
        filterValue,
        setFilterValue,
        tagFilterDrafts,
        setTagFilterDrafts
      );

    default:
      return null;
  }
}