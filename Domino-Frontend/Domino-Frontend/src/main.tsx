import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DominoProvider } from "./lib/connection";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DominoProvider>
      <App />
    </DominoProvider>
  </React.StrictMode>,
);
