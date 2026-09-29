export const TEXT_LIMITS = {
  maxLength: {
    min: 1,
    max: 500,
    default: 150,
  },
};

export const NOTES_LIMITS = {
  maxLength: {
    min: 1,
    max: 5000,
    default: 1000,
  },
};

export const WEBSITE_LIMITS = {
  maxLength: {
    min: 20,
    max: 500,
    default: 150,
  },
};

export const PHONE_NUMBER_LIMITS = {
  maxLength: {
    min: 20,
    max: 50,
    default: 25,
  },
};

export const EMAIL_LIMITS = {
  maxLength: {
    min: 20,
    max: 150,
    default: 150,
  },
};

export const NUMBER_LIMITS = {
  maxLength: {
    min: 1,
    max: 50,
    default: 20,
  },
  minValue: -5000000000,
  maxValue: 5000000000,
  modeOptions: ["Single Value", "Min-Max Range", "Min Only", "Max Only"],
};

export const PERCENTAGE_LIMITS = {
  maxLength: {
    min: 1,
    max: 10,
    default: 3,
  },
  minValue: 0,
  maxValue: 100,
  modeOptions: ["Single Value", "Min-Max Range", "Min Only", "Max Only"],
};

export const DROPDOWN_LIMITS = {
  maxOptions: {
    min: 1,
    max: 50,
    default: 1,
  },
  optionMaxLength: {
    min: 1,
    max: 100,
    default: 32,
  },
};

export const CAPACITY_LIMITS = {
  maxLength: {
    min: 1,
    max: 20,
    default: 9,
  },
  minValue: 0,
  maxValue: 999999999,
  modeOptions: ["Single Value", "Min-Max Range"],
};

export const AGE_RANGE_LIMITS = {
  maxLength: {
    min: 1,
    max: 3,
    default: 3,
  },
  minValue: 0,
  maxValue: 150,
  modeOptions: ["All Ages", "Min-Max Range", "Min Only", "Max Only"],
};

export const PRICE_RANGE_ARRAY_LIMITS = {
  maxLength: {
    min: 1,
    max: 50,
    default: 30,
  },
  minValue: "0.00",
  maxValue: "100000.00",
  maxTotalPriceItems: {
    min: 1,
    max: 1000,
    default: 1000,
  },
  maxCategories: {
    min: 1,
    max: 100,
    default: 20,
  },
  maxUnitsPerCategory: {
    min: 1,
    max: 20,
    default: 10,
  },
  maxItemsPerCategory: {
    min: 1,
    max: 100,
    default: 50,
  },
  modeOptions: ["Free", "Fixed Price", "Min-Max Range", "Min Only", "Max Only"],
};

export const TAG_LIST_LIMITS = {
  maxLength: {
    min: 1,
    max: 500,
    default: 150,
  },
  maxItems: {
    min: 1,
    max: 1000,
    default: 1000,
  },
};

export const HOURS_LIMITS = {
  maxRangesPerDay: 5,
};

export const GEOMETRY_LIMITS = {
  typeOptions: [
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
  ],
  maxCoordinatesPerGeometry: 100000,
  coordinateMaxLength: 20,
  latitudeMin: -85,
  latitudeMax: 85,
  longitudeMin: -180,
  longitudeMax: 180,
};

export const TIME_LIMITS = {
  typeOptions: ["None", "Event", "Motion"],
  /*
   * "None" was removed deliberately. An Event data item exists at a
   * time - that is what makes it an event - so a mode meaning "this
   * event has no date" contradicted the type. Places and neighbourhoods
   * express "no time at all" through time.type === "None" instead,
   * which is still valid and is a project-level fact rather than a
   * per-item one.
   */
  eventModeOptions: ["Range", "Instant", "Ongoing"],
  maxDates: 100,
  defaultDurationMinutes: {
    min: 0,
    max: 525960,
    step: 5,
    default: 60,
  },
};

export const SECTION_LIMITS = {
  maxInputs: 30,
};

export const PROJECT_LIMITS = {
  maxSections: 20,
  projectNameMaxLength: 30,
  projectDescriptionMaxLength: 240,
  maxDataItems: 100000,
  maxProjectTags: 20,
  projectTagMaxLength: 30,
};

export const SUBSCRIPTION_LIMITS = {
  maxProjectsByTier: {
    free: 3,
    paid: 50,
  },
};

export const EXTENSION_LIMITS = {
  Gallery: {
    maxImages: {
      min: 0,
      max: 99,
      default: 10,
    },
  },

  Guestbook: {
    perDataItemToggleDefault: true,
  },

  Bulletin: {
    maxMessages: {
      min: 0,
      max: 100,
      default: 20,
    },
    messageLength: {
      min: 0,
      max: 5000,
      default: 1000,
    },
  },

  Chat: {
    maxMessages: {
      min: 0,
      max: 100,
      default: 20,
    },
    messageLength: {
      min: 0,
      max: 1000,
      default: 1000,
    },
  },
};

export const LAYER_LIMITS = {
  maxLayers: 2,
};

/*
 * How a boundary spatially clips the data a layer or an aggregate is
 * built from. Declared up here (above both LAYER_TOOL_LIMITS and
 * AGGREGATE_TOOL_LIMITS) because both reference it - boundaries belong
 * to neither feature, which is also why their code lives in
 * src/boundaries/ rather than under either one.
 *
 *  - "Centroid Inside": the item's own centre point falls inside the
 *    boundary. Every geometry type except Point already stores a
 *    `centroid` (a Point's own coordinate serves the same role), so
 *    this needs no extra math, and each item lands in exactly one
 *    boundary - nothing is double-counted across adjacent shapes.
 *  - "Fully Inside": every vertex falls inside. Strictest; an item
 *    crossing the edge is excluded outright.
 *  - "Any Overlap": any part falls inside. Most inclusive; an item
 *    straddling two boundaries is counted by both.
 *
 * See src/boundaries/utils/clipToBoundary.js for the actual geometry.
 */
export const BOUNDARY_FILTER_TYPE_OPTIONS = [
  "Centroid Inside",
  "Fully Inside",
  "Any Overlap",
];

export const DEFAULT_BOUNDARY_FILTER_TYPE = "Centroid Inside";

/*
 * Which KIND of spatial constraint the geometry filter applies. The two
 * are alternatives, not a stack - they do the same job, so offering both
 * at once only invited contradictory filters (Brody's own call):
 *
 *  - "Bounding Box": the min/max lat/lng box, the original behaviour.
 *  - "Selected Boundary": one of the project's saved boundaries.
 *
 * null means nothing has been chosen, which is what makes the geometry
 * filter inactive. Choosing a mode does NOT on its own make it active -
 * it only says how activity is determined: a Bounding Box with no bounds
 * set, or a Selected Boundary with no boundary picked, is still inactive.
 *
 * BOUNDARY_FILTER_TYPE_OPTIONS above applies to EITHER mode - a bounding
 * box is just a rectangular boundary, so "Centroid Inside"/"Fully
 * Inside"/"Any Overlap" mean the same thing against it.
 */
export const BOUNDARY_MODE_OPTIONS = ["Bounding Box", "Selected Boundary"];

export const BOUNDARY_MODE_BBOX = "Bounding Box";
export const BOUNDARY_MODE_BOUNDARY = "Selected Boundary";

/*
 * For the Layers tool (src/layers/, server/routes/layers.js) - saved
 * groupings of a project's own data items into a colored, togglable
 * layer. Deliberately named LAYER_TOOL_LIMITS, not LAYER_LIMITS above -
 * that name is already taken by the unrelated layer-1/layer-2
 * parent/child data-item concept (src/forms/injectLayer.js).
 */
/*
 * A layer used to color/classify each geometry-type group (point/line/
 * polygon) independently, with per-group patch/corridor classification.
 * Brody's own later call reversed this: it was confusing (a single
 * layer could mix patches and corridors depending on which geometry
 * type you were looking at, when the real-world intent is almost
 * always "this whole layer represents one kind of thing"), and doing
 * classification/color per-layer instead reads far more simply - a
 * layer IS a patch layer or a corridor layer, with one fillColor/
 * borderColor applied uniformly (borderColor doubles as the line color
 * for LineString/MultiLineString - see LayersGeometryLayer.jsx's own
 * comment). classification is set once, by which Add tool built the
 * layer (Add Patch Layer vs. Add Corridor Layer -
 * LayersToolMenu.jsx), and never editable afterward - a corridor
 * layer's own Add workflow additionally excludes Point/MultiPoint data
 * from its live membership (getLayerMatchingData in
 * computeLayerMembers.js), since a single point has no extent to read
 * as a corridor; a layer's membership is a live re-filter of the
 * current dataset, not a frozen list, so this can't be enforced by
 * validating stored data - it's enforced every time membership is
 * recomputed instead.
 */
