// server/engines/defaultSchemas.js
// Lookup of each engine's default schema, used when creating a new project.
// The client no longer needs these — project creation only sends
// { engineKey, projectName, projectDescription, projectTags, visibility,
// visibility }, and the rest of the schema is injected here.

import { defaultPlaceSchema } from "./places/schema.js";
import { defaultEventSchema } from "./events/schema.js";
import { defaultMotionSchema } from "./motion/schema.js";
import { defaultNeighbourhoodSchema } from "./neighbourhoods/schema.js";
import { defaultPresenceSchema } from "./presence/schema.js";

export const DEFAULT_SCHEMAS_BY_ENGINE = {
  places: defaultPlaceSchema,
  events: defaultEventSchema,
  motion: defaultMotionSchema,
  neighbourhoods: defaultNeighbourhoodSchema,
  presence: defaultPresenceSchema,
};
