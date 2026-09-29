import { renderSection } from "./sections/renderSection.jsx";
import { renderUserSection } from "./user/renderUser.jsx";
import { renderGeometrySection } from "./geometry/renderGeometry.jsx";
import TimeRenderer from "./time/renderTime.jsx";
import { renderExtensionsSection } from "./extensions/renderExtensions.jsx";

import {
  handleAddSubmit,
  handleEditSubmit,
  handleDelete,
} from "./submitHandlers.js";

export function renderAddEditFormPage({
  formData,
  setFormData,
  tagInputDrafts,
  setTagInputDrafts,
  priceRangeDrafts,
  setPriceRangeDrafts,
  forms,
  onLatLngFinalized,
  addEditComponent = "editPanel",
  onClose,
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
}) {
  if (
    !schema ||
    !formData ||
    !Array.isArray(formData.sections)
  ) {
    return null;
  }

  const userBlock =
    renderUserSection({
      schema,
      formData,
    });

  const geometryBlock =
    renderGeometrySection({
      schema,
      formData,
      setFormData,
      setDraftGeometry,
      onLatLngFinalized,
      forms,
      addEditComponent,
    });

  const timeBlock = (
    <TimeRenderer
      key="time-block"
      formData={formData}
      setFormData={setFormData}
      schema={schema}
    />
  );

  if (addEditComponent === "addPanel") {
    const renderedBlocks = [];

    if (userBlock) {
      renderedBlocks.push(
        <div key="user-block">
          {userBlock}
        </div>,
      );
    }

    if (geometryBlock) {
      renderedBlocks.push(
        <div key="geometry-block">
          {geometryBlock}
        </div>,
      );
    }

    renderedBlocks.push(
      <div key="time-block">
        {timeBlock}
      </div>,
    );

    schema.sections.forEach(
      (schemaSection, idx) => {
        const sectionBlock =
          renderSection({
            section: schemaSection,
            sectionIndex: idx,
            formData,
            setFormData,
            tagInputDrafts,
            setTagInputDrafts,
            priceRangeDrafts,
            setPriceRangeDrafts,
          });

        if (sectionBlock) {
          renderedBlocks.push(
            <div key={schemaSection.id}>
              {sectionBlock}
            </div>,
          );
        }
      },
    );

    const extensionsBlock =
      renderExtensionsSection({
        schema,
        addEditComponent: "addPanel",
        formData,
        setFormData,
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
      });

    if (extensionsBlock) {
      renderedBlocks.push(
        <div key="extensions-block">
          {extensionsBlock}
        </div>,
      );
    }

    renderedBlocks.push(
      <div
        key="add-buttons"
        className="section"
      >
        <div className="buttons-container">
          <button
            type="button"
            onClick={() =>
              handleAddSubmit({
                schema,
                formData,
                system,
                dataUtils,
                apis,
                setData,
                setSelectedDataItem,
                setSchema,
                onClose,
              })
            }
            aria-label="Add Data"
          >
            Add Data
          </button>
        </div>
      </div>,
    );

    return renderedBlocks;
  }

  if (addEditComponent === "editPanel") {
    const renderedBlocks = [];

    if (userBlock) {
      renderedBlocks.push(
        <div key="user-block">
          {userBlock}
        </div>,
      );
    }

    if (geometryBlock) {
      renderedBlocks.push(
        <div key="geometry-block">
          {geometryBlock}
        </div>,
      );
    }

    renderedBlocks.push(
      <div key="time-block">
        {timeBlock}
      </div>,
    );

    schema.sections.forEach(
      (schemaSection, idx) => {
        const sectionBlock =
          renderSection({
            section: schemaSection,
            sectionIndex: idx,
            formData,
            setFormData,
            tagInputDrafts,
            setTagInputDrafts,
            priceRangeDrafts,
            setPriceRangeDrafts,
          });

        if (sectionBlock) {
          renderedBlocks.push(
            <div key={schemaSection.id}>
              {sectionBlock}
            </div>,
          );
        }
      },
    );

    renderedBlocks.push(
      <div
        key="edit-buttons"
        className="section"
      >
        <div className="buttons-container">
          <button
            onClick={() =>
              handleEditSubmit({
                schema,
                selectedDataItem,
                formData,
                committedDataItem,
                blankFormTemplate,
                forms,
                system,
                dataUtils,
                apis,
                setData,
                previousCenterRef,
                setCommittedDataItem,
                setSkipInitialization,
                setDraftGeometry,
                setSelectedDataItem,
                setFormData,
                setSchema,
              })
            }
            aria-label="Save Changes"
          >
            Save Changes
          </button>

          {schema.engineKey !== "presence" && (
            <button
              onClick={() =>
                handleDelete({
                  schema,
                  selectedDataItem,
                  system,
                  apis,
                  dataUtils,
                  setData,
                  setDraftGeometry,
                  setSelectedDataItem,
                  setSchema,
                })
              }
              className="delete-btn"
              aria-label="Delete Data"
            >
              Delete Data
            </button>
          )}
        </div>
      </div>,
    );

    const extensionsBlock =
      renderExtensionsSection({
        schema,
        addEditComponent: "editPanel",
        formData,
        setFormData,
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
      });

    if (extensionsBlock) {
      renderedBlocks.push(
        <div key="extensions-block">
          {extensionsBlock}
        </div>,
      );
    }

    return renderedBlocks;
  }

  return null;
}

export default renderAddEditFormPage;