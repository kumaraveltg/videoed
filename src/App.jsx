import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VideoEditor from "./pages/VideoEditor";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/videoeditor" />} />

        {/* Video Editor Page */}
        <Route path="/videoeditor" element={<VideoEditor />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
