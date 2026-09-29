import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./global.css";
import { SystemProvider } from "./system/SystemProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <SystemProvider>
      <App />
    </SystemProvider>
  </BrowserRouter>,
);
