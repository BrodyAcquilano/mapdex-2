import { useState, useEffect, useRef } from "react";
import "../styles/panels.css";
import { renderAddEditFormPage } from "./renderAddEditFormPage.jsx";

function EditPanel({
  setData,
  selectedDataItem,
  setSelectedDataItem,
  schema,
  setSchema,
  onOpenExtension,
  setIsMiniGalleryOpen,
  blankFormTemplate,
  forms,
  dataUtils,
  system,
  map,
  apis,
  setDraftGeometry,
}) {
  if (!forms || !schema || !dataUtils || !apis) {
    return null;
  }

  const [committedDataItem, setCommittedDataItem] = useState(null);
  const [formData, setFormData] = useState(null);
  const [tagInputDrafts, setTagInputDrafts] = useState({});
  const [priceRangeDrafts, setPriceRangeDrafts] = useState({});
  const [skipInitialization, setSkipInitialization] = useState(false);

  const previousCenterRef = useRef(null);
  const latLngFlyoverTokenRef = useRef(0);

  const canEditSelectedDataItem =
    selectedDataItem?.userRole === "editor";

  const onLatLngFinalized =
    canEditSelectedDataItem &&
    selectedDataItem?.geometry?.type === "Point" &&
    typeof forms.createOnLatLngFinalized === "function"
      ? forms.createOnLatLngFinalized({
          setDraftGeometry,
          selectedDataItem,
          map,
          tokenRef: latLngFlyoverTokenRef,
        })
      : null;

  useEffect(() => {
    /*
     * Invalidates any in-flight flyover timeout from
     * onLatLngFinalized (src/forms/onLatLngFinalized.js) - the
     * selection changing or clearing out from under it means its
     * deferred setDraftGeometry call is stale and must not apply.
     */
    latLngFlyoverTokenRef.current += 1;

    if (!selectedDataItem) {
      if (previousCenterRef.current) {
        const [lat, lng] = previousCenterRef.current;

        map.closePopup();
        map.flyTo(lat, lng);

        previousCenterRef.current = null;
      }

      setCommittedDataItem(null);
      setFormData(null);
      setTagInputDrafts({});
      setPriceRangeDrafts({});
      setDraftGeometry?.(null);

      return;
    }

    if (!canEditSelectedDataItem) {
      setCommittedDataItem(null);
      setFormData(null);
      setTagInputDrafts({});
      setPriceRangeDrafts({});
      setDraftGeometry?.(null);

      return;
    }

    if (skipInitialization) {
      setSkipInitialization(false);
      return;
    }

    if (!schema || !blankFormTemplate || !forms) return;

    setDraftGeometry?.(null);

    const shouldTrackPreviousCenter =
      selectedDataItem?.geometry?.type === "Point" &&
      typeof forms.getCenterCoordinates === "function";

    const pointLatLng = shouldTrackPreviousCenter
      ? forms.getCenterCoordinates(selectedDataItem)
      : null;

    if (pointLatLng) {
      previousCenterRef.current = [
        pointLatLng.lat,
        pointLatLng.lng,
      ];
    } else {
      previousCenterRef.current = null;
    }

    let cancelled = false;

    (async () => {
      const { formData } = forms.populateBlankForm({
        schema,
        blankFormTemplate,
        normalizedDataItem: selectedDataItem,
      });

      if (!cancelled) {
        setCommittedDataItem(
          structuredClone(formData),
        );

        setFormData(formData);

        setDraftGeometry?.(
          formData?.geometry
            ? structuredClone(formData.geometry)
            : null,
        );

        setTagInputDrafts({});
        setPriceRangeDrafts({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedDataItem?._id,
    selectedDataItem?.updatedAt,
    selectedDataItem?.userRole,
    schema?._id,
    schema?.configUpdatedAt,
    blankFormTemplate,
    forms,
    canEditSelectedDataItem,
  ]);

  if (!selectedDataItem) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Edit Panel"
        aria-describedby="edit-panel-description"
      >
        <div className="section">
          <h2 id="edit-panel-heading">
            Edit Panel
          </h2>
        </div>

        <p
          id="edit-panel-description"
          className="edit-panel-description"
        >
          Select a data item to edit details.
        </p>
      </div>
    );
  }

  if (!canEditSelectedDataItem) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Edit Panel"
        aria-describedby="edit-panel-description"
      >
        <div className="section">
          <h2 id="edit-panel-heading">
            Edit Panel
          </h2>
        </div>

        <p
          id="edit-panel-description"
          className="edit-panel-description"
        >
          You can only edit data items that you added or have permission to
          manage.
        </p>
      </div>
    );
  }

  if (!formData) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Edit Panel"
        aria-describedby="edit-panel-description"
      >
        <div className="section">
          <h2 id="edit-panel-heading">
            Edit Panel
          </h2>
        </div>

        <p
          id="edit-panel-description"
          className="edit-panel-description"
        >
          Loading selected data item...
        </p>
      </div>
    );
  }

  return (
    <div
      className="panel"
      role="region"
      aria-label="Edit Panel"
      aria-describedby="edit-panel-description"
    >
      <div className="section">
        <h2 id="edit-panel-heading">
          Edit Panel
        </h2>
      </div>

      <p
        id="edit-panel-description"
        className="visually-hidden"
      >
        Edit details for the selected data item.
      </p>

      {renderAddEditFormPage({
        formData,
        setFormData,
        tagInputDrafts,
        setTagInputDrafts,
        priceRangeDrafts,
        setPriceRangeDrafts,
        forms,
        onLatLngFinalized,
        addEditComponent: "editPanel",
        onClose: null,
        blankFormTemplate,
        previousCenterRef,
        setDraftGeometry,
        schema,
        setSchema,
        committedDataItem,
        setCommittedDataItem,
        selectedDataItem,
        setSelectedDataItem,
        setData,
        onOpenExtension,
        setSkipInitialization,
        setIsMiniGalleryOpen,
        dataUtils,
        system,
        apis,
      })}
    </div>
  );
}

export default EditPanel;