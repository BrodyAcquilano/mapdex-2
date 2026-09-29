import { useState, useEffect } from "react";
import "../styles/panels.css";
import { renderAddEditFormPage } from "./renderAddEditFormPage.jsx";

function PresenceEditPanel({
  setData,
  draftUser,
  setDraftUser,
  schema,
  setSchema,
  blankFormTemplate,
  forms,
  dataUtils,
  system,
  apis,
  trackLocation,
}) {
  if (!forms || !schema || !dataUtils || !apis) {
    return null;
  }

  const [committedDataItem, setCommittedDataItem] = useState(null);
  const [formData, setFormData] = useState(null);
  const [tagInputDrafts, setTagInputDrafts] = useState({});
  const [priceRangeDrafts, setPriceRangeDrafts] = useState({});
  const [skipInitialization, setSkipInitialization] = useState(false);

  const canEditDraftUser = draftUser?.userRole === "editor";

  useEffect(() => {
    if (!draftUser || !schema || !blankFormTemplate || !forms) {
      setCommittedDataItem(null);
      setFormData(null);
      setTagInputDrafts({});
      setPriceRangeDrafts({});
      return;
    }

    if (!canEditDraftUser) {
      setCommittedDataItem(null);
      setFormData(null);
      setTagInputDrafts({});
      setPriceRangeDrafts({});
      return;
    }

    if (skipInitialization) {
      setSkipInitialization(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const { formData } = forms.populateBlankForm({
        schema,
        blankFormTemplate,
        normalizedDataItem: draftUser,
      });

      if (!cancelled) {
        setCommittedDataItem(structuredClone(formData));
        setFormData(formData);
        setTagInputDrafts({});
        setPriceRangeDrafts({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    draftUser?._id,
    draftUser?.updatedAt,
    draftUser?.userRole,
    schema?._id,
    schema?.configUpdatedAt,
    blankFormTemplate,
    forms,
    canEditDraftUser,
  ]);

  if (!trackLocation) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Presence Edit Panel"
        aria-describedby="presence-edit-panel-description"
      >
        <div className="section">
          <h2 id="presence-edit-panel-heading">Edit Panel</h2>
        </div>

        <p
          id="presence-edit-panel-description"
          className="edit-panel-description"
        >
          Track location must be active to edit your presence details.
        </p>
      </div>
    );
  }

  if (!draftUser) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Presence Edit Panel"
        aria-describedby="presence-edit-panel-description"
      >
        <div className="section">
          <h2 id="presence-edit-panel-heading">Edit Panel</h2>
        </div>

        <p
          id="presence-edit-panel-description"
          className="edit-panel-description"
        >
          No active presence record found for your account.
        </p>
      </div>
    );
  }

  if (!canEditDraftUser) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Presence Edit Panel"
        aria-describedby="presence-edit-panel-description"
      >
        <div className="section">
          <h2 id="presence-edit-panel-heading">Edit Panel</h2>
        </div>

        <p
          id="presence-edit-panel-description"
          className="edit-panel-description"
        >
          You can only edit your own active presence record.
        </p>
      </div>
    );
  }

  if (!formData) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Presence Edit Panel"
        aria-describedby="presence-edit-panel-description"
      >
        <div className="section">
          <h2 id="presence-edit-panel-heading">Edit Panel</h2>
        </div>

        <p
          id="presence-edit-panel-description"
          className="edit-panel-description"
        >
          Loading your active presence record...
        </p>
      </div>
    );
  }

  return (
    <div
      className="panel"
      role="region"
      aria-label="Presence Edit Panel"
      aria-describedby="presence-edit-panel-description"
    >
      <div className="section">
        <h2 id="presence-edit-panel-heading">Edit Panel</h2>
      </div>

      <p id="presence-edit-panel-description" className="visually-hidden">
        Edit your active presence details.
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
        addEditComponent: "editPanel",
        onClose: null,
        blankFormTemplate,
        previousCenterRef: null,
        setDraftGeometry: null,
        schema,
        setSchema,
        committedDataItem,
        setCommittedDataItem,
        selectedDataItem: draftUser,
        setSelectedDataItem: setDraftUser,
        setData,
        onOpenExtension: null,
        setSkipInitialization,
        setIsMiniGalleryOpen: null,
        dataUtils,
        system,
        apis,
      })}
    </div>
  );
}

export default PresenceEditPanel;