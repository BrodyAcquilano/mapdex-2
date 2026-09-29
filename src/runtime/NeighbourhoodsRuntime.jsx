import { useTrackLocationToggle } from "../workspace/TrackLocationButton/hooks/useTrackLocationToggle.js";
import { useState, useMemo, useEffect } from "react";

// Api
import { neighbourhoodsApi } from "../api/neighbourhoodsApi";
import { projectChatApi } from "../api/projectChatApi";
import { bulletinApi } from "../api/bulletinApi";

// Data

// Analysis
import { accessByPerCapitaAssets } from "../analysis/neighbourhood/accessByPerCapitaAssets.js";
import { accessByPopulationDensity } from "../analysis/neighbourhood/accessByPopulationDensity.js";
import { accessByPopulationAndArea } from "../analysis/neighbourhood/accessByPopulationAndArea.js";
import { accessByPerCapitaSpillover } from "../analysis/neighbourhood/accessByPerCapitaSpillover.js";
import { accessByThresholdedDemand } from "../analysis/neighbourhood/accessByThresholdedDemand.js";
import { accessByThresholdedSpillover } from "../analysis/neighbourhood/accessByThresholdedSpillover.js";
import { cumulativeResourceInfluence } from "../analysis/neighbourhood/cumulativeResourceInfluence.js";
import { accessByArea } from "../analysis/neighbourhood/accessByArea.js";
import { resourceDistributionMapping } from "../analysis/neighbourhood/resourceDistributionMapping.js";
import { proximityInfluence } from "../analysis/neighbourhood/proximityInfluence.js";
import { resourceCountBaseline } from "../analysis/neighbourhood/resourceCountBaseline.js";
import { areaDistribution } from "../analysis/neighbourhood/areaDistribution.js";
import { populationDistribution } from "../analysis/neighbourhood/populationDistribution.js";
import { populationDensityDistribution } from "../analysis/neighbourhood/populationDensityDistribution.js";

export function useNeighbourhoodsRuntime({
  schema,
  filteredData,
  trackLocation,
  setTrackLocation,
}) {
  const [showFilter, setShowFilter] = useState(false);

  const hasBottomUI = false;
  const [isMiniGalleryOpen, setIsMiniGalleryOpen] = useState(false);

  const [analysisInputs, setAnalysisInputs] = useState(() =>
    Array.from({ length: 6 }, (_, index) => ({
      id: `analysis-input-${index}`,
      label: `Input ${index + 1}`,
      selected: true,
    })),
  );

  const [analysisAlgorithm, setAnalysisAlgorithm] = useState(
    "accessByThresholdedSpillover",
  );

  useEffect(() => {
    const schemaInputs = schema?.sections?.[2]?.inputs;
    if (!Array.isArray(schemaInputs) || schemaInputs.length < 6) return;

    setAnalysisInputs((prev) =>
      Array.from({ length: 6 }, (_, index) => ({
        id:
          schemaInputs?.[index]?.id ||
          prev?.[index]?.id ||
          `analysis-input-${index}`,
        label:
          schemaInputs?.[index]?.label ||
          prev?.[index]?.label ||
          `Input ${index + 1}`,
        selected: prev?.[index]?.selected ?? true,
      })),
    );
  }, [schema]);

  const apis = useMemo(
    () => ({
      engineApi: neighbourhoodsApi,
      extensionsApi: {
        projectChat: projectChatApi,
        bulletin: bulletinApi,
      },
    }),
    [],
  );

  const ANALYSIS_COLORS = {
    most: {
      borderColor: "#166534",
      fillColor: "#22c55e",
    },
    average: {
      borderColor: "#92810e",
      fillColor: "#f59e0b",
    },
    least: {
      borderColor: "#991b1b",
      fillColor: "#ef4444",
    },
    fallback: {
      borderColor: "#4b5563",
      fillColor: "#6f747e",
    },
  };

  const ALGORITHM_OPTIONS = [
    {
      value: "accessByThresholdedSpillover",
      label: "Access by Thresholded Spillover",
      category: "accessWithCapacity",
      note: "Shows access using resource counts, population pressure, and nearby neighbourhood support. Each resource type is treated as having an average threshold, so access does not fall much at first, but drops once demand grows past what that type of service can usually absorb. Nearby neighbourhoods can still add support, with closer neighbours contributing more. Compare this with Thresholded Demand for the local pattern, and with Cumulative Resource Influence or Proximity Influence to better understand the nearby-neighbour effect.",
    },
    {
      value: "accessByThresholdedDemand",
      label: "Access by Thresholded Demand",
      category: "accessWithCapacity",
      note: "Shows local access using resource counts and population pressure, but with a threshold for each resource type. The idea is that services can handle demand up to a certain point before access starts to drop. This is a local model, so it does not include support from nearby neighbourhoods. Compare it with Thresholded Spillover to see how much nearby neighbourhoods change the picture.",
    },

    {
      value: "accessByPerCapitaSpillover",
      label: "Access by Per Capita Spillover",
      category: "access",
      note: "Shows access using local resource counts compared to population, while also letting nearby neighbourhoods add value at a reduced rate. Population is the competition barrier here, and distance between neighbourhoods controls how much nearby support matters. Compare it with Per Capita Assets to see the local pattern on its own, and with Cumulative Resource Influence or Proximity Influence to better understand the spillover pattern.",
    },
    {
      value: "accessByPopulationAndArea",
      label: "Access by Population and Area",
      category: "access",
      note: "Shows access using resource counts, population as a competition barrier, and neighbourhood size as a travel-distance barrier. The idea is that more people create more competition, and larger neighbourhoods make average trips to resources longer. Compare it with Population Distribution and Area Distribution to see those two pressures separately, and with Access by Area to isolate the travel-distance side.",
    },
    {
      value: "accessByPopulationDensity",
      label: "Access by Population Density",
      category: "access",
      note: "Shows access using resource counts and population density as the main barrier. This is useful when you want to think about crowding, interference, or discomfort in denser places rather than just total population. Compare it with Population Density Distribution to see where density is highest on its own, and with Per Capita Assets to compare density pressure against plain population pressure.",
    },
    {
      value: "accessByPerCapitaAssets",
      label: "Access by Per Capita Assets",
      category: "access",
      note: "Shows access using local resource counts compared to population. More resources improve access, while more people competing for the same resources reduce it. This is the simplest population-based access model and works well as a baseline for the other access models. Compare it with Population Distribution to see the population pattern on its own, and with Per Capita Spillover to see what changes when nearby neighbourhoods are allowed to help.",
    },
    {
      value: "accessByArea",
      label: "Access by Area",
      category: "access",
      note: "Shows access using local resource counts and average travel distance inside the neighbourhood. Larger neighbourhoods are treated as harder to move across, so this model focuses on local size and spread rather than population competition. Compare it with Area Distribution to see where neighbourhoods are physically larger, and with Population and Area to see what changes when population pressure is added back in.",
    },
    {
      value: "cumulativeResourceInfluence",
      label: "Cumulative Resource Influence",
      category: "access",
      note: "Shows how much a neighbourhood is strengthened by the resource counts in the neighbourhoods around it. Nearby neighbourhoods add more value than distant ones, so this is useful for seeing where clusters of strong neighbouring areas build up a larger combined effect. Compare it with Resource Count Baseline to see the local counts on their own, and with Proximity Influence to see the distance pattern without full counts.",
    },

    {
      value: "resourceDistributionMapping",
      label: "Resource Distribution Mapping",
      category: "distribution",
      note: "Shows where resources are more concentrated or more isolated by looking at a neighbourhood’s counts and the counts in the neighbourhoods around it. This is not showing access for residents. It is showing where stronger and weaker resource clusters exist across the map. Compare it with Resource Count Baseline to see local counts on their own, and with Proximity Influence to see the neighbour-distance pattern in a simpler way.",
    },
    {
      value: "proximityInfluence",
      label: "Proximity Influence",
      category: "distribution",
      note: "Shows how close a neighbourhood is, on average, to other neighbourhoods that have a given type of resource. A neighbourhood scores higher when more of its neighbours have that resource and when those neighbours are closer. This is a simpler neighbour-distance map, not a full access model. Compare it with Resource Distribution Mapping for the count-based version, and with Cumulative Resource Influence for the additive access-style version.",
    },
    {
      value: "resourceCountBaseline",
      label: "Resource Count Baseline",
      category: "distribution",
      note: "Shows the raw resource counts inside each neighbourhood. This is the simplest map of local resource presence and works well as a baseline for comparing the more complex access and neighbour-based models.",
    },
    {
      value: "areaDistribution",
      label: "Area Distribution",
      category: "distribution",
      note: "Shows the land area of each neighbourhood. This is useful for understanding which neighbourhoods are physically larger and therefore more likely to have longer local travel distances.",
    },
    {
      value: "populationDistribution",
      label: "Population Distribution",
      category: "distribution",
      note: "Shows the population of each neighbourhood. This is useful for understanding where competition pressure is likely to be higher before looking at the access models.",
    },
    {
      value: "populationDensityDistribution",
      label: "Population Density Distribution",
      category: "distribution",
      note: "Shows the population density of each neighbourhood. This is useful for understanding where crowding, interference, or tightly packed living conditions are strongest before looking at the density-based access model.",
    },
  ];

  const analysis = useMemo(
    () => ({
      accessByPerCapitaAssets,
      accessByPopulationDensity,
      accessByPopulationAndArea,
      accessByPerCapitaSpillover,
      accessByThresholdedDemand,
      accessByThresholdedSpillover,
      cumulativeResourceInfluence,
      accessByArea,
      resourceDistributionMapping,
      proximityInfluence,
      resourceCountBaseline,
      areaDistribution,
      populationDistribution,
      populationDensityDistribution,
    }),
    [],
  );

  const analysisResult = useMemo(() => {
    if (!schema) return null;

    switch (analysisAlgorithm) {
      case "accessByThresholdedSpillover":
        if (typeof accessByThresholdedSpillover !== "function") return null;

        return accessByThresholdedSpillover(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
          schema,
        );

      case "accessByPerCapitaSpillover":
        if (typeof accessByPerCapitaSpillover !== "function") return null;

        return accessByPerCapitaSpillover(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "accessByPopulationAndArea":
        if (typeof accessByPopulationAndArea !== "function") return null;

        return accessByPopulationAndArea(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "accessByThresholdedDemand":
        if (typeof accessByThresholdedDemand !== "function") return null;

        return accessByThresholdedDemand(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
          schema,
        );

      case "accessByPopulationDensity":
        if (typeof accessByPopulationDensity !== "function") return null;

        return accessByPopulationDensity(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "accessByPerCapitaAssets":
        if (typeof accessByPerCapitaAssets !== "function") return null;

        return accessByPerCapitaAssets(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "cumulativeResourceInfluence":
        if (typeof cumulativeResourceInfluence !== "function") return null;

        return cumulativeResourceInfluence(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "accessByArea":
        if (typeof accessByArea !== "function") return null;

        return accessByArea(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "resourceDistributionMapping":
        if (typeof resourceDistributionMapping !== "function") return null;

        return resourceDistributionMapping(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "proximityInfluence":
        if (typeof proximityInfluence !== "function") return null;

        return proximityInfluence(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "resourceCountBaseline":
        if (typeof resourceCountBaseline !== "function") return null;

        return resourceCountBaseline(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "areaDistribution":
        if (typeof areaDistribution !== "function") return null;

        return areaDistribution(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "populationDistribution":
        if (typeof populationDistribution !== "function") return null;

        return populationDistribution(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      case "populationDensityDistribution":
        if (typeof populationDensityDistribution !== "function") return null;

        return populationDensityDistribution(
          filteredData || [],
          ANALYSIS_COLORS,
          analysisInputs,
        );

      default:
        return null;
    }
  }, [
    schema?._id,
    schema?.configUpdatedAt,
    filteredData,
    analysisInputs,
    analysisAlgorithm,
  ]);

  const handleTrackLocationToggle = useTrackLocationToggle({
    trackLocation,
    setTrackLocation,
  });

  return {
    showFilter,
    setShowFilter,
    isMiniGalleryOpen,
    setIsMiniGalleryOpen,
    apis,
    analysis,
    analysisResult,
    ANALYSIS_COLORS,
    ALGORITHM_OPTIONS,
    analysisAlgorithm,
    setAnalysisAlgorithm,
    hasBottomUI,
    analysisInputs,
    setAnalysisInputs,
    handleTrackLocationToggle,
  };
}
