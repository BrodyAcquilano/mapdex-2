import { useEffect, useRef, useState } from "react";
import "./gallery.css";
import { getGalleryMaxImages } from "../../shared/validation/galleryContentValidation.js";

function GalleryModal({
  isOpen,
  onClose,
  mode,
  selectedDataItem,
  schema,
  system,
  extensionsApi,
  isMobile,
  user,
}) {
  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  const maxImages = getGalleryMaxImages(schema);

  const atMaxImages = images.length >= maxImages;

  /* ─────────────────────────────────────────────
     Keyboard navigation
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, images.length]);

  /* ─────────────────────────────────────────────
     Fetch images
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen || !selectedDataItem || !schema || !extensionsApi?.gallery)
      return;

    const fetchImages = async () => {
      setLoading(true);

      const { data: apiResponse, message } = await extensionsApi.gallery.getAll(
        schema._id,
        selectedDataItem._id,
        schema.engineKey,
      );

      if (message) system?.notify?.(message);

      setImages(Array.isArray(apiResponse) ? apiResponse : []);
      setIndex(0);

      setLoading(false);
    };

    fetchImages();
  }, [
    isOpen,
    selectedDataItem,
    schema._id,
    schema?.configUpdatedAt,
    extensionsApi,
  ]);

  /* ─────────────────────────────────────────────
     Preload originals
  ───────────────────────────────────────────── */
  useEffect(() => {
    images.forEach((img) => {
      const i = new Image();
      i.src = img.original?.url;
    });
  }, [images]);

  if (!isOpen) return null;

  const hasImages = images.length > 0;
  const current = images[index];

  const next = () =>
    setIndex((i) => (images.length ? (i + 1) % images.length : 0));

  const prev = () =>
    setIndex((i) =>
      images.length ? (i - 1 + images.length) % images.length : 0,
    );

  /* ─────────────────────────────────────────────
     Add image
  ───────────────────────────────────────────── */
  const handleAddImage = async (e) => {
    if (images.length >= maxImages) {
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const { data: apiResponse, message } = await extensionsApi.gallery.add(
      schema._id,
      selectedDataItem._id,
      schema.engineKey,
      file,
    );

    if (message) system?.notify?.(message);

    if (apiResponse?._id) {
      setImages((prev) => [...prev, apiResponse]);
    }

    e.target.value = "";
  };

  /* ─────────────────────────────────────────────
     Remove image
  ───────────────────────────────────────────── */
  const handleRemoveImage = async () => {
    if (!current) return;
    const confirmed = await system.confirm({
      message: "Are you sure you want to delete this image?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    const { data: apiResponse, message } = await extensionsApi.gallery.remove(
      schema._id,
      current._id,
      schema.engineKey,
    );

    if (message) system?.notify?.(message);

    if (!apiResponse?._id) return;

    setImages((prev) => {
      const nextImgs = prev.filter((img) => img._id !== current._id);

      setIndex((i) => Math.max(0, Math.min(i, nextImgs.length - 1)));

      return nextImgs;
    });
  };

  return (
    <div className="gallery-backdrop" onMouseDown={onClose}>
      <div className="gallery-overlay" onMouseDown={(e) => e.stopPropagation()}>
        <div className="gallery-modal">
          <button className="gallery-close" onClick={onClose}>
            ×
          </button>

          <div className="gallery-stage">
            {loading && <div className="gallery-loading">Loading…</div>}

            {!loading && !hasImages && (
              <div className="gallery-empty">No images yet.</div>
            )}

            {!loading && hasImages && (
              <>
                <img
                  className="gallery-image"
                  src={current.original?.url}
                  alt={`Gallery image ${index + 1}`}
                  onClick={next}
                />

                {images.length > 1 && (
                  <>
                    <button
                      className="gallery-arrow gallery-arrow-left"
                      onClick={prev}
                    >
                      ‹
                    </button>

                    <button
                      className="gallery-arrow gallery-arrow-right"
                      onClick={next}
                    >
                      ›
                    </button>

                    <div className="gallery-dots">
                      {images.map((img, i) => (
                        <button
                          key={img._id}
                          className={
                            "gallery-dot" +
                            (i === index ? " gallery-dot-active" : "")
                          }
                          onClick={() => setIndex(i)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {mode === "editor" && (
            <div className="gallery-editor-controls">
              {!atMaxImages && (
                <button
                  className="add-image-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Add Image
                </button>
              )}

              {hasImages && (
                <button
                  className="delete-image-button"
                  onClick={handleRemoveImage}
                >
                  Remove Image
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAddImage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GalleryModal;
