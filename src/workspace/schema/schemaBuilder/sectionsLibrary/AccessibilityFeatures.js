export const AccessibilityFeaturesSection = {
  key: "accessibilityFeatures",
  label: "Accessibility Features",

  buildSection() {
    return {
      id: Date.now() + 10,
      name: "Accessibility Features",
      systemKey: "accessibilityFeatures",
      inputs: [
        {
          id: Date.now() + 11,
          label: "Accessibility Features",
          type: "tagList",
          isRequired: false,
          isFilter: true,
          isDisplayed: true,
          displayIfEmpty: false,
          emptyDisplayText: "",
          maxLength: 150,
          maxItems: 150,
          allowCustomTags: true,
          customTags: [],
          defaultTags: [
            // General / catch-all
            "Accessible Entrance",
            "Accessible Washroom",
            "Accessible Parking",
            "Barrier-Free Path of Travel",
            "Step-Free Access",

            // Mobility / physical access
            "Ramp",
            "Curb Cut",
            "Wide Doorways",
            "Automatic Doors",
            "Elevator",
            "Accessible Seating",
            "Wheelchair Accessible Tables",
            "Accessible Counter Height",
            "Smooth or Firm Ground Surface",
            "Accessible Route From Parking",
            "Accessible Drop-Off Area",

            // Washroom details
            "Gender Neutral Washroom",
            "Family Washroom",
            "Changing Table",
            "Adult Change Table",
            "Automatic Washroom Door",
            "Accessible Washroom Stalls",
            "Washroom Handrails",
            "Accessible Sink",
            "Automatic Faucet",
            "Low-Height Mirror",
            "Emergency Call Button",

            // Vision access
            "Braille Signage",
            "Tactile Signage",
            "High Contrast Signage",
            "Large Print Materials",
            "Good Lighting",
            "Tactile Ground Surface Indicators",
            "Audio Description Available",

            // Hearing access
            "Assistive Listening System",
            "Hearing Loop",
            "Captioning Available",
            "Live Captions Available",
            "Sign Language Interpretation Available",
            "Visual Alerts",

            // Cognitive / sensory access
            "Quiet Area",
            "Low Sensory Space",
            "Low Lighting Option",
            "Reduced Noise Area",
            "Clear Wayfinding",
            "Simple Signage",
            "Sensory-Friendly Hours",
            "Crowd-Free Hours",

            // Service / policy / support
            "Service Animals Welcome",
            "Support Person Welcome",
            "Staff Assistance Available",
            "Accessibility Information Available Online",
            "Accessible Booking Process",
            "Accessible Public Transit Nearby",

            // Language access / communication
            "Multilingual Staff",
            "Translation Support Available",
            "Interpretation Available",
            "Phone Interpretation Available",
            "Video Interpretation Available",
            "ASL Interpretation Available",
            "LSQ Interpretation Available",
            "Plain Language Information",
            "Multilingual Signage",
            "Multilingual Materials",
            "Language Access Information Available Online",
          ],
        },
      ],
    };
  },

  schemaRules: {
    lockedSectionFields: ["systemKey"],
    lockedInputs: [
      {
        inputIndex: 0,
        lockedFields: ["type"],
      },
    ],
  },
};
