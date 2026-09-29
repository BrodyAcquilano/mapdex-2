import { LocationSection } from "./Location.js";
import { ContactSection } from "./Contact.js";
import { TimeAccessSection } from "./TimeAccess.js";
import { FinancialAccessSection } from "./FinancialAccess.js";
import { CapacitySection } from "./Capacity.js";
import { ParkingSection } from "./Parking.js";
import { AgesSection } from "./Ages.js";
import { AccessibilityFeaturesSection } from "./AccessibilityFeatures.js";
import { PhysicalBarriersSection } from "./PhysicalBarriers.js";
import { NotesSection } from "./Notes.js";

const SECTION_LIBRARY = {
  location: LocationSection,
  contact: ContactSection,
  timeAccess: TimeAccessSection,
  financialAccess: FinancialAccessSection,
  capacity: CapacitySection,
  parking: ParkingSection,
  ages: AgesSection,
  accessibilityFeatures: AccessibilityFeaturesSection,
  physicalBarriers: PhysicalBarriersSection,
  notes: NotesSection,
};

export function getSectionsLibrary() {
  return Object.values(SECTION_LIBRARY).map((section) => ({
    key: section.key,
    label: section.label,
  }));
}

export function getSectionDefinition(sectionKey) {
  return SECTION_LIBRARY[sectionKey] ?? null;
}