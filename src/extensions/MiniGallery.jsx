import { useEffect, useRef, useState } from "react";

import "./MiniGallery.css";

export default function MiniGallery({
  isMiniGalleryOpen,
  setIsMiniGalleryOpen,
  selectedDataItem,
  schema,
  onOpenExtension,
  currentPage,
  system,
  apis,
  dataUtils,
}) {

  /* ───────── constants ───────── */

  const POLAROID_WIDTH = 270;
  const CLICK_DELAY = 220;

  /* ───────── drag state ───────── */

  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - POLAROID_WIDTH - 24,
    y: 0,
  }));

  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  /* ───────── click suppression ───────── */

  const clickTimeoutRef = useRef(null);

  /* ───────── gallery state ───────── */

  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  /*_____________preview text__________*/
  
const schemaPreviewText = dataUtils.getPreviewText(
  schema?.previewText,
  selectedDataItem,
  schema
);

const previewText =
  schema?.engineKey === "presence"
    ? [
        selectedDataItem?.userName || "Unknown User",
        ...schemaPreviewText,
      ]
    : schemaPreviewText;

  /* ───────── drag handlers ───────── */

  const onPointerDown = (e) => {
    if (e.target.closest(".mini-gallery-image")) return;

    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    startRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;

    const nextX = e.clientX - startRef.current.x;
    const nextY = e.clientY - startRef.current.y;

    const minX = 0;
    const maxX = window.innerWidth - POLAROID_WIDTH;

    const minY = 0;
    const maxY = window.innerHeight;

    setPos({
      x: Math.min(Math.max(nextX, minX), maxX),
      y: Math.min(Math.max(nextY, minY), maxY),
    });
  };

  const onPointerUp = (e) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  /* ───────── fetch images ───────── */

useEffect(() => {
  if (
    !isMiniGalleryOpen ||
    !selectedDataItem ||
    !schema ||
    !apis?.extensionsApi?.gallery
  )
    return;

  const fetchImages = async () => {
    setLoading(true);

    const { data: apiResponse, message } =
      await apis.extensionsApi.gallery.getAll(
        schema._id,
        selectedDataItem._id,
        schema.engineKey,
      );

    if (message) {
      system?.notify?.(message);
    }

    setImages(Array.isArray(apiResponse) ? apiResponse : []);
    setIndex(0);

    setLoading(false);
  };

  fetchImages();
}, [
  isMiniGalleryOpen,
  selectedDataItem?._id,
  schema?._id,
   schema?.configUpdatedAt,
  apis?.extensionsApi?.gallery,
  schema.engineKey,
]);

  /* ───────── preload thumbnails ───────── */

  useEffect(() => {
    images.forEach((img) => {
      if (img.thumb?.url) {
        const i = new Image();
        i.src = img.thumb.url;
      }
    });
  }, [images]);

  /* ───────── image logic ───────── */

  const nextImage = () => {
    if (!images.length) return;
    setIndex((i) => (i + 1) % images.length);
  };

  const handleImageClick = () => {
    if (clickTimeoutRef.current) return;

    clickTimeoutRef.current = setTimeout(() => {
      nextImage();
      clickTimeoutRef.current = null;
    }, CLICK_DELAY);
  };

   const handleImageDoubleClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const galleryMode =
      currentPage === "editor" && selectedDataItem?.userRole === "editor"
        ? "editor"
        : "viewer";

    onOpenExtension?.("Gallery", galleryMode);
  };

  const hasImages = images.length > 0;
  const currentImage = images[index];

  /* ───────── render ───────── */

  return (
    <div
      className={`mini-gallery-shell ${
        isMiniGalleryOpen ? "open" : "hidden"
      }`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <button
        className="mini-gallery-close"
        onClick={() => setIsMiniGalleryOpen(false)}
        aria-label="Close mini gallery"
      >
        ×
      </button>

      <div
        className="mini-gallery-polaroid"
        onPointerDown={onPointerDown}
      >
        <div
          className="mini-gallery-image"
          onClick={handleImageClick}
          onDoubleClick={handleImageDoubleClick}
        >
          {loading && <span>loading…</span>}

          {!loading && !hasImages && <span>no images yet</span>}

          {!loading && hasImages && currentImage?.thumb?.url && (
            <img
              src={currentImage.thumb.url}
              alt="Preview thumbnail"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        <div className="title-box">
  {previewText.map((line, i) => (
    <span key={i} className="title">
      {line}
    </span>
  ))}
</div>
</div>
    </div>
  );
}
