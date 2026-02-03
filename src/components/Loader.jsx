// Loader.jsx
import React from "react";

const Loader = () => {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      color: "#fff",
      fontSize: 20,
      flexDirection: "column"
    }}>
      <div className="spinner" style={{
        border: "6px solid #f3f3f3",
        borderTop: "6px solid #3498db",
        borderRadius: "50%",
        width: 60,
        height: 60,
        animation: "spin 1s linear infinite",
        marginBottom: 10
      }} />
      Processing video... Please wait ⏳
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Loader;
