// src/forms/extensions/renderExtensions.jsx

import { validateExtensionsPayload } from "../../../shared/validation/dataValidation.js";

const EXTENSION_DELETE_MESSAGES = {
  Gallery: {
    title: "Are you sure you want to delete the Gallery?",
    body: "This will permanently remove all gallery images.",
  },

  Guestbook: {
    title: "Are you sure you want to delete the Guestbook?",
    body: "This will permanently remove all guestbook entries.",
  },
};

function handleAddExtensionToggle({
  extId,
  value,
  setFormData,
}) {
  setFormData((prev) => ({
    ...prev,

    extensions: {
      ...(prev.extensions || {}),

      [extId]: value,
    },
  }));
}

async function handleToggleExtension({
  extId,
  value,
  schema,
  selectedDataItem,
  committedDataItem,
  setCommittedDataItem,
  setSelectedDataItem,
  setFormData,
  setData,
  setSkipInitialization,
  setIsMiniGalleryOpen,
  dataUtils,
  system,
  apis,
}) {
  if (
    !committedDataItem?._id ||
    !committedDataItem?.updatedAt
  ) {
    return;
  }

  if (value === false) {
    const msg =
      EXTENSION_DELETE_MESSAGES[extId];

    if (msg) {
      const confirmed =
        await system.confirm({
          message:
            `${msg.title}\n\n${msg.body}`,
          confirmText: "Delete",
          cancelText: "Cancel",
        });

      if (!confirmed) {
        return;
      }
    }

    if (extId === "Gallery") {
      setIsMiniGalleryOpen?.(false);
    }
  }

  const nextExtensions = {
    ...(committedDataItem.extensions || {}),
    [extId]: value,
  };

  if (
    !validateExtensionsPayload(
      schema,
      nextExtensions,
    )
  ) {
    system.notify(
      "Invalid extensions.",
    );

    return;
  }

  const extensionUpdatePayload = {
    _id: committedDataItem._id,
    updatedAt: committedDataItem.updatedAt,
    extensions: nextExtensions,
  };

  const {
    data: apiResponse,
    message,
  } =
    await apis.engineApi.toggleExtensions(
      schema._id,
      schema.updatedAt,
      extensionUpdatePayload,
    );

  if (message) {
    message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) =>
        system.notify(line),
      );
  }

  const updateResult =
    apiResponse?.data;

  if (
    !updateResult?._id ||
    !updateResult?.updatedAt
  ) {
    return;
  }

  setCommittedDataItem((prev) =>
    prev
      ? {
          ...structuredClone(prev),
          extensions: nextExtensions,
          updatedAt:
            updateResult.updatedAt,
        }
      : prev,
  );

  setFormData?.((prev) =>
    prev
      ? {
          ...structuredClone(prev),
          extensions: nextExtensions,
          updatedAt:
            updateResult.updatedAt,
        }
      : prev,
  );

  const updatedSelectedDataItem = {
    ...structuredClone(
      selectedDataItem || {},
    ),

    _id: updateResult._id,
    extensions: nextExtensions,
    updatedAt:
      updateResult.updatedAt,
  };

  dataUtils.updateDataItemInList(
    setData,
    updatedSelectedDataItem,
  );

  setSkipInitialization?.(true);

  setSelectedDataItem?.(
    updatedSelectedDataItem,
  );
}

function renderAddExtensionOptions({
  togglableExtensions,
  formData,
  setFormData,
}) {
  if (
    !formData ||
    !setFormData ||
    togglableExtensions.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="section"
      role="region"
      aria-labelledby="extensions-heading"
    >
      <h3 id="extensions-heading">
        Togglable Extensions
      </h3>

      {togglableExtensions.map((ext) => {
        const checked =
          formData.extensions?.[ext.id] ??
          false;

        return (
          <div
            key={ext.id}
            className="inline-checkbox-row"
          >
            <div className="checkbox-container">
              <input
                id={`extension-${ext.id}`}
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  handleAddExtensionToggle({
                    extId: ext.id,
                    value:
                      e.target.checked,
                    setFormData,
                  })
                }
              />
            </div>

            <label
              htmlFor={`extension-${ext.id}`}
              className="label-container"
            >
              Include {ext.label || ext.id}
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function renderExtensionsSection({
  schema,
  addEditComponent,
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
}) {
  if (!schema?.extensions) {
    return null;
  }

  const rawExtensions =
    schema.extensions;

  const allExtensions =
    Array.isArray(rawExtensions)
      ? rawExtensions
      : Object.entries(
          rawExtensions,
        ).map(([id, ext]) => ({
          id,
          ...ext,
        }));

  const togglableExtensions =
    allExtensions.filter(
      (ext) =>
        ext.enabled &&
        ext.perDataItemToggle,
    );

  if (
    addEditComponent === "addPanel"
  ) {
    return renderAddExtensionOptions({
      togglableExtensions,
      formData,
      setFormData,
    });
  }

  if (
    addEditComponent === "editPanel"
  ) {
    if (
      !committedDataItem?.extensions
    ) {
      return null;
    }

    const openableExtensions =
      allExtensions.filter((ext) => {
        if (!ext.enabled) {
          return false;
        }

        return (
          committedDataItem
            .extensions?.[ext.id] ===
          true
        );
      });

    if (
      togglableExtensions.length === 0 &&
      openableExtensions.length === 0
    ) {
      return null;
    }

    return (
      <div>
        {togglableExtensions.length >
          0 && (
          <div className="section">
            <h3>
              Togglable Extensions
            </h3>

            {togglableExtensions.map(
              (ext) => (
                <div
                  key={`toggle-${ext.id}`}
                  className="inline-checkbox-row"
                >
                  <div className="checkbox-container">
                    <input
                      id={`extension-${ext.id}`}
                      type="checkbox"
                      checked={
                        committedDataItem
                          .extensions?.[
                          ext.id
                        ] ?? false
                      }
                      onChange={(e) =>
                        handleToggleExtension({
                          extId:
                            ext.id,
                          value:
                            e.target
                              .checked,
                          schema,
                          committedDataItem,
                          setCommittedDataItem,
                          selectedDataItem,
                          setSelectedDataItem,
                          setFormData,
                          setData,
                          setSkipInitialization,
                          setIsMiniGalleryOpen,
                          dataUtils,
                          system,
                          apis,
                        })
                      }
                    />
                  </div>

                  <label
                    htmlFor={`extension-${ext.id}`}
                    className="label-container"
                  >
                    {ext.label ||
                      ext.id}
                  </label>
                </div>
              ),
            )}
          </div>
        )}

        {openableExtensions.length >
          0 && (
          <div className="section">
            {openableExtensions.map(
              (ext) => (
                <div
                  key={`open-${ext.id}`}
                  className="buttons-container"
                >
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={() =>
                      onOpenExtension?.(
                        ext.id,
                        "editor",
                      )
                    }
                  >
                    Open{" "}
                    {ext.label ||
                      ext.id}
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default renderExtensionsSection;