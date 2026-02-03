import { FaUpload } from "react-icons/fa6";

function Upload({ onFileSelect, label,onFileUploaded }) {

  const handleFileChange = async(file) => {
    // Future enhancement: handle file upload progress or validation here
    if  (!file) return;
    try {
      const formdata = new FormData();  
      formdata.append("file", file); 
      const response = await fetch("http://localhost:8000/upload/local", {
        method: "POST",
        body: formdata,
      });
      if(!response.ok) { 
        throw new Error("File upload failed");
      }
      const data = await response.json();
      console.log("UPLOAD RESPONSE:", data);
      if (onFileSelect) {
        onFileSelect(file);
      }
      if (onFileUploaded) {
      onFileUploaded(data);
    }
      alert("File uploaded successfully"); 
 
    } catch (error) {
      console.error("File selection error:", error);
    }
  };
  return (
    <div className="upload-component">
      <FaUpload size={24} />
      <span>{label || "Upload File"}</span>
      <input type="file" onChange={(e) => handleFileChange(e.target.files[0])} />
    </div>
  );
}
export default Upload;