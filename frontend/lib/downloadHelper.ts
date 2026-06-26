/**
 * Helper to download and view documents safely inside the iframe sandbox,
 * and dynamically generate high-fidelity files for pre-seeded mock documents
 * to prevent corrupted file errors.
 */

import { EmployeeDocument } from "../types";

/**
 * Generates a minimal, valid PDF binary containing details for pre-seeded PDFs.
 */
function generateValidMockPDF(fileName: string, title: string, candidateName: string, docId: string): Blob {
  const currentDate = new Date().toLocaleString();
  const pdfText = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 450 >>
stream
BT
/F1 16 Tf
50 800 Td
(AGENTOPS SYSTEMS - COMPLIANCE MANAGEMENT) Tj
/F1 12 Tf
0 -30 Td
(OFFICIAL ENCRYPTED DOCUMENT VERIFICATION REGISTER) Tj
0 -40 Td
(Document Category: ${title}) Tj
0 -20 Td
(Associated File: ${fileName}) Tj
0 -20 Td
(Verified Holder Name: ${candidateName}) Tj
0 -20 Td
(Verification ID Reference: ${docId}) Tj
0 -20 Td
(Database Sync Timestamp: ${currentDate}) Tj
/F1 10 Tf
0 -40 Td
(This digital credential was verified by AgentOps Compliance & Audits Team.) Tj
0 -20 Td
(The original archive contains matching binary hash structures and was passed) Tj
0 -15 Td
(for compliance clearance. Integrity checks returned STATUS_APPROVED.) Tj
0 -15 Td
(Checksum: SHA256-${docId.replace("doc-", "").substring(0, 12).toUpperCase()}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 000000 n 
0000000249 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
820
%%EOF`;

  // Convert string to Uint8Array directly to preserve exact binary bytes
  const bytes = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i++) {
    bytes[i] = pdfText.charCodeAt(i);
  }
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * Generates a valid image (PNG) containing verification meta for images.
 */
function generateValidMockImage(fileName: string, title: string, candidateName: string, docId: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  
  if (ctx) {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 600, 400);
    grad.addColorStop(0, "#0f172a"); // Slate-900
    grad.addColorStop(1, "#312e81"); // Indigo-900
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 400);

    // Border
    ctx.strokeStyle = "#4f46e5"; // Indigo-600
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 580, 380);

    // Inner subtle border
    ctx.strokeStyle = "#10b981"; // Emerald-500
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 560, 360);

    // Watermark Logo Text
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.font = "bold 60px sans-serif";
    ctx.fillText("AGENTOPS", 110, 230);

    // Title text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("AGENTOPS COMPLIANCE VERIFICATION", 50, 60);

    ctx.fillStyle = "#10b981"; // Emerald text
    ctx.font = "bold 13px monospace";
    ctx.fillText("STATUS: VERIFIED SECURE", 50, 90);

    // Divider line
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(50, 110);
    ctx.lineTo(550, 110);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Inside parameters
    ctx.fillStyle = "#94a3b8"; // Slate-400
    ctx.font = "normal 12px sans-serif";
    ctx.fillText("Document Type:", 50, 150);
    ctx.fillText("Filename Info:", 50, 190);
    ctx.fillText("Candidate / Owner:", 50, 230);
    ctx.fillText("Credential ID ID:", 50, 270);
    ctx.fillText("System Timestamp:", 50, 310);

    ctx.fillStyle = "#f8fafc"; // White-ish text
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(title.toUpperCase(), 180, 150);
    ctx.font = "normal 14px monospace";
    ctx.fillText(fileName.substring(0, 42), 180, 190);
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(candidateName, 180, 230);
    ctx.font = "normal 14px monospace";
    ctx.fillText(docId, 180, 270);
    ctx.font = "normal 13px sans-serif";
    ctx.fillText(new Date().toLocaleString(), 180, 310);

    // Final stamp seal bottom right
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(480, 240, 45, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("APPROVED", 480, 235);
    ctx.font = "9px monospace";
    ctx.fillText("COMPLIANT", 480, 250);
  }

  return canvas.toDataURL("image/png");
}

/**
 * Returns a clean, correct Blob representation for a given EmployeeDocument.
 * If the doc contains the placeholder base64 keyword, it automatically synthesizes 
 * an appropriate PDF or Image blob so that the downloaded file is NOT corrupted.
 */
export function getCleanDocumentBlobAndUrl(document: EmployeeDocument, candidateName: string = "Candidate"): { blob: Blob; url: string } {
  let url = document.url || "";
  const lowercaseName = document.fileName.toLowerCase();
  
  // Detect if the file is pre-seeded with mock text
  const isDummyPreseed = url.includes("TG9hZGVkIGZpbGUgdGV4dCBjb250ZW50IHNpbXVsYXRpb24=") || 
                         url.includes("U2ltdWxhdGVkIGZpbGUgZGF0YSBvbiBBZ2VudE9wcw==");
                         
  if (isDummyPreseed) {
    // Generate actual correct mime file representation on the fly!
    if (lowercaseName.endsWith(".pdf")) {
      const blob = generateValidMockPDF(document.fileName, document.type, candidateName, document.id);
      const objectUrl = URL.createObjectURL(blob);
      return { blob, url: objectUrl };
    } 
    
    if (lowercaseName.endsWith(".png") || lowercaseName.endsWith(".jpg") || lowercaseName.endsWith(".jpeg") || lowercaseName.endsWith(".webp") || lowercaseName.endsWith(".gif")) {
      const dataUrl = generateValidMockImage(document.fileName, document.type, candidateName, document.id);
      // Convert dataUrl to a blob
      const parts = dataUrl.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      return { blob, url: objectUrl };
    }

    // Default Fallback: generate a text file
    const textData = `AGENTOPS VERIFIED FILE\nCategory: ${document.type}\nFile: ${document.fileName}\nCandidate Name: ${candidateName}\nID: ${document.id}\nVerification State: APPROVED\n\nThis plain text verification document simulates the uploaded metadata details of the original file without frame clipping.`;
    const blob = new Blob([textData], { type: "text/plain" });
    const objectUrl = URL.createObjectURL(blob);
    return { blob, url: objectUrl };
  }

  // If it's a real user-uploaded Data URL or file
  if (url.startsWith("data:")) {
    try {
      const parts = url.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      return { blob, url: objectUrl };
    } catch (e) {
      console.warn("Base64 decoding failed, using raw url fallbacks:", e);
    }
  }

  // Return raw details fallback
  return { blob: new Blob([url], { type: "text/plain" }), url };
}

/**
 * Triggers safe browser download of any EmployeeDocument (real or pre-seeded).
 */
export function triggerDocumentDownload(documentItem: EmployeeDocument, candidateName: string = "Candidate") {
  try {
    // Navigate the current window's location to the same-origin attachment download endpoint.
    // Because it is served with 'Content-Disposition: attachment', the browser downloads it seamlessly 
    // on user event without navigating the active screen, avoiding sandboxed window blocks.
    window.location.href = `/api/documents/safe-download/${documentItem.id}`;
  } catch (error) {
    console.error("Error downloading file:", error);
    // Ultimate fallback download
    window.open(documentItem.url, "_blank");
  }
}
