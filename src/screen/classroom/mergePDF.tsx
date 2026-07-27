"use client";

import React, { useRef, useState, CSSProperties } from "react";
import { PDFDocument, PDFImage } from "pdf-lib";
import JSZip from "jszip";

/**
 * PHIÊN BẢN CHẠY TRÊN TRÌNH DUYỆT (localhost / Vercel)
 * -----------------------------------------------------
 * Không phụ thuộc Electron / Node (fs, path, pdfkit).
 * Cài thư viện trước khi chạy:
 *
 *   npm install pdf-lib jszip
 *
 * TÍNH NĂNG:
 * 1. Chọn 1 thư mục cha chứa nhiều thư mục con ảnh -> mỗi thư mục con
 *    xuất ra 1 file PDF riêng (tên theo tên thư mục con).
 * 2. Chọn thư mục có chứa file .zip (bên trong zip là ảnh) -> tự giải nén
 *    trong trình duyệt, gộp ảnh trong zip thành 1 file PDF (tên theo tên
 *    file zip, bỏ đuôi .zip).
 * 3. Có thể bấm "Thêm Thư Mục Khác" nhiều lần để cộng dồn các nguồn ở
 *    nhiều vị trí rời rạc khác nhau.
 * 4. Tất cả PDF kết quả được gộp vào 1 file .zip để tải về 1 lần (hoặc
 *    tải trực tiếp 1 file .pdf nếu chỉ có đúng 1 nguồn).
 */

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"];
const ZIP_EXT = ".zip";

type ItemKind = "folder" | "zip";

interface SourceItem {
  key: string; // khóa nội bộ, duy nhất
  displayName: string; // tên hiển thị & dùng làm tên file PDF xuất ra
  kind: ItemKind;
  meta: string; // đường dẫn tương đối, hiển thị phụ
  folderFiles?: File[]; // dùng khi kind === "folder"
  zipFile?: File; // dùng khi kind === "zip"
}

interface ConversionResult {
  name: string;
  success: boolean;
  message: string;
}

interface ImageToPdfProps {
  user?: any;
}

const ImageToPdfScreen: React.FC<ImageToPdfProps> = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Record<string, SourceItem>>({});
  const [converting, setConverting] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<ConversionResult[]>([]);

  const getExt = (name: string) => {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx).toLowerCase() : "";
  };

  const handlePickClick = () => {
    if (!inputRef.current) {
      console.error("Không tìm thấy input ref");
      return;
    }
    setTimeout(() => {
      inputRef.current?.click();
    }, 0);
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    console.log("Đã chọn:", fileList?.length ?? 0, "file(s)");

    if (!fileList || fileList.length === 0) {
      console.warn("Không có file nào được chọn hoặc thư mục rỗng.");
      e.target.value = "";
      return;
    }

    // Chuyển sang mảng thường TRƯỚC khi reset input, vì FileList là live
    // reference — reset value sẽ làm nó rỗng theo nếu chưa copy ra mảng.
    const filesArray = Array.from(fileList);
    e.target.value = "";

    const newItems: Record<string, SourceItem> = {};
    const skipped: string[] = [];

    filesArray.forEach((file: File) => {
      const ext = getExt(file.name);
      const rel: string = (file as any).webkitRelativePath || file.name;
      const segments = rel.split("/");
      const parentDir = segments.slice(0, -1).join("/") || "(gốc)";

      // Trường hợp 1: file .zip -> mỗi zip là 1 nguồn riêng
      if (ext === ZIP_EXT) {
        const displayName = file.name.slice(0, file.name.length - ZIP_EXT.length);
        const internalKey = `zip:${rel}`;
        newItems[internalKey] = {
          key: internalKey,
          displayName,
          kind: "zip",
          meta: parentDir,
          zipFile: file,
        };
        return;
      }

      // Trường hợp 2: ảnh nằm trực tiếp trong thư mục
      if (IMAGE_EXTS.indexOf(ext) === -1) {
        skipped.push(`${file.name} (đuôi: "${ext}")`);
        return;
      }

      const groupName = segments.length >= 3 ? segments[1] : segments[0];
      const internalKey = `folder:${groupName}`;

      if (!newItems[internalKey]) {
        newItems[internalKey] = {
          key: internalKey,
          displayName: groupName,
          kind: "folder",
          meta: parentDir,
          folderFiles: [],
        };
      }
      (newItems[internalKey].folderFiles as File[]).push(file);
    });

    console.log("Số nguồn tìm thấy:", Object.keys(newItems).length, newItems);
    if (skipped.length > 0) {
      console.warn(`Bỏ qua ${skipped.length} file không hỗ trợ:`, skipped);
    }
    if (Object.keys(newItems).length === 0) {
      alert(
        "Không tìm thấy ảnh hoặc file .zip hợp lệ trong thư mục đã chọn. Mở Console để xem chi tiết file bị bỏ qua."
      );
    }

    setItems((prev) => {
      const merged = { ...prev };
      Object.keys(newItems).forEach((key) => {
        const incoming = newItems[key];
        const existing = merged[key];
        if (existing && existing.kind === "folder" && incoming.kind === "folder") {
          merged[key] = {
            ...existing,
            folderFiles: [...(existing.folderFiles || []), ...(incoming.folderFiles || [])],
          };
        } else {
          merged[key] = incoming;
        }
      });
      return merged;
    });
    setResults([]);
  };

  const handleRemoveItem = (key: string) => {
    setItems((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleClearAll = () => {
    setItems({});
    setResults([]);
  };

  // Chuyển 1 ảnh không phải PNG/JPEG (webp, gif, bmp...) sang PNG bằng canvas,
  // vì pdf-lib chỉ nhúng trực tiếp được PNG và JPEG.
  const convertToPngBytes = async (bytes: Uint8Array, mime: string): Promise<Uint8Array> => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Không tạo được canvas context.");
    ctx.drawImage(bitmap, 0, 0);
    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Chuyển đổi ảnh thất bại."))), "image/png");
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  };

  const MIME_MAP: Record<string, string> = {
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
  };

  // Nhúng 1 ảnh vào PDFDocument, tự chuyển định dạng nếu cần.
  const embedImageAuto = async (
    pdfDoc: PDFDocument,
    bytes: Uint8Array,
    filename: string
  ): Promise<PDFImage> => {
    const ext = getExt(filename);
    if (ext === ".png") return pdfDoc.embedPng(bytes);
    if (ext === ".jpg" || ext === ".jpeg") return pdfDoc.embedJpg(bytes);

    const mime = MIME_MAP[ext] || "image/png";
    const pngBytes = await convertToPngBytes(bytes, mime);
    return pdfDoc.embedPng(pngBytes);
  };

  const addImagesToPdf = async (
    pdfDoc: PDFDocument,
    images: { name: string; bytes: Uint8Array }[]
  ) => {
    for (const img of images) {
      const embedded = await embedImageAuto(pdfDoc, img.bytes, img.name);
      const { width, height } = embedded;
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    }
  };

  // Tạo PDF từ danh sách ảnh rời trong 1 thư mục.
  const buildPdfFromFolder = async (files: File[]): Promise<Uint8Array> => {
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
    const images = [];
    for (const f of sorted) {
      images.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    const pdfDoc = await PDFDocument.create();
    await addImagesToPdf(pdfDoc, images);
    return pdfDoc.save();
  };

  // Giải nén 1 file .zip trong trình duyệt, lấy các ảnh bên trong, tạo PDF.
  const buildPdfFromZip = async (zipFile: File): Promise<Uint8Array> => {
    const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());

    const entries = Object.values(zip.files)
      .filter((f: any) => !f.dir && IMAGE_EXTS.indexOf(getExt(f.name)) !== -1)
      .sort((a: any, b: any) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );

    if (entries.length === 0) {
      throw new Error(`File "${zipFile.name}" không chứa ảnh hợp lệ bên trong.`);
    }

    const images = [];
    for (const entry of entries as any[]) {
      const bytes: Uint8Array = await entry.async("uint8array");
      images.push({ name: entry.name, bytes });
    }

    const pdfDoc = await PDFDocument.create();
    await addImagesToPdf(pdfDoc, images);
    return pdfDoc.save();
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConvert = async () => {
    const keys = Object.keys(items);
    if (keys.length === 0) {
      alert("Vui lòng chọn ít nhất 1 thư mục ảnh hoặc file zip!");
      return;
    }

    setConverting(true);
    setResults([]);
    const acc: ConversionResult[] = [];
    const zipOut = new JSZip();
    let singlePdfBytes: Uint8Array | null = null;
    let singlePdfName = "";

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const item = items[key];
      setProgressText(`Đang xử lý ${i + 1}/${keys.length}: ${item.displayName}...`);

      try {
        let pdfBytes: Uint8Array;

        if (item.kind === "folder") {
          const files = item.folderFiles || [];
          if (files.length === 0) {
            acc.push({ name: item.displayName, success: false, message: "Không có ảnh trong thư mục này." });
            setResults([...acc]);
            continue;
          }
          pdfBytes = await buildPdfFromFolder(files);
        } else {
          if (!item.zipFile) {
            acc.push({ name: item.displayName, success: false, message: "Thiếu file zip." });
            setResults([...acc]);
            continue;
          }
          pdfBytes = await buildPdfFromZip(item.zipFile);
        }

        const outName = `${item.displayName}.pdf`;
        if (keys.length === 1) {
          singlePdfBytes = pdfBytes;
          singlePdfName = outName;
        } else {
          zipOut.file(outName, pdfBytes);
        }

        const count = item.kind === "folder" ? (item.folderFiles || []).length : undefined;
        acc.push({
          name: item.displayName,
          success: true,
          message:
            item.kind === "folder"
              ? `Đã gộp ${count} ảnh thành công.`
              : `Đã giải nén và gộp ảnh trong file zip thành công.`,
        });
      } catch (err: any) {
        acc.push({
          name: item.displayName,
          success: false,
          message: err && err.message ? err.message : "Lỗi không xác định.",
        });
      }
      setResults([...acc]);
    }

    try {
      if (singlePdfBytes) {
        downloadBlob(
          new Blob([singlePdfBytes as unknown as BlobPart], { type: "application/pdf" }),
          singlePdfName
        );
      } else if (acc.some((r) => r.success)) {
        setProgressText("Đang nén file .zip...");
        const zipBlob = await zipOut.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, "anh-gop-pdf.zip");
      }
    } catch (err) {
      console.error(err);
      alert("Có lỗi khi tạo file tải xuống.");
    }

    setConverting(false);
    setProgressText("");
  };

  const itemKeys = Object.keys(items);
  const totalImages = itemKeys.reduce(
    (sum, k) => sum + (items[k].kind === "folder" ? (items[k].folderFiles || []).length : 0),
    0
  );
  const zipCount = itemKeys.filter((k) => items[k].kind === "zip").length;
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f172a 0%, #1a2744 50%, #1e293b 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "24px 16px 40px",
      color: "#f8fafc",
    },
    maxW: { maxWidth: 720, margin: "0 auto" },
    header: { textAlign: "center", marginBottom: 32 },
    titleRow: { display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 2 },
    coin: {
      width: 42, height: 42,
      background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
      borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, boxShadow: "0 0 24px rgba(245,158,11,0.35)",
    },
    h1: {
      fontSize: 26, fontWeight: "bold", margin: 0,
      background: "linear-gradient(90deg, #fbbf24, #fde68a, #f59e0b)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    },
    sub: { fontSize: 11, color: "#94a3b8", letterSpacing: "3px", textTransform: "uppercase", marginTop: 4, fontWeight: 600 },
    divider: {
      width: 80, height: 2,
      background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)",
      margin: "10px auto 0",
    },
    card: {
      background: "rgba(30,41,59,0.7)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: "20px 20px 16px", marginBottom: 28,
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
    },
    sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#fbbf24", margin: "0 0 6px" },
    hint: { fontSize: 11, color: "#64748b", marginBottom: 16, lineHeight: 1.6 },
    btnRow: { display: "flex", gap: 10, flexWrap: "wrap" },
    btnPrimary: {
      flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: 8,
      border: "1px solid rgba(245,158,11,0.4)",
      background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
      color: "#1e293b", fontWeight: "bold", fontSize: 14, cursor: "pointer",
    },
    btnSecondary: {
      padding: "12px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.05)", color: "#cbd5e1", fontWeight: 600, fontSize: 13, cursor: "pointer",
    },
    folderRow: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: "10px 12px", marginBottom: 8,
    },
    folderName: { fontSize: 13, fontWeight: "bold", color: "#f1f5f9" },
    folderMeta: { fontSize: 11, color: "#64748b", marginTop: 2, wordBreak: "break-all" },
    removeBtn: { background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 4, flexShrink: 0 },
    convertBtn: {
      width: "100%", padding: "12px", borderRadius: 8, border: "none",
      background: converting ? "rgba(245,158,11,0.35)" : "linear-gradient(90deg, #fbbf24, #f59e0b)",
      color: "#1e293b", fontWeight: "bold", fontSize: 14,
      cursor: converting ? "not-allowed" : "pointer", marginTop: 10,
    },
    empty: { textAlign: "center", padding: "24px 0", color: "#475569", fontSize: 13 },
  };

  const kindBadgeStyle = (kind: ItemKind): CSSProperties => ({
    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
    background: kind === "zip" ? "rgba(96,165,250,0.15)" : "rgba(74,222,128,0.15)",
    color: kind === "zip" ? "#60a5fa" : "#4ade80",
    marginLeft: 6,
  });

  const badgeStyle = (success: boolean): CSSProperties => ({
    padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: "bold",
    background: success ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
    color: success ? "#4ade80" : "#f87171",
  });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <div style={s.coin}>🖼️</div>
          <h1 style={s.h1}>Gộp Ảnh Thành PDF</h1>
        </div>
        <p style={s.sub}>Thư mục ảnh · File zip · Xuất PDF</p>
        <div style={s.divider} />
      </div>

      <div style={s.maxW}>
        {/* Chọn thư mục */}
        <div style={s.card}>
          <h3 style={s.sectionTitle}>
            📁 Nguồn Đã Chọn ({itemKeys.length}) — {totalImages} ảnh rời{zipCount > 0 ? `, ${zipCount} file zip` : ""}
          </h3>
          <p style={s.hint}>
            • Chọn 1 thư mục cha chứa nhiều thư mục con ảnh → mỗi thư mục con tự tách
            thành 1 file PDF riêng.
            <br />
            • Nếu trong thư mục có file <strong>.zip</strong> (bên trong là ảnh) → ứng
            dụng tự giải nén và gộp ảnh trong đó thành 1 file PDF, đặt tên theo đúng tên
            file zip.
            <br />
            • Kết quả được gộp chung vào 1 file <strong>.zip</strong> để tải về (hoặc 1
            file PDF duy nhất nếu chỉ có đúng 1 nguồn).
            <br />
            <strong style={{ color: "#fbbf24" }}>
              Muốn chọn thêm từ vị trí khác? Bấm "Thêm Thư Mục Khác" nhiều lần, các nguồn
              sẽ được cộng dồn.
            </strong>
          </p>

          <input
            ref={inputRef}
            type="file"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              border: 0,
            }}
            multiple
            onChange={handleFolderInputChange}
            {...({ webkitdirectory: "", directory: "" } as any)}
          />

          <div style={s.btnRow}>
            <button style={s.btnPrimary} onClick={handlePickClick} disabled={converting}>
              {itemKeys.length === 0 ? "➕ Chọn Thư Mục" : "➕ Thêm Thư Mục Khác"}
            </button>
            {itemKeys.length > 0 && (
              <button style={s.btnSecondary} onClick={handleClearAll} disabled={converting}>
                Xóa Tất Cả
              </button>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            {itemKeys.length === 0 ? (
              <div style={s.empty}>Chưa chọn thư mục nào.</div>
            ) : (
              itemKeys.map((key) => {
                const item = items[key];
                return (
                  <div key={key} style={s.folderRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={s.folderName}>
                        {item.kind === "zip" ? "🗜️" : "📁"} {item.displayName}
                        <span style={kindBadgeStyle(item.kind)}>
                          {item.kind === "zip" ? "ZIP" : "THƯ MỤC"}
                        </span>
                      </div>
                      <div style={s.folderMeta}>
                        {item.kind === "folder"
                          ? `${(item.folderFiles || []).length} ảnh · ${item.meta}`
                          : `${item.meta}`}
                      </div>
                    </div>
                    <button
                      style={s.removeBtn}
                      onClick={() => handleRemoveItem(key)}
                      disabled={converting}
                      title="Bỏ chọn"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button style={s.convertBtn} onClick={handleConvert} disabled={converting}>
            {converting ? progressText || "Đang xử lý..." : `🚀 Xuất ${itemKeys.length || ""} File PDF`}
          </button>
        </div>

        {/* Kết quả */}
        {results.length > 0 && (
          <div style={s.card}>
            <h3 style={s.sectionTitle}>
              ✅ Kết Quả ({successCount} thành công{failCount > 0 ? `, ${failCount} lỗi` : ""})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((r) => (
                <div
                  key={r.name}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${r.success ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
                    borderRadius: 10, padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: "bold", color: "#f1f5f9" }}>{r.name}</span>
                        <span style={badgeStyle(r.success)}>{r.success ? "✅ OK" : "❌ Lỗi"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageToPdfScreen;