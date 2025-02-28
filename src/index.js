import React from "react";
import ReactDOM from "react-dom/client"; // Use "react-dom/client" for React 18
import AttendanceApp from "./App"; // Ensure this matches exactly

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AttendanceApp />
  </React.StrictMode>
);
