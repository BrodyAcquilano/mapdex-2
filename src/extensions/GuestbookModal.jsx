import { useState, useEffect } from "react";
import "./guestbook.css";

import { GUESTBOOK_LIMITS } from "../../shared/validation/validationConstants.js";

import {
  validateGuestbookSigningEligibility,
} from "../../shared/validation/guestbookContentValidation.js";

function GuestbookModal({
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
  if (!isOpen) return null;

  const [pages, setPages] = useState([]);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);

  const [isSigning, setIsSigning] = useState(false);
  const [signStep, setSignStep] = useState(1);
  const [signName, setSignName] = useState("");
  const [signComment, setSignComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signError, setSignError] = useState("");
  const [signLat, setSignLat] = useState(null);
  const [signLng, setSignLng] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (!isOpen || !selectedDataItem || !schema || !extensionsApi?.guestbook) {
      return;
    }

    if (!extensionsApi?.guestbook?.getAll) return;

    const fetchGuestbook = async () => {
      setLoading(true);

      const { data: apiResponse, message } =
        await extensionsApi.guestbook.getAll(
          schema._id,
          selectedDataItem._id,
          schema.engineKey,
        );

      if (message) system?.notify?.(message);

      setPages(
        apiResponse?.pages?.length
          ? apiResponse.pages
          : [{ pageIndex: 0, entries: [] }],
      );

      setPageSize(apiResponse?.pageSize || 10);
      setSpreadIndex(0);
      setSelectedIds(new Set());

      setLoading(false);
    };

    fetchGuestbook();
  }, [
    isOpen,
    selectedDataItem,
    schema._id,
    schema?.configUpdatedAt,
    extensionsApi,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();

      if (e.key === "ArrowLeft") {
        setSpreadIndex((i) => Math.max(0, i - 1));
      }

      if (e.key === "ArrowRight") {
        setSpreadIndex((i) => {
          const max = isMobile
            ? pages.length - 1
            : Math.floor((pages.length - 1) / 2);

          return Math.min(max, i + 1);
        });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, pages.length, isMobile, onClose]);

  const canGoPrev = spreadIndex > 0;

  const canGoNext = isMobile
    ? spreadIndex + 1 < pages.length
    : (spreadIndex + 1) * 2 < pages.length;

  const prevPage = () => {
    if (canGoPrev) setSpreadIndex((i) => i - 1);
  };

  const nextPage = () => {
    if (canGoNext) setSpreadIndex((i) => i + 1);
  };

  const validateAndOpenSigning = () => {
    setSignError("");

    if (!navigator.geolocation) {
      setSignError("Location access is required to sign this guestbook.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;

        const signingValidation = validateGuestbookSigningEligibility({
          dataItem: selectedDataItem,
          lat: nextLat,
          lng: nextLng,
        });

        if (!signingValidation.isValid) {
          setSignError(signingValidation.error);
          return;
        }

        setSignLat(nextLat);
        setSignLng(nextLng);
        setSignStep(1);
        setSignName("");
        setSignComment("");
        setIsSigning(true);
      },
      () => setSignError("Unable to access your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submitEntry = async () => {
    if (!signName.trim()) return;

    setSubmitting(true);

    try {
      const { data: apiResponse, message } =
        await extensionsApi.guestbook.addEntry(
          schema._id,
          selectedDataItem._id,
          schema.engineKey,
          {
            name: signName.trim(),
            comment: signComment.trim(),
            lat: signLat,
            lng: signLng,
          },
        );

      if (message) system?.notify?.(message);

      if (apiResponse?.entry) {
        setPages((prev) => {
          const next = [...prev];
          let last = next[next.length - 1];

          if (!last || last.entries.length >= pageSize) {
            last = { pageIndex: next.length, entries: [] };
            next.push(last);
          }

          last.entries.push(apiResponse.entry);
          return next;
        });

        if (typeof apiResponse.pageIndex === "number") {
          setSpreadIndex(
            isMobile
              ? apiResponse.pageIndex
              : Math.floor(apiResponse.pageIndex / 2),
          );
        }

        setIsSigning(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelectedEntries = async () => {
    if (!selectedIds.size) return;

    const confirmed = await system.confirm({
      message: `Delete ${selectedIds.size} entr${
        selectedIds.size === 1 ? "y" : "ies"
      }?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    const { data: apiResponse, message } =
      await extensionsApi.guestbook.toggleEntries(
        schema._id,
        selectedDataItem._id,
        schema.engineKey,
        Array.from(selectedIds),
        "hidden",
      );

    if (message) system?.notify?.(message);
    if (!apiResponse) return;

    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        entries: p.entries.map((e) =>
          selectedIds.has(e.id) ? { ...e, status: "hidden" } : e,
        ),
      })),
    );

    setSelectedIds(new Set());
  };

  const restoreSelectedEntries = async () => {
    if (!selectedIds.size) return;

    const { data: apiResponse, message } =
      await extensionsApi.guestbook.toggleEntries(
        schema._id,
        selectedDataItem._id,
        schema.engineKey,
        Array.from(selectedIds),
        "visible",
      );

    if (message) system?.notify?.(message);
    if (!apiResponse) return;

    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        entries: p.entries.map((e) =>
          selectedIds.has(e.id) ? { ...e, status: "visible" } : e,
        ),
      })),
    );

    setSelectedIds(new Set());
  };

  const getPage = (index) => pages[index] ?? { pageIndex: index, entries: [] };

  const renderMobile = () => {
    const page = getPage(spreadIndex);
    return <div className="guestbook-spread">{renderPage(page, true)}</div>;
  };

  const renderDesktop = () => {
    const leftPage = getPage(spreadIndex * 2);
    const rightPage = getPage(spreadIndex * 2 + 1);

    return (
      <div className="guestbook-spread">
        {renderPage(leftPage, true)}
        {renderPage(rightPage, false)}
      </div>
    );
  };

  const renderPage = (page, isLeft) => (
    <div
      className="guestbook-page"
      onClick={() => {
        if (isMobile) {
          return;
        }

        if (isLeft && spreadIndex > 0) {
          setSpreadIndex((i) => i - 1);
        }

        if (!isLeft && (spreadIndex + 1) * 2 < pages.length) {
          setSpreadIndex((i) => i + 1);
        }
      }}
    >
      <div className="guestbook-table">
        <div className="guestbook-row guestbook-header">
          <div className="guestbook-col-name">Name</div>
          <div className="guestbook-col-comment">Comment</div>
        </div>

        {page.entries.map((e) => (
          <div
            key={e.id}
            className={`guestbook-row ${
              e.status === "hidden" ? "guestbook-row-hidden" : ""
            }`}
          >
            {mode === "editor" && (
              <input
                type="checkbox"
                className="guestbook-row-checkbox"
                checked={selectedIds.has(e.id)}
                onChange={() => toggleSelect(e.id)}
                onClick={(ev) => ev.stopPropagation()}
              />
            )}

            <div className="guestbook-col-name">{e.name}</div>
            <div className="guestbook-col-comment">{e.comment || ""}</div>
          </div>
        ))}
      </div>

      <div className="guestbook-page-number">
        {page.pageIndex != null ? page.pageIndex + 1 : pages.length + 1}
      </div>
    </div>
  );

  return (
    <div className="guestbook-modal-backdrop">
      <div className="guestbook-modal">
        {(canGoPrev || canGoNext) && (
          <>
            {canGoPrev && (
              <button
                className="guestbook-arrow guestbook-arrow-left"
                onClick={prevPage}
              >
                ‹
              </button>
            )}

            {canGoNext && (
              <button
                className="guestbook-arrow guestbook-arrow-right"
                onClick={nextPage}
              >
                ›
              </button>
            )}
          </>
        )}

        <button className="guestbook-close" onClick={onClose}>
          ×
        </button>

        <h2 className="guestbook-title">Guestbook</h2>

        {!loading && (isMobile ? renderMobile() : renderDesktop())}

        <div className="guestbook-footer">
          {mode === "viewer" && (
            <button
              className="guestbook-sign-button"
              onClick={validateAndOpenSigning}
            >
              Sign the Guestbook
            </button>
          )}

          {mode === "editor" && (
            <div style={{ display: "flex", gap: "100px" }}>
              <button
                className="guestbook-editor-button"
                disabled={!selectedIds.size}
                onClick={deleteSelectedEntries}
              >
                Delete ({selectedIds.size})
              </button>

              <button
                className="guestbook-editor-button"
                disabled={!selectedIds.size}
                onClick={restoreSelectedEntries}
              >
                Restore ({selectedIds.size})
              </button>
            </div>
          )}
        </div>

        {signError && (
          <div className="guestbook-sign-overlay">
            <div className="guestbook-sign-card">
              <button
                className="guestbook-overlay-close"
                onClick={() => setSignError("")}
              >
                ×
              </button>
              {signError}
            </div>
          </div>
        )}

        {isSigning && (
          <div className="guestbook-sign-overlay">
            <div className="guestbook-sign-card">
              <button
                className="guestbook-overlay-close"
                onClick={() => setIsSigning(false)}
              >
                ×
              </button>

              <h3>{signStep === 1 ? "Your Name" : "Leave a Comment"}</h3>

              {signStep === 1 && (
                <input
                  autoFocus
                  maxLength={GUESTBOOK_LIMITS.nameMaxLength}
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                />
              )}

              {signStep === 2 && (
                <textarea
                  maxLength={GUESTBOOK_LIMITS.commentMaxLength}
                  value={signComment}
                  onChange={(e) => setSignComment(e.target.value)}
                />
              )}

              <div className="guestbook-sign-actions">
                <button onClick={() => setIsSigning(false)}>Cancel</button>

                {signStep === 1 ? (
                  <button
                    onClick={() => setSignStep(2)}
                    disabled={!signName.trim()}
                  >
                    Next
                  </button>
                ) : (
                  <button onClick={submitEntry} disabled={submitting}>
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuestbookModal;