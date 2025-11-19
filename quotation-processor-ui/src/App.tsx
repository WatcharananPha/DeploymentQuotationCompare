import React, { useEffect, useMemo, useState } from "react";

type View = "dashboard" | "processing" | "success" | "error";

interface ApiResponse {
  sheet_id: string;
  results: any[];
  errors: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function bytesToSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = (bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 0);
  return `${v} ${sizes[i]}`;
}

const App: React.FC = () => {
  const [view, setView] = useState<View>("dashboard");
  const [files, setFiles] = useState<File[]>([]);
  const [sheetLink, setSheetLink] = useState("");
  const [outputFormat, setOutputFormat] = useState<"Excel" | "Google Sheet" | "Both">("Excel");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSheetId, setLastSheetId] = useState<string | null>(null);
  const [resultsCount, setResultsCount] = useState(0);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [credentialsStatus, setCredentialsStatus] = useState("");

  useEffect(() => {
    const storedApiKey = localStorage.getItem("googleApiKey");
    const storedServiceJson = localStorage.getItem("serviceAccountJson");
    if (storedApiKey) setGoogleApiKey(storedApiKey);
    if (storedServiceJson) setServiceAccountJson(storedServiceJson);

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/credentials`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.google_api_key) {
          setGoogleApiKey(data.google_api_key);
          localStorage.setItem("googleApiKey", data.google_api_key);
        }
        if (data.gcp_service_account_json) {
          setServiceAccountJson(data.gcp_service_account_json);
          localStorage.setItem("serviceAccountJson", data.gcp_service_account_json);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setCredentialsStatus("");
  }, [googleApiKey, serviceAccountJson]);

  const totalSize = useMemo(
    () => files.reduce((acc, f) => acc + f.size, 0),
    [files]
  );

  const estimatedSec = useMemo(() => {
    const mb = totalSize / (1024 * 1024);
    return Math.min(120, Math.max(3, Math.round(3 + mb * 0.6)));
  }, [totalSize]);

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"];
    const next: File[] = [];
    Array.from(fileList).forEach((file) => {
      const lowerName = file.name.toLowerCase();
      const typeOk =
        file.type === "application/pdf" ||
        file.type === "application/octet-stream" ||
        file.type.startsWith("image/");
      const extOk = allowedExts.some((ext) => lowerName.endsWith(ext));
      if (typeOk || extOk) {
        next.push(file);
      }
    });
    if (next.length) setFiles((prev) => [...prev, ...next]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveCredentials = async () => {
    if (!googleApiKey.trim() || !serviceAccountJson.trim()) {
      setCredentialsStatus("Please provide both credentials before saving");
      return;
    }

    const formData = new FormData();
    formData.append("google_api_key", googleApiKey.trim());
    formData.append("gcp_service_account_json", serviceAccountJson.trim());

    const res = await fetch(`${API_BASE_URL}/api/credentials`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const msg = await res.text();
      setCredentialsStatus(msg || "Failed to save credentials");
      return;
    }

    localStorage.setItem("googleApiKey", googleApiKey.trim());
    localStorage.setItem("serviceAccountJson", serviceAccountJson.trim());
    setCredentialsStatus("Saved credentials");
  };

  const handleProcess = async () => {
    if (!files.length) return;
    if (!googleApiKey.trim() || !serviceAccountJson.trim()) {
      setErrorMessage("Please enter Google API Key and Service Account JSON before processing.");
      setView("error");
      return;
    }
    setView("processing");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("sheet_url", sheetLink || "");
    // ถ้า backend ต้องการ field อื่น (เช่น output_format) ก็ append เพิ่มตรงนี้ได้
    formData.append("output_format", outputFormat);
    formData.append("google_api_key", googleApiKey.trim());
    formData.append("gcp_service_account_json", serviceAccountJson.trim());

    files.forEach((f) => formData.append("files", f));

    const res = await fetch(`${API_BASE_URL}/api/process-files`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      setErrorMessage(text || `HTTP ${res.status}`);
      setView("error");
      return;
    }

    const data: ApiResponse = await res.json();
    setLastSheetId(data.sheet_id);
    setResultsCount(data.results.length);
    if (data.errors && data.errors.length) {
      setErrorMessage(data.errors.join("\n"));
    }
    setView("success");
  };

  const resetAll = () => {
    setFiles([]);
    setSheetLink("");
    setOutputFormat("Excel");
    setErrorMessage("");
    setLastSheetId(null);
    setResultsCount(0);
    setView("dashboard");
  };

  const sheetUrlResolved = useMemo(() => {
    if (!lastSheetId) return sheetLink || "";
    if (sheetLink.includes("spreadsheets/d/")) return sheetLink;
    return `https://docs.google.com/spreadsheets/d/${lastSheetId}`;
  }, [lastSheetId, sheetLink]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="h-12 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              Comparing Quotation – เทียบใบเสนอราคา
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
              {view === "dashboard" && (
                <section className="space-y-6">
                  <header className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                        Dashboard
                      </h1>
                      <p className="text-sm text-slate-500 mt-1">
                        Upload quotations and update Google Sheet.
                      </p>
                    </div>
                    <div className="hidden md:flex gap-2 text-sm text-slate-600">
                      <div className="border rounded-lg px-3 py-1.5">
                        ~ {estimatedSec}s
                      </div>
                      <div className="border rounded-lg px-3 py-1.5">
                        {files.length} {files.length === 1 ? "file" : "files"}
                      </div>
                    </div>
                  </header>

                  {/* Sheet link */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-700">API Credentials</div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            ใส่ Google API Key และ Service Account JSON เพื่อเชื่อมต่อ Gemini และ Google Sheet
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveCredentials}
                          className="text-xs font-medium text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50"
                        >
                          Save
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Google API Key</label>
                        <input
                          type="text"
                          value={googleApiKey}
                          onChange={(e) => setGoogleApiKey(e.target.value)}
                          placeholder="AIza..."
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">GCP Service Account JSON</label>
                        <textarea
                          value={serviceAccountJson}
                          onChange={(e) => setServiceAccountJson(e.target.value)}
                          placeholder={'{ "type": "service_account", ... }'}
                          rows={6}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {credentialsStatus && (
                        <div className="text-xs text-emerald-600">{credentialsStatus}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Google Sheet Link / ID
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={sheetLink}
                          onChange={(e) => setSheetLink(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {sheetUrlResolved && (
                          <button
                            type="button"
                            onClick={() => window.open(sheetUrlResolved, "_blank")}
                            className="px-3 py-2 text-sm rounded-lg border border-blue-200 text-blue-900 hover:bg-blue-50"
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Upload zone */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Upload quotations (PDF / Images)
                      </label>
                      <div
                        className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleAddFiles(e.dataTransfer.files);
                        }}
                      >
                        <p className="text-sm text-slate-700">
                          Drag &amp; drop หรือ{" "}
                          <label className="text-blue-700 underline cursor-pointer">
                            browse
                            <input
                              type="file"
                              multiple
                              accept="application/pdf,image/*"
                              className="hidden"
                              onChange={(e) => handleAddFiles(e.target.files)}
                            />
                          </label>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Supported: PDF and common image formats (JPG, PNG, HEIC, WEBP)
                        </p>
                      </div>
                    </div>

                    {/* File list */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-slate-700">
                          Uploaded Files
                        </div>
                        <div className="text-xs text-slate-500">
                          {files.length} file{files.length !== 1 && "s"} •{" "}
                          {bytesToSize(totalSize)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {files.map((f, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-800">
                                {f.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {bytesToSize(f.size)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              className="text-xs text-slate-600 hover:text-slate-900"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        {!files.length && (
                          <div className="text-xs text-slate-400 italic">
                            ยังไม่มีไฟล์
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Output format */}
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-2">
                        Output
                      </div>
                      <div className="inline-flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50">
                        {(["Excel", "Google Sheet", "Both"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setOutputFormat(fmt)}
                            className={
                              "px-3 py-1.5 rounded-md text-sm font-medium " +
                              (outputFormat === fmt
                                ? "bg-white shadow-sm border border-blue-200 text-slate-900"
                                : "text-slate-700 hover:bg-white hover:shadow-sm")
                            }
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!files.length}
                        onClick={handleProcess}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-tr from-blue-500 to-blue-900 shadow-md disabled:opacity-50"
                      >
                        <span>Process Files</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {view === "processing" && (
                <section className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full border-2 border-slate-200 flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Processing your files</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Estimated ~ {estimatedSec}s
                    </p>
                  </div>
                </section>
              )}

              {view === "success" && (
                <section className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <span className="text-emerald-500 text-3xl">✓</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Processing Complete</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Updated {resultsCount} quotation(s) to Google Sheet.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {sheetUrlResolved && (
                      <button
                        type="button"
                        onClick={() => window.open(sheetUrlResolved, "_blank")}
                        className="px-5 py-3 rounded-xl text-sm font-medium text-blue-900 border border-blue-200 hover:bg-blue-50"
                      >
                        Open Google Sheet
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetAll}
                      className="px-5 py-3 rounded-xl text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50"
                    >
                      Process more files
                    </button>
                  </div>
                  {errorMessage && (
                    <pre className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-xl text-left whitespace-pre-wrap">
                      {errorMessage}
                    </pre>
                  )}
                </section>
              )}

              {view === "error" && (
                <section className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                    <span className="text-rose-500 text-3xl">!</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Processing Failed</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Please review the error below.
                    </p>
                  </div>
                  <pre className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 max-w-xl text-left whitespace-pre-wrap">
                    {errorMessage || "Unknown error"}
                  </pre>
                  <button
                    type="button"
                    onClick={() => setView("dashboard")}
                    className="px-5 py-3 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Back to dashboard
                  </button>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;