import { FaUpload } from "react-icons/fa6";
import { useRef } from "react";

function Upload({ onRequestFile, label, accept = "video/*" }) {
  const inputRef = useRef(null);

  return (
    <div
      className="upload-component"
      onClick={() => inputRef.current?.click()}
      style={{ cursor: "pointer" }}
    >
      <FaUpload size={24} />
      <span>{label || "Upload File"}</span>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          onRequestFile?.(file);   // ✅ request only
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default Upload;