export const LAYER_TOOL_LIMITS = {
  nameMaxLength: 60,
  descriptionMaxLength: 500,
  // A layer's filterState is a schema-shaped filter object, not a
  // stored id list - see layerValidation.js's own isValidFilterState.
  maxFilterStateBytes: 50000,
  classificationOptions: ["Patch", "Corridor"],
  defaultOpacity: 1,
  defaultColors: { fillColor: "#3b82f6", borderColor: "#2563eb" },
  /*
   * A layer may optionally be clipped to a boundary, exactly the way an
   * aggregate is (same options, same clipToBoundary.js implementation).
   * Unlike an aggregate's, a layer's boundary is optional - boundaryId
   * null means "the whole dataset" - since most layers don't need one
   * and the Layers page predates boundaries entirely.
   */
  boundaryFilterTypeOptions: BOUNDARY_FILTER_TYPE_OPTIONS,
  defaultBoundaryFilterType: DEFAULT_BOUNDARY_FILTER_TYPE,
};

/*
 * For the Aggregates tool (src/aggregates/, server/routes/aggregates.js
 * + aggregateBoundaries.js) - an "aggregate" is a saved analysis (a
 * count/sum/average over some of a project's own schema fields, re-run
 * live against the current dataset every time it's loaded, same
 * dynamic-filterState idea as the Layers tool) displayed using a
 * reusable "boundary" polygon/multipolygon as its shape. Boundaries
 * live in their own collection specifically so a boundary is never
 * itself one of the data items an aggregate could count (Brody's own
 * call, made after noticing that picking a boundary *from* the
 * project's own data would require excluding it from its own
 * aggregate's results) - several aggregates can reuse the same
 * boundary, and editing a boundary's geometry changes every aggregate
 * built on it. A boundary's own fillColor/borderColor are purely a
 * map-display convenience - so a handful of boundaries look different
 * from each other on the Boundaries tab's own map view - and are
 * unrelated to an aggregate's own fillColor/borderColor: the same
 * boundary might back several different-colored aggregates at once,
 * and an aggregate's own shape on the map always uses its own color,
 * never its boundary's.
 */
export const BOUNDARY_TOOL_LIMITS = {
  nameMaxLength: 60,
};

/*
 * Only these 4 input types can be aggregated, each with its own
 * allowed operations - checkbox/dropdown/tagList only ever support a
 * count (of however many selected, non-excluded data items have that
 * value set), never sum/average; number supports sum or average, never
 * a count. See src/aggregates/utils/computeAggregateResult.js for how
 * each operation actually reads a stored input value.
 */
export const AGGREGATE_FIELD_OPERATIONS_BY_TYPE = {
  checkbox: ["Count"],
  dropdown: ["Count"],
  tagList: ["Count"],
  number: ["Sum", "Average"],
};

/*
 * An aggregate's boundary is required and picked in its Add workflow's
 * own boundary step, then stays editable afterward - unlike the
 * boundary/filterState/fields themselves, which are create-time only.
 * Only one clip rule can apply at a time, hence a dropdown rather than
 * the Geometry Types filter's own checkboxes.
 *
 * Kept as a named alias so existing aggregate-side imports keep
 * working; the list itself is BOUNDARY_FILTER_TYPE_OPTIONS above, shared
 * with the Layers tool.
 */
export const AGGREGATE_BOUNDARY_FILTER_TYPE_OPTIONS =
  BOUNDARY_FILTER_TYPE_OPTIONS;

export const AGGREGATE_TOOL_LIMITS = {
  nameMaxLength: 60,
  descriptionMaxLength: 500,
  maxFilterStateBytes: 50000,
  maxFields: 100,
  defaultOpacity: 1,
  defaultColors: { fillColor: "#3b82f6", borderColor: "#2563eb" },
  allowedFieldTypes: Object.keys(AGGREGATE_FIELD_OPERATIONS_BY_TYPE),
  boundaryFilterTypeOptions: BOUNDARY_FILTER_TYPE_OPTIONS,
  defaultBoundaryFilterType: DEFAULT_BOUNDARY_FILTER_TYPE,
};

export const GUESTBOOK_LIMITS = {
  nameMaxLength: 24,
  commentMaxLength: 58,
  maxToggleEntryIds: 100,
};

export const BULLETIN_LIMITS = {
  titleMaxLength: 200,
};

export const SYSTEM_KEY_LIMITS = {
  maxLength: 50,
};

export const INPUT_KEY_LIMITS = {
  maxLength: 50,
};
