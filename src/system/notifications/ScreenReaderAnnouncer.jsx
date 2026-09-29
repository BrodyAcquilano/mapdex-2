// src/system/notifications/ScreenReaderAnnouncer.jsx
import "./ScreenReaderAnnouncer.css";
import { useEffect, useState } from "react";

function ScreenReaderAnnouncer({ message }) {
  const [renderedMessage, setRenderedMessage] = useState("");

  useEffect(() => {
        if (!message) {
      setRenderedMessage("");
      return;
    }

    setRenderedMessage("");

    const timer = setTimeout(() => {
      setRenderedMessage(message);
    }, 50);

    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {renderedMessage}
    </div>
  );
}



export default ScreenReaderAnnouncer;