import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
const PopupApp = React.lazy(() => import("../components/PopupApp"));
import { captureGeolocation } from "../utils/page-utils";

ReactDOM.createRoot(document.getElementById("app")!).render(
  React.createElement(
    Suspense,
    { fallback: React.createElement("div", null, "Loading...") },
    React.createElement(PopupApp)
  )
);

setInterval(() => {
  captureGeolocation();
}, 60 * 1e3);
captureGeolocation();
