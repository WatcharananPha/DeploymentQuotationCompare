import React, { useMemo, useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  Settings,
  Info,
  Link as LinkIcon,
  UploadCloud,
  FileText,
  X,
  Play,
  Loader2,
  CheckCircle2,
  ExternalLink,
  TriangleAlert,
  Save,
  PanelLeft,
  Clock,
  File as FileIcon,
  Image as ImageIcon,
  List,
  ScanLine,
  Table,
  FileSpreadsheet,
  RotateCcw,
  LifeBuoy,
  KeyRound
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type View = "dashboard" | "processing" | "success" | "error" | "settings";
type Format = "Excel" | "Google Sheet" | "Both";

// --- Types ---
interface ProductItem {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
}

interface QuotationData {
  company: string;
  contact: string;
  vat: boolean;
  products: ProductItem[];
  totalPrice: number;
  totalVat: number;
  totalPriceIncludeVat: number;
  priceGuaranteeDay: number | string;
  deliveryTime: string;
  paymentTerms: string;
  otherNotes: string;
}

interface ProcessResultItem {
  file_name: string;
  data: QuotationData | null;
}

interface ApiResponse {
  sheet_id: string;
  results: ProcessResultItem[];
  errors: string[];
}

// --- Helpers ---
function bytesToSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = (bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 0);
  return `${v} ${sizes[i]}`;
}

function iconForFile(name: string, type: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  if (ext === "xlsx" || ext === "xls") return "file-spreadsheet";
  if (ext === "csv") return "file-input";
  if (ext === "pdf" || type === "application/pdf") return "file-text";
  return "file";
}

// --- Main Component ---
const App: React.FC = () => {
  const [view, setView] = useState<View>("dashboard");
  const [files, setFiles] = useState<File[]>([]);
  const [sheetLink, setSheetLink] = useState("https://docs.google.com/spreadsheets/d/17tMHStXQYXaIQHQIA4jdUyHaYt_tuoNCEEuJCstWEuw/edit?gid=553601935#gid=553601935");
  const [outputFormat, setOutputFormat] = useState<Format>("Excel");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSheetId, setLastSheetId] = useState<string | null>(null);
  const [resultsCount, setResultsCount] = useState(0);
  
  const [googleApiKey, setGoogleApiKey] = useState(() => localStorage.getItem("googleApiKey") || "");
  const [serviceAccountJson, setServiceAccountJson] = useState(() => localStorage.getItem("serviceAccountJson") || "");

  const [isDragOver, setIsDragOver] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [processingRemaining, setProcessingRemaining] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const totalSize = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);
  const estimatedSec = useMemo(() => {
    return files.length * 180;
  }, [files.length]);

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    const newFiles: File[] = [];
    Array.from(fileList).forEach((f) => {
      if (allowedTypes.includes(f.type) || /\.(pdf|jpg|jpeg|png)$/i.test(f.name)) {
        newFiles.push(f);
      }
    });
    if (newFiles.length) setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveCredentials = () => {
    localStorage.setItem("googleApiKey", googleApiKey);
    localStorage.setItem("serviceAccountJson", serviceAccountJson);
    setView("dashboard");
  };

  const simulateProcessingAnimation = (totalSec: number) => {
    setProcessingRemaining(totalSec);
    setStepIndex(0);
    let elapsed = 0;
    let step = 0;
    const stepPoints = [0, Math.floor(totalSec / 3), Math.floor((2 * totalSec) / 3), totalSec - 1];

    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = window.setInterval(() => {
      elapsed += 1;
      const remaining = Math.max(0, totalSec - elapsed);
      setProcessingRemaining(remaining);
      
      if (step < stepPoints.length && elapsed - 1 === stepPoints[step]) {
        setStepIndex(step);
        step += 1;
      }
    }, 1000);
  };

  const handleProcess = async () => {
    if (!files.length) return;
    
    if (!googleApiKey.trim() || !serviceAccountJson.trim()) {
       const confirmSettings = window.confirm("API Keys not found. Go to Settings?");
       if (confirmSettings) setView("settings");
       return;
    }

    setView("processing");
    setErrorMessage("");
    simulateProcessingAnimation(estimatedSec);

    const formData = new FormData();
    formData.append("sheet_url", sheetLink || "");
    formData.append("output_format", outputFormat);
    formData.append("google_api_key", googleApiKey.trim());
    formData.append("gcp_service_account_json", serviceAccountJson.trim());

    files.forEach((f) => formData.append("files", f));

    try {
      // FIX: เพิ่ม timeout ให้ Axios (0 = no timeout) เพื่อป้องกัน Client ตัด connection ก่อน Backend เสร็จ
      const res = await axios.post(`${API_BASE_URL}/api/process-files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 0, 
      });

      const data = res.data as ApiResponse;
      setLastSheetId(data.sheet_id);
      setResultsCount(data.results.length);

      if (data.errors && data.errors.length) {
        setErrorMessage(data.errors.join("\n"));
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      setStepIndex(4); 
      setView("success");

    } catch (err: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      let msg = "Unknown error";
      
      if (axios.isAxiosError(err)) {
         if (err.code === 'ECONNABORTED') {
             msg = "Request timed out. The server is taking too long to respond.";
         } else if (err.response?.data?.detail) {
             msg = err.response.data.detail;
         } else {
             msg = err.message;
         }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setErrorMessage(msg);
      setView("error");
    }
  };

  const resetAll = () => {
    setFiles([]);
    setSheetLink("https://docs.google.com/spreadsheets/d/17tMHStXQYXaIQHQIA4jdUyHaYt_tuoNCEEuJCstWEuw/edit?gid=553601935#gid=553601935");
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

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleAddFiles(e.dataTransfer.files);
  };

  return (
    <div className="m-0 w-screen min-h-screen antialiased selection:bg-blue-200 selection:text-blue-900 text-slate-900 bg-white font-sans">
      <div className="w-screen h-screen">
        <div className="relative bg-white w-full h-full overflow-hidden flex flex-col">
          
          <div className="h-12 flex sm:px-6 bg-white/70 border-slate-200 border-b pr-4 pl-4 backdrop-blur-sm items-center justify-between z-20">
            <div className="flex items-center gap-2">
               <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                 <span className="font-medium">Comparing Quotation – เทียบใบเสนอราคา</span>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => setMobileOpen(true)}
                 className="sm:hidden inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
               >
                 <PanelLeft className="w-4 h-4 text-slate-600" />
                 <span className="text-sm text-slate-700">Menu</span>
               </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden relative">
            <aside className="w-64 shrink-0 hidden sm:flex flex-col transition-all duration-300 bg-slate-50 border-slate-200 border-r">
               <div className="p-3">
                 <div className="px-2 py-2 text-xs font-medium text-slate-500">MAIN</div>
                 <nav className="flex flex-col gap-1">
                   <button 
                     onClick={() => setView("dashboard")}
                     className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-700 hover:bg-slate-100'}`}
                   >
                     <LayoutDashboard className={`w-4.5 h-4.5 ${view === 'dashboard' ? 'text-slate-900' : 'text-slate-500'}`} />
                     <span>Dashboard</span>
                   </button>
                 </nav>
                 <div className="px-2 py-3 text-xs font-medium text-slate-500">SETTINGS</div>
                 <nav className="flex flex-col gap-1">
                   <button 
                      onClick={() => setView("settings")}
                      className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all ${view === 'settings' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-700 hover:bg-slate-100'}`}
                   >
                     <Settings className={`w-4.5 h-4.5 ${view === 'settings' ? 'text-slate-900' : 'text-slate-500'}`} />
                     <span>Settings</span>
                   </button>
                 </nav>
               </div>
               <div className="mt-auto p-3 border-t border-slate-200">
                 <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition">
                   <Info className="w-4.5 h-4.5 text-slate-500" />
                   <div>
                     <div className="text-xs text-slate-500">Version</div>
                     <div className="text-sm font-medium text-slate-700">v4.0.0</div>
                   </div>
                 </div>
               </div>
            </aside>

            {mobileOpen && (
              <div className="fixed inset-0 z-40 sm:hidden">
                <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)}></div>
                <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-50 border-r border-slate-200 p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-slate-600 px-2">Menu</div>
                    <button className="p-2 rounded-md hover:bg-slate-100" onClick={() => setMobileOpen(false)}>
                      <X className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  <div className="px-2 py-2 text-xs font-medium text-slate-500">MAIN</div>
                  <button onClick={() => { setView("dashboard"); setMobileOpen(false); }} className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-all">
                    <LayoutDashboard className="w-4.5 h-4.5 text-slate-500" />
                    <span>Dashboard</span>
                  </button>
                  <div className="px-2 py-3 text-xs font-medium text-slate-500">SETTINGS</div>
                  <button onClick={() => { setView("settings"); setMobileOpen(false); }} className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-all">
                    <Settings className="w-4.5 h-4.5 text-slate-500" />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            )}

            <main className="flex-1 overflow-y-auto">
              
              {view === "dashboard" && (
                <section className="sm:p-6 pt-4 pr-4 pb-4 pl-4 space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-500">
                  <header className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
                      <p className="text-sm text-slate-500 mt-1">Upload quotations and create a unified Excel report.</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>~ {estimatedSec}s</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>{files.length} {files.length === 1 ? "file" : "files"}</span>
                      </div>
                    </div>
                  </header>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="p-4 sm:p-5">
                          <label className="block text-sm font-medium text-slate-700 mb-2">Google Sheet Link / Excel Sheet</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input 
                                type="url" 
                                value={sheetLink} 
                                onChange={e => setSheetLink(e.target.value)} 
                                placeholder="https://docs.google.com/spreadsheets/d/..." 
                                className="w-full focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] placeholder-slate-400 transition text-sm text-slate-700 border-slate-200 border rounded-lg pt-2.5 pr-3 pb-2.5 pl-9" 
                              />
                            </div>
                            <button 
                              onClick={() => window.open(sheetLink, "_blank")} 
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[#3B82F6]/40 text-[#1E3A8A] hover:bg-[#3B82F6]/5 hover:border-[#3B82F6]/60 transition"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Open</span>
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-slate-200"></div>

                        <div className="p-4 sm:p-5">
                           <div 
                             className={`relative rounded-xl border-2 border-dashed transition p-6 sm:p-8 text-center group cursor-pointer ${isDragOver ? 'border-[#3B82F6] bg-blue-50/50' : 'border-slate-300 hover:border-[#3B82F6] hover:bg-slate-50'}`}
                             onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                             onClick={() => fileInputRef.current?.click()}
                           >
                              <div className="flex flex-col items-center gap-3 pointer-events-none">
                                <div className="flex -space-x-3 items-center">
                                  <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm"><FileIcon className="w-5 h-5 text-slate-500" /></div>
                                  <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm"><ImageIcon className="w-5 h-5 text-slate-500" /></div>
                                  <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm"><FileText className="w-5 h-5 text-slate-500" /></div>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-700">Drag & Drop files here or <span className="text-[#1E3A8A] underline-offset-4 hover:underline font-medium">browse</span></p>
                                  <p className="text-xs text-slate-500 mt-1">Supported: PDF, JPG, JPEG, PNG • Max 200MB per file</p>
                                </div>
                              </div>
                              <input 
                                ref={fileInputRef} 
                                type="file" 
                                multiple 
                                accept="application/pdf,image/jpeg,image/png" 
                                className="hidden" 
                                onChange={(e) => { 
                                  handleAddFiles(e.target.files); 
                                  e.target.value = "";
                                }} 
                              />
                           </div>
                        </div>

                        <div className="px-4 sm:p-5 pt-0">
                           <div className="flex items-center justify-between mb-3">
                             <div className="text-sm font-medium text-slate-700">Uploaded Files</div>
                             <div className="text-xs text-slate-500">{files.length} files • {bytesToSize(totalSize)}</div>
                           </div>
                           <div className="space-y-2.5 min-h-[44px]">
                             {files.map((f, idx) => (
                               <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                 <div className="flex items-center gap-3 overflow-hidden">
                                   <div className="h-8 w-8 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                                     {iconForFile(f.name, f.type) === 'image' ? <ImageIcon className="w-4.5 h-4.5 text-slate-500" /> : <FileText className="w-4.5 h-4.5 text-slate-500" />}
                                   </div>
                                   <div>
                                     <div className="text-sm font-medium text-slate-800 truncate max-w-[220px] sm:max-w-[340px]">{f.name}</div>
                                     <div className="text-xs text-slate-500">{bytesToSize(f.size)}</div>
                                   </div>
                                 </div>
                                 <button onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx); }} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600">
                                   <X className="w-4 h-4" />
                                 </button>
                               </div>
                             ))}
                           </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                           <div className="text-sm font-medium text-slate-700">Output</div>
                           <div className="text-xs text-slate-500">Choose your preferred format</div>
                        </div>
                        <div className="inline-flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50">
                           {(["Excel", "Google Sheet", "Both"] as Format[]).map(fmt => (
                             <button 
                               key={fmt} 
                               onClick={() => setOutputFormat(fmt)}
                               className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${outputFormat === fmt ? 'bg-white shadow-sm text-slate-900 border border-blue-200' : 'text-slate-700 hover:bg-white hover:shadow-sm'}`}
                             >
                               {fmt}
                             </button>
                           ))}
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                         <button 
                           onClick={handleProcess} 
                           disabled={files.length === 0}
                           className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-tr from-[#3B82F6] to-[#1E3A8A] shadow-md hover:shadow-lg hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3B82F6] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           <Play className="w-4.5 h-4.5" /> Process Files
                         </button>
                      </div>
                    </div>

                    <aside className="lg:col-span-1">
                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 sticky top-4">
                         <div className="flex items-center gap-2 mb-3">
                           <List className="w-4.5 h-4.5 text-[#1E3A8A]" />
                           <h2 className="text-lg font-semibold tracking-tight text-slate-900">Processing Summary</h2>
                         </div>
                         <div className="space-y-3">
                           <div className="flex items-center justify-between text-sm">
                             <span className="text-slate-600">Total files</span>
                             <span className="font-medium text-slate-800">{files.length}</span>
                           </div>
                           <div className="flex items-center justify-between text-sm">
                             <span className="text-slate-600">Total size</span>
                             <span className="font-medium text-slate-800">{bytesToSize(totalSize)}</span>
                           </div>
                           <div className="flex items-center justify-between text-sm">
                             <span className="text-slate-600">Estimated time</span>
                             <span className="font-medium text-slate-800">~ {estimatedSec}s</span>
                           </div>
                           <div className="flex items-center justify-between text-sm">
                             <span className="text-slate-600">Output format</span>
                             <span className="font-medium text-slate-800">{outputFormat}</span>
                           </div>
                         </div>
                         <div className="mt-4 pt-4 border-t border-slate-200">
                           <div className="text-xs text-slate-500">Your files are processed securely in the cloud. You can close this window while processing.</div>
                         </div>
                      </div>
                    </aside>
                  </div>
                </section>
              )}

              {view === "settings" && (
                <section className="p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-500">
                  <header>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage API keys and your profile.</p>
                  </header>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                       <div className="flex items-center gap-2 mb-4">
                         <KeyRound className="w-4.5 h-4.5 text-[#1E3A8A]" />
                         <h2 className="text-lg font-semibold tracking-tight text-slate-900">API Keys</h2>
                       </div>
                       <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Google API Key</label>
                            <input 
                              type="password" 
                              value={googleApiKey} 
                              onChange={(e) => setGoogleApiKey(e.target.value)} 
                              placeholder="AIza..." 
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] text-sm text-slate-700 placeholder-slate-400 transition font-mono" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">GCP Service Account JSON</label>
                            <textarea 
                              value={serviceAccountJson} 
                              onChange={(e) => setServiceAccountJson(e.target.value)} 
                              rows={6} 
                              placeholder='{ "type": "service_account", ... }' 
                              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] text-sm text-slate-700 placeholder-slate-400 transition font-mono resize-y" 
                            />
                          </div>
                       </div>
                       <div className="mt-5 flex justify-end">
                          <button 
                            onClick={handleSaveCredentials} 
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-[#3B82F6] hover:bg-[#316dd1] shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3B82F6] transition"
                          >
                            <Save className="w-4.5 h-4.5" />
                            <span>Save</span>
                          </button>
                       </div>
                    </div>
                  </div>
                </section>
              )}

              {view === "processing" && (
                <section className="p-6 h-full flex flex-col items-center justify-center text-center animate-in fade-in">
                  <div className="space-y-6">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full border-2 border-slate-200 flex items-center justify-center mx-auto">
                        <Loader2 className="w-7 h-7 text-[#1E3A8A] animate-spin" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Processing your files</h2>
                      <p className="text-sm text-slate-500 mt-1">~ {processingRemaining}s remaining</p>
                    </div>
                    <div className="max-w-xl mx-auto text-left">
                       <ol className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                         {[
                            { icon: UploadCloud, label: "Uploading", sub: "Sending files" },
                            { icon: ScanLine, label: "Analyzing", sub: "Understanding docs" },
                            { icon: Table, label: "Extracting Data", sub: "Parsing lines & prices" },
                            { icon: FileSpreadsheet, label: "Creating Excel", sub: "Finalizing output" }
                         ].map((step, idx) => {
                            const isActive = idx === stepIndex;
                            const isCompleted = idx < stepIndex;
                            const Icon = step.icon;
                            return (
                              <li key={idx} className="step-item rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-3">
                                <Icon className={`w-4.5 h-4.5 ${isCompleted ? 'text-emerald-500' : isActive ? 'text-[#1E3A8A]' : 'text-slate-400'}`} />
                                <div>
                                  <div className="text-sm font-medium text-slate-800">{step.label}</div>
                                  <div className="text-xs text-slate-500">{step.sub}</div>
                                </div>
                              </li>
                            );
                         })}
                       </ol>
                    </div>
                    <div className="text-xs text-slate-500">This may take a moment depending on file sizes.</div>
                  </div>
                </section>
              )}

              {view === "success" && (
                <section className="p-6 h-full flex flex-col items-center justify-center text-center relative animate-in zoom-in-95 duration-300">
                  {/* Background Effects */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                     <span className="absolute top-10 left-1/4 h-2 w-2 rounded-full bg-[#3B82F6]/40 animate-ping" />
                     <span className="absolute top-16 right-1/4 h-2 w-2 rounded-full bg-emerald-400/40 animate-ping" />
                  </div>
                  <div className="space-y-6">
                     <div className="relative mx-auto">
                       <div className="absolute inset-0 blur-2xl bg-[#3B82F6]/20 rounded-full scale-125" />
                       <div className="relative h-16 w-16 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center mx-auto">
                         <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                       </div>
                     </div>
                     <div>
                       <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Processing Complete</h2>
                       <p className="text-sm text-slate-500 mt-1">Processed {resultsCount} files successfully.</p>
                     </div>
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                       <button 
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-tr from-[#3B82F6] to-[#1E3A8A] shadow-md hover:shadow-lg hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3B82F6] transition"
                          onClick={() => {
                            alert("Download logic here");
                          }}
                       >
                         <ExternalLink className="w-4.5 h-4.5" /> <span>Download Excel</span>
                       </button>
                       <button 
                          onClick={() => window.open(sheetUrlResolved, "_blank")} 
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-[#1E3A8A] border border-[#3B82F6]/40 hover:bg-[#3B82F6]/5 hover:border-[#3B82F6]/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3B82F6]/60 transition"
                       >
                          <ExternalLink className="w-4.5 h-4.5" /> <span>Open Google Sheet</span>
                       </button>
                     </div>
                     <div>
                       <button onClick={resetAll} className="text-sm text-slate-600 hover:text-slate-800 underline underline-offset-4">Process more files</button>
                     </div>
                  </div>
                </section>
              )}

              {view === "error" && (
                <section className="p-6 h-full flex flex-col items-center justify-center text-center animate-in fade-in">
                   <div className="space-y-5 max-w-lg">
                     <div className="h-16 w-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
                       <TriangleAlert className="w-10 h-10 text-rose-500" />
                     </div>
                     <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Processing Failed</h2>
                        <p className="text-sm text-slate-500 mt-1">Please review the details below.</p>
                     </div>
                     <div className="text-left text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-auto max-h-60">
                        {errorMessage}
                     </div>
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button 
                          onClick={() => setView("dashboard")} 
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-[#3B82F6] hover:bg-[#316dd1] shadow-sm hover:shadow-md transition"
                        >
                           <RotateCcw className="w-4.5 h-4.5" /> <span>Try Again</span>
                        </button>
                        <a href="mailto:support@example.com" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#1E3A8A] border border-[#3B82F6]/40 hover:bg-[#3B82F6]/5 hover:border-[#3B82F6]/60 transition">
                           <LifeBuoy className="w-4.5 h-4.5" /> <span>Contact Support</span>
                        </a>
                     </div>
                   </div>
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