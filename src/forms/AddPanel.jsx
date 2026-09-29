// src/forms/AddPanel.jsx

import { useEffect, useRef, useState } from "react";

import "../styles/panels.css";

import { renderAddEditFormPage } from "./renderAddEditFormPage.jsx";

function AddPanel({
  isOpen,
  onClose,
  draftGeometry,
  setDraftGeometry,
  setData,
  setSelectedDataItem,
  schema,
  setSchema,
  blankFormTemplate,
  forms,
  dataUtils,
  system,
  apis,
  activeLayer,
  activeParentDataItemId,
}) {
  const [formData, setFormData] = useState(null);
  const [tagInputDrafts, setTagInputDrafts] = useState({});
  const [priceRangeDrafts, setPriceRangeDrafts] = useState({});

  const initializedOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (
      !isOpen ||
      initializedOpenRef.current ||
      !blankFormTemplate ||
      !schema ||
      !forms ||
      !draftGeometry
    ) {
      return;
    }

    const form = structuredClone(blankFormTemplate);

    forms.injectLayer?.(
      form,
      activeLayer || 1,
      activeParentDataItemId || null,
    );

    forms.injectDraftGeometry?.(
      form,
      draftGeometry,
    );

    forms.injectCurrentDateTime?.(
      form,
      schema,
    );

    forms.reapplyTimezoneFromLatLng?.(
      form,
    );

    forms.injectRequiredDefaults?.(
      form,
      schema,
    );

    initializedOpenRef.current = true;

    setFormData(form);
    setTagInputDrafts({});
    setPriceRangeDrafts({});
  }, [
    isOpen,
    schema?._id,
    schema?.configUpdatedAt,
    blankFormTemplate,
    forms,
    draftGeometry,
    activeLayer,
    activeParentDataItemId,
  ]);

  if (!isOpen || !schema || !formData?.sections) {
    return null;
  }

  return (
    <div
      className="panel add-panel"
      role="region"
      aria-label="Add Panel"
      aria-describedby="add-panel-description"
    >
      <button
        type="button"
        className="panel-close-button"
        onClick={onClose}
        aria-label="Close Add Panel"
        title="Close"
      >
        ×
      </button>

      <div className="section">
        <h2 id="add-panel-heading">Add Panel</h2>
      </div>

      <p id="add-panel-description" className="visually-hidden">
        Add details for the new data item.
      </p>

      {renderAddEditFormPage({
        formData,
        setFormData,
        tagInputDrafts,
        setTagInputDrafts,
        priceRangeDrafts,
        setPriceRangeDrafts,
        forms,
        onLatLngFinalized: null,
        addEditComponent: "addPanel",
        onClose,
        blankFormTemplate,
        previousCenterRef: null,
        setDraftGeometry,
        schema,
        setSchema,
        committedDataItem: null,
        setCommittedDataItem: null,
        selectedDataItem: null,
        setSelectedDataItem,
        setData,
        onOpenExtension: null,
        setSkipInitialization: null,
        setIsMiniGalleryOpen: null,
        dataUtils,
        system,
        apis,
      })}
    </div>
  );
}

export default AddPanel;