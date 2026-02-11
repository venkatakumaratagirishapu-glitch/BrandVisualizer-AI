
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { 
  Upload, 
  Trash2, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  Download,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Check,
  Share2,
  Clock,
  Settings2,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Bookmark,
  Plus,
  X,
  AlertTriangle,
  Lock,
  ZapOff,
  Archive
} from 'lucide-react';
import { MarketingMedium, GeneratedImage, AspectRatio, Preset } from './types';
import { MEDIUM_METADATA } from './constants';
import { visualizeProduct, AdvancedConfig } from './services/gemini';

interface DetailedError {
  medium: MarketingMedium;
  reason: string;
  type: 'safety' | 'rate' | 'auth' | 'server' | 'unknown';
}

interface GenerationStatus {
  medium: MarketingMedium;
  progress: number;
  message: string;
  status: 'idle' | 'preparing' | 'generating' | 'finalizing' | 'success' | 'error';
}

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

const PROGRESS_MESSAGES = [
  "Analyzing brand identity...",
  "Synthesizing lighting environment...",
  "Applying professional textures...",
  "Rendering canvas details...",
  "Adjusting perspective...",
  "Finalizing visualization..."
];

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedMediums, setSelectedMediums] = useState<MarketingMedium[]>([]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("1:1");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errors, setErrors] = useState<DetailedError[]>([]);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, GenerationStatus>>({});
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(1.0);
  const [topK, setTopK] = useState(64);
  const [topP, setTopP] = useState(0.95);
  const [seed, setSeed] = useState<number | undefined>(undefined);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedPresets = localStorage.getItem('brand-visualizer-presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to parse presets", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('brand-visualizer-presets', JSON.stringify(presets));
  }, [presets]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
        setErrors([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const parseErrorType = (msg: string): DetailedError['type'] => {
    if (msg.includes("RATE_LIMIT")) return 'rate';
    if (msg.includes("AUTH_ERROR") || msg.includes("PERMISSION_ERROR")) return 'auth';
    if (msg.includes("SAFETY_BLOCK")) return 'safety';
    if (msg.includes("SERVER_ERROR")) return 'server';
    return 'unknown';
  };

  const toggleMedium = (medium: MarketingMedium) => {
    setSelectedMediums(prev => 
      prev.includes(medium) 
        ? prev.filter(m => m !== medium) 
        : [...prev, medium]
    );
  };

  const updateIndividualStatus = (medium: MarketingMedium, updates: Partial<GenerationStatus>) => {
    setPendingStatuses(prev => ({
      ...prev,
      [medium]: { ...prev[medium], ...updates }
    }));
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      mediums: selectedMediums,
      aspectRatio: selectedAspectRatio,
      advancedConfig: { temperature, topK, topP, seed }
    };
    setPresets(prev => [...prev, newPreset]);
    setNewPresetName("");
  };

  const loadPreset = (preset: Preset) => {
    setSelectedMediums(preset.mediums);
    setSelectedAspectRatio(preset.aspectRatio);
    setTemperature(preset.advancedConfig.temperature);
    setTopK(preset.advancedConfig.topK);
    setTopP(preset.advancedConfig.topP);
    setSeed(preset.advancedConfig.seed);
  };

  const handleDownloadAll = async () => {
    if (generatedImages.length === 0) return;
    
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("brand-visualizer-mockups");
      
      const downloadPromises = generatedImages.map(async (img, index) => {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const safeName = img.medium.toLowerCase().replace(/\s+/g, '-');
        const filename = `${safeName}-${index + 1}.png`;
        folder?.file(filename, blob);
      });

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `brand-visualizer-export-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export images:", error);
      alert("Failed to create zip file. Individual downloads are still available.");
    } finally {
      setIsExporting(false);
    }
  };

  const generateMockups = async (mediumsToGenerate: MarketingMedium[] = selectedMediums) => {
    if (!sourceImage || mediumsToGenerate.length === 0) return;

    setIsGenerating(true);
    setErrors(prev => prev.filter(e => !mediumsToGenerate.includes(e.medium)));
    
    const advancedConfig: AdvancedConfig = {
      temperature,
      topK,
      topP,
      seed: seed !== undefined ? Number(seed) : undefined
    };

    const initialPending: Record<string, GenerationStatus> = {};
    mediumsToGenerate.forEach(m => {
      initialPending[m] = {
        medium: m,
        progress: 10,
        message: "Initializing...",
        status: 'preparing'
      };
    });
    setPendingStatuses(prev => ({ ...prev, ...initialPending }));

    try {
      const results = await Promise.all(
        mediumsToGenerate.map(async (medium) => {
          const progressInterval = setInterval(() => {
            setPendingStatuses(prev => {
              const current = prev[medium];
              if (!current || current.progress >= 90) return prev;
              const nextMsgIndex = Math.floor((current.progress / 100) * PROGRESS_MESSAGES.length);
              return {
                ...prev,
                [medium]: {
                  ...current,
                  progress: current.progress + (Math.random() * 5),
                  message: PROGRESS_MESSAGES[nextMsgIndex] || PROGRESS_MESSAGES[PROGRESS_MESSAGES.length - 1],
                  status: 'generating'
                }
              };
            });
          }, 1500);

          try {
            const metadata = MEDIUM_METADATA.find(m => m.id === medium);
            const url = await visualizeProduct(
              sourceImage, 
              medium, 
              metadata?.description || '', 
              selectedAspectRatio,
              advancedConfig
            );
            
            clearInterval(progressInterval);
            updateIndividualStatus(medium, { progress: 100, message: "Success!", status: 'success' });

            await new Promise(r => setTimeout(r, 500));

            return {
              status: 'fulfilled' as const,
              value: {
                id: `${medium}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                medium,
                url,
                timestamp: Date.now(),
                aspectRatio: selectedAspectRatio
              } as GeneratedImage
            };
          } catch (err: any) {
            clearInterval(progressInterval);
            updateIndividualStatus(medium, { progress: 0, message: "Error", status: 'error' });
            return {
              status: 'rejected' as const,
              reason: err.message || `Failed to generate visualization for ${medium}`,
              medium
            };
          } finally {
            setTimeout(() => {
              setPendingStatuses(prev => {
                const next = { ...prev };
                delete next[medium];
                return next;
              });
            }, 1000);
          }
        })
      );

      const successful = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as any).value as GeneratedImage);
      
      const rejected = results
        .filter((r) => r.status === 'rejected')
        .map((r) => ({
          medium: (r as any).medium,
          reason: (r as any).reason,
          type: parseErrorType((r as any).reason)
        }) as DetailedError);

      if (successful.length > 0) {
        setGeneratedImages(prev => [...successful, ...prev]);
        if (mediumsToGenerate === selectedMediums) {
          setSelectedMediums(prev => prev.filter(m => rejected.some(rej => rej.medium === m)));
        }
      }

      if (rejected.length > 0) {
        setErrors(prev => [...prev, ...rejected]);
      } else if (mediumsToGenerate === selectedMediums) {
        setSelectedMediums([]);
      }

    } catch (err: any) {
      console.error("Batch processing error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const getErrorIcon = (type: DetailedError['type']) => {
    switch (type) {
      case 'rate': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'auth': return <Lock className="w-4 h-4 text-red-600" />;
      case 'safety': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'server': return <ZapOff className="w-4 h-4 text-gray-500" />;
      default: return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const downloadImage = (url: string, medium: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `mockup-${medium.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  };

  const handleShare = async (url: string, medium: string) => {
    if (navigator.share) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `mockup-${medium.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' });
        await navigator.share({
          title: `Brand Mockup: ${medium}`,
          files: [file]
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Error sharing:', err);
      }
    } else {
      alert('Sharing not supported on this browser. Try downloading!');
    }
  };

  const getAspectClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case "1:1": return "aspect-square";
      case "16:9": return "aspect-video";
      case "9:16": return "aspect-[9/16]";
      case "4:3": return "aspect-[4/3]";
      case "3:4": return "aspect-[3/4]";
      default: return "aspect-square";
    }
  };

  const buttonContent = useMemo(() => {
    if (!isGenerating) return <><Sparkles className="w-5 h-5" /><span>Generate Visualization</span></>;
    const pendingArray = Object.values(pendingStatuses) as GenerationStatus[];
    if (pendingArray.length === 0) return <><Loader2 className="w-5 h-5 animate-spin" /><span>Finalizing...</span></>;
    const avgProgress = Math.round(pendingArray.reduce((acc, curr) => acc + curr.progress, 0) / pendingArray.length);
    return (
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-0.5">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-bold uppercase tracking-tight">Processing {pendingArray.length} items...</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-300" style={{ width: `${avgProgress}%` }} />
          </div>
          <span className="text-[10px] opacity-80 font-mono">{avgProgress}%</span>
        </div>
      </div>
    );
  }, [isGenerating, pendingStatuses]);

  return (
    <div className="min-h-screen pb-20 selection:bg-indigo-100">
      <header className="sticky top-0 z-50 glass-morphism border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-200 shadow-lg">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">
              BrandVisualizer AI
            </h1>
          </div>
          {generatedImages.length > 0 && (
            <button 
              onClick={() => window.confirm('Clear all history?') && setGeneratedImages([])}
              className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 uppercase tracking-widest"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* 1. Upload */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">1. Brand Logo</h2>
              {!sourceImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                >
                  <Upload className="w-10 h-10 text-gray-300 group-hover:text-indigo-400 mx-auto mb-3" />
                  <p className="text-xs font-bold text-gray-500">Drop your design here</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-square flex items-center justify-center p-4">
                  <img src={sourceImage} alt="Source" className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => setSourceImage(null)} className="bg-white p-2.5 rounded-full text-red-500 shadow-lg hover:scale-110 transition-transform">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Presets & Controls */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <button onClick={() => setShowPresets(!showPresets)} className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                 <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                   <Bookmark className="w-4 h-4 text-amber-500" /> Saved Presets
                 </h2>
                 {showPresets ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
               </button>
               {showPresets && (
                 <div className="px-6 pb-6 space-y-4">
                   {presets.length > 0 ? (
                     <div className="grid grid-cols-1 gap-2">
                       {presets.map(p => (
                         <div key={p.id} onClick={() => loadPreset(p)} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-amber-50 rounded-xl cursor-pointer group border border-transparent hover:border-amber-200 transition-all">
                           <span className="text-xs font-bold text-gray-700">{p.name}</span>
                           <button onClick={(e) => { e.stopPropagation(); setPresets(prev => prev.filter(x => x.id !== p.id)); }} className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                         </div>
                       ))}
                     </div>
                   ) : <p className="text-[10px] text-gray-400 italic text-center">No presets yet</p>}
                   <div className="flex gap-2 pt-2 border-t border-gray-50">
                     <input type="text" placeholder="Preset name" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} className="flex-1 text-xs p-2 bg-gray-50 rounded-lg outline-none focus:ring-1 ring-amber-200" />
                     <button onClick={savePreset} disabled={!newPresetName.trim()} className="bg-amber-500 text-white p-2 rounded-lg disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                   </div>
                 </div>
               )}
            </section>

            {/* 2. Format */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">2. Canvas Ratio</h2>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setSelectedAspectRatio(ratio)}
                    className={`py-2 rounded-lg border-2 text-[10px] font-extrabold transition-all ${
                      selectedAspectRatio === ratio 
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' 
                        : 'border-gray-100 text-gray-500 bg-white hover:border-indigo-200'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Creative Controls */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-500" /> Creative Controls
                </h2>
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showAdvanced && (
                <div className="px-6 pb-6 space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <label>Creativity</label>
                      <span className="text-indigo-600">{temperature.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Diversity (Top-P)</label>
                      <input type="number" step="0.1" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg text-xs focus:ring-1 ring-indigo-200 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Predict (Top-K)</label>
                      <input type="number" value={topK} onChange={e => setTopK(parseInt(e.target.value))} className="w-full p-2 bg-gray-50 border border-transparent rounded-lg text-xs focus:ring-1 ring-indigo-200 outline-none" />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 4. Mediums */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">4. Media Targets</h2>
              <div className="grid grid-cols-2 gap-3">
                {MEDIUM_METADATA.map((medium) => {
                  const isSelected = selectedMediums.includes(medium.id);
                  const isPending = !!pendingStatuses[medium.id];
                  return (
                    <button
                      key={medium.id}
                      onClick={() => toggleMedium(medium.id)}
                      disabled={!sourceImage || isGenerating}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                          : 'border-gray-50 hover:border-indigo-100 text-gray-400 bg-white opacity-80'
                      } ${isPending ? 'animate-pulse' : ''}`}
                    >
                      {isSelected && !isPending && <div className="absolute top-1 right-1 bg-indigo-600 text-white p-0.5 rounded-full"><Check className="w-2.5 h-2.5" /></div>}
                      {medium.icon}
                      <span className="text-[10px] font-bold mt-2 uppercase tracking-tight">{medium.id}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              onClick={() => generateMockups()}
              disabled={!sourceImage || selectedMediums.length === 0 || isGenerating}
              className={`w-full py-5 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
                !sourceImage || selectedMediums.length === 0 || isGenerating ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {buttonContent}
            </button>

            {errors.length > 0 && (
              <div className="bg-red-50/50 border border-red-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-red-50 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-tight">System Issues</span>
                   </div>
                   <button onClick={() => setErrors([])} className="text-[10px] font-bold text-red-400 hover:text-red-600">DISMISS</button>
                </div>
                <div className="p-3 space-y-2 max-h-[250px] overflow-y-auto">
                   {errors.map((err, idx) => (
                     <div key={idx} className="bg-white p-2.5 rounded-xl border border-red-50 flex items-start gap-3 shadow-sm group">
                       <div className="mt-0.5">{getErrorIcon(err.type)}</div>
                       <div className="flex-1">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-700 uppercase">{err.medium}</span>
                            <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold uppercase">{err.type}</span>
                         </div>
                         <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{err.reason.split(':')[1] || err.reason}</p>
                       </div>
                       <button onClick={() => generateMockups([err.medium])} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
                     </div>
                   ))}
                   {errors.length > 1 && (
                     <button onClick={() => generateMockups(errors.map(e => e.medium))} className="w-full py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg mt-2 uppercase tracking-widest hover:bg-indigo-700 transition-colors">Retry All Failed</button>
                   )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">Mockup Feed</h2>
              <div className="flex items-center gap-3">
                {generatedImages.length > 0 && (
                  <>
                    <button 
                      onClick={handleDownloadAll}
                      disabled={isExporting}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-100 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {isExporting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Archive className="w-3 h-3" />
                      )}
                      {isExporting ? "Zipping..." : "Export All (.zip)"}
                    </button>
                    <button 
                      onClick={() => generateMockups(Array.from(new Set(generatedImages.map(i => i.medium))))}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 shadow-sm text-gray-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 active:scale-95 disabled:opacity-50"
                    >
                      <RotateCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                      Refresh All
                    </button>
                  </>
                )}
              </div>
            </div>

            {(generatedImages.length === 0 && Object.keys(pendingStatuses).length === 0) ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-inner">
                <div className="relative mb-6">
                   <div className="absolute inset-0 bg-indigo-100 blur-2xl opacity-40 animate-pulse"></div>
                   <ImageIcon className="w-16 h-16 text-gray-200 relative" />
                </div>
                <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest">Feed is Empty</h3>
                <p className="text-xs text-gray-300 mt-2 text-center max-w-xs px-8">Ready to visualize? Select your brand logo and pick a medium to start generating mockups.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {(Object.values(pendingStatuses) as GenerationStatus[]).map((status) => (
                  <div key={`pending-${status.medium}`} className={`group relative bg-indigo-50/20 rounded-3xl border border-indigo-50/50 flex flex-col items-center justify-center ${getAspectClass(selectedAspectRatio)}`}>
                    <div className="flex flex-col items-center p-8 w-full text-center">
                       <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6">
                         <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                       </div>
                       <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">{status.medium}</p>
                       <div className="w-full max-w-[140px] h-1.5 bg-indigo-100/50 rounded-full overflow-hidden mb-3">
                         <div className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${status.progress}%` }} />
                       </div>
                       <p className="text-[10px] font-bold text-indigo-300 italic">{status.message}</p>
                    </div>
                  </div>
                ))}

                {generatedImages.map((img) => (
                  <div key={img.id} className="group relative bg-white rounded-3xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-gray-50 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 hover:-translate-y-2">
                    <div className={`${getAspectClass(img.aspectRatio)} overflow-hidden bg-gray-50 relative`}>
                      <img src={img.url} alt={img.medium} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" loading="lazy" />
                      <div className="absolute top-4 left-4">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black text-green-600 border border-green-50 shadow-xl">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED GEN
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex items-center justify-between bg-white">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black text-gray-800 uppercase tracking-widest">{img.medium}</p>
                          <span className="text-[9px] px-2 py-0.5 bg-gray-50 text-gray-400 font-black rounded">{img.aspectRatio}</span>
                        </div>
                        <p className="text-[9px] text-gray-300 mt-1.5 font-bold flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleShare(img.url, img.medium)} className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"><Share2 className="w-4.5 h-4.5" /></button>
                        <button onClick={() => downloadImage(img.url, img.medium)} className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"><Download className="w-4.5 h-4.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 glass-morphism border-t border-gray-100 py-4 z-40">
        <div className="max-w-7xl mx-auto px-4 flex justify-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-[0.3em] font-black flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></span>
            Gemini Visual Core • Professional Render Active
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
