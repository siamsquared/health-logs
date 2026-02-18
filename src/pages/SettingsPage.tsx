import { useState, useEffect, forwardRef, useRef } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, deleteObject } from "firebase/storage";
import Navbar from "@/components/Navbar";
import { Save, Loader2, Calendar, Edit2, X, ChevronDown, User, Database, Plus, Trash2, FileText, ChevronRight, Clock, MapPin, Hospital, Image as ImageIcon, Maximize2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { differenceInYears, parseISO, format, isValid, parse } from "date-fns";
import { th } from "date-fns/locale";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useHealthLogs, useUpdateLogAnalysis } from "@/features/health/queries";
import AnalysisResult, { normalizeMetricName, getCategory, categoryOrder } from "@/components/AnalysisResult";
import { formatDate } from "@/lib/date";
import { AnalysisData } from "@/features/health/api";
import { reAnalyzeFromData } from "@/services/ai";

registerLocale("th", th);

// --- Sub-components ---

const CustomDateInput = forwardRef(({ value, onClick, onChange, className, disabled, placeholder }: any, ref: any) => {
    const [displayValue, setDisplayValue] = useState(value || "");

    useEffect(() => {
        setDisplayValue(value || "");
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value.replace(/\D/g, "").slice(0, 8);
        if (input.length > 4) {
            input = `${input.slice(0, 2)}/${input.slice(2, 4)}/${input.slice(4)}`;
        } else if (input.length > 2) {
            input = `${input.slice(0, 2)}/${input.slice(2)}`;
        }
        setDisplayValue(input);

        const originalValue = e.target.value;
        e.target.value = input;
        onChange(e);
        e.target.value = originalValue;
    };

    return (
        <input
            ref={ref}
            value={displayValue}
            onClick={onClick}
            onChange={handleChange}
            className={className}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
        />
    );
});

const ReportModal = ({ log, userId, user, onClose }: { log: any, userId: string, user: any, onClose: () => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedAnalysis, setEditedAnalysis] = useState<AnalysisData | null>(null);
    const { mutate: updateAnalysis, isPending: isUpdating } = useUpdateLogAnalysis();
    const [isReAnalyzing, setIsReAnalyzing] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo(0, 0);
        }
    }, [isEditing]);


    useEffect(() => {
        if (log) {
            setEditedAnalysis(JSON.parse(JSON.stringify(log.analysis)));
        }
    }, [log]);

    if (!log || !editedAnalysis) return null;

    const imageUrls = log.imageUrls || (log.imageUrl ? [log.imageUrl] : []);

    const handleSave = async () => {
        if (!editedAnalysis) return;

        // If only 'ข้อมูลทั่วไป' (hospitalName/examinationDate) changed, skip AI and save directly
        const statsUnchanged = JSON.stringify(log.analysis.health_stats) === JSON.stringify(editedAnalysis.health_stats);
        if (statsUnchanged) {
            updateAnalysis({
                userId,
                logId: log.id,
                analysis: editedAnalysis
            }, {
                onSuccess: () => {
                    setIsEditing(false);
                    alert("บันทึกข้อมูลเรียบร้อย");
                },
                onError: (err) => {
                    alert("เกิดข้อผิดพลาด: " + (err as any).message);
                }
            });
            return;
        }

        // Build profile for AI re-analysis
        const age = user?.birthDate ? differenceInYears(new Date(), parseISO(user.birthDate)) : undefined;
        const profile = { gender: user?.gender, age, weight: user?.weight, height: user?.height, chronic_diseases: user?.chronic_diseases, allergies: user?.allergies };

        setIsReAnalyzing(true);
        try {
            // Run AI to re-calculate status, advice, summary, food_plan, exercise, general_advice
            const aiResult = await reAnalyzeFromData(editedAnalysis.health_stats, profile);

            // Merge AI results with edited analysis (keep hospitalName & examinationDate from user edits)
            const updatedAnalysis: AnalysisData = {
                ...editedAnalysis,
                summary: aiResult.summary || editedAnalysis.summary,
                health_stats: aiResult.health_stats || editedAnalysis.health_stats,
                food_plan: aiResult.food_plan,
                exercise: aiResult.exercise,
                general_advice: aiResult.general_advice,
            };

            updateAnalysis({
                userId,
                logId: log.id,
                analysis: updatedAnalysis
            }, {
                onSuccess: () => {
                    setIsEditing(false);
                    setIsReAnalyzing(false);
                    alert("บันทึกและวิเคราะห์ข้อมูลใหม่เรียบร้อย");
                },
                onError: (err) => {
                    setIsReAnalyzing(false);
                    alert("เกิดข้อผิดพลาด: " + (err as any).message);
                }
            });
        } catch (error) {
            setIsReAnalyzing(false);
            alert("เกิดข้อผิดพลาดในการวิเคราะห์ AI: " + (error as any).message);
        }
    };

    const handleStatChange = (index: number, field: string, value: string) => {
        if (!editedAnalysis) return;
        const newStats = [...editedAnalysis.health_stats];
        newStats[index] = { ...newStats[index], [field]: value };
        setEditedAnalysis({ ...editedAnalysis, health_stats: newStats });
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm animate-fade-in">

                <div className="bg-[#F5F5F7] w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-up border border-white/20">
                    <div className="p-5 sm:p-8 bg-white border-b border-gray-100 flex flex-col sm:flex-row gap-6 sm:items-center justify-between shrink-0">
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">รายละเอียดผลการตรวจ</h2>
                            <div className="text-gray-500 text-xs sm:text-sm mt-3 sm:mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(log.analysis?.examinationDate, 'D MMMM BBBB') || 'ไม่ระบุวันที่'}</span>
                                <span className="hidden sm:inline text-gray-300">•</span>
                                <span className="flex items-center gap-1"><MapPin size={12} /> {log.analysis?.hospitalName || 'ไม่ระบุโรงพยาบาล'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            {!isEditing ? (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition text-xs sm:text-sm shadow-sm"
                                >
                                    <Edit2 size={16} /> แก้ไขข้อมูล
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setIsEditing(false); setEditedAnalysis(JSON.parse(JSON.stringify(log.analysis))); }}
                                        disabled={isReAnalyzing || isUpdating}
                                        className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-bold transition text-xs sm:text-sm disabled:opacity-50"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={isUpdating || isReAnalyzing}
                                        className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl font-bold transition disabled:opacity-50 whitespace-nowrap text-xs sm:text-sm shadow-md"
                                    >
                                        {isReAnalyzing ? (
                                            <div key="reanalyzing-spinner" className="flex items-center gap-2">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>AI กำลังวิเคราะห์...</span>
                                            </div>
                                        ) : isUpdating ? (
                                            <div key="updating-spinner" className="flex items-center gap-2">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>กำลังบันทึก...</span>
                                            </div>
                                        ) : (
                                            <div key="update-idle" className="flex items-center gap-2">
                                                <Save size={16} />
                                                <span>บันทึก</span>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 sm:p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-500 hover:text-black shrink-0 shadow-sm"
                            >
                                <X size={20} className="sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>
                    <div ref={scrollRef} className="overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-[#F5F5F7] space-y-8 flex-1">

                        {isEditing ? (
                            (() => {
                                // Group stats by category (same logic as AnalysisResult)
                                const groupedStats: Record<string, { stat: any; originalIndex: number }[]> = {};
                                for (const cat of categoryOrder) {
                                    groupedStats[cat] = [];
                                }
                                editedAnalysis.health_stats.forEach((stat, idx) => {
                                    const normalizedName = normalizeMetricName(stat.name);
                                    const category = stat.category || getCategory(normalizedName);
                                    if (!groupedStats[category]) {
                                        groupedStats[category] = [];
                                    }
                                    groupedStats[category].push({ stat: { ...stat, name: normalizedName }, originalIndex: idx });
                                });
                                Object.keys(groupedStats).forEach(key => {
                                    if (groupedStats[key].length === 0) delete groupedStats[key];
                                });

                                return (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        {/* General Info Card - Hospital & Date */}
                                        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
                                            <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 flex items-center gap-3 relative z-10">
                                                <div className="bg-black text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl"><FileText size={20} className="sm:w-6 sm:h-6" /></div>
                                                ข้อมูลทั่วไป
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-xs sm:text-sm font-semibold text-gray-500 flex items-center gap-2">
                                                        <Hospital size={14} /> ชื่อโรงพยาบาล
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editedAnalysis.hospitalName || ""}
                                                        onChange={(e) => setEditedAnalysis({ ...editedAnalysis, hospitalName: e.target.value })}
                                                        className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 focus:border-black focus:bg-white rounded-2xl outline-none transition font-medium text-gray-800 text-sm"
                                                        placeholder="ระบุชื่อโรงพยาบาล"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs sm:text-sm font-semibold text-gray-500 flex items-center gap-2">
                                                        <Calendar size={14} /> วันที่รับการตรวจ
                                                    </label>
                                                    <DatePicker
                                                        selected={(() => {
                                                            const dateStr = editedAnalysis.examinationDate;
                                                            if (!dateStr) return null;
                                                            try {
                                                                let date = parse(dateStr, 'dd/MM/yyyy', new Date());
                                                                if (isValid(date)) return date;
                                                                date = parseISO(dateStr);
                                                                return isValid(date) ? date : null;
                                                            } catch (e) {
                                                                return null;
                                                            }
                                                        })()}
                                                        onChange={(date: Date | null) => {
                                                            if (date) {
                                                                setEditedAnalysis({
                                                                    ...editedAnalysis,
                                                                    examinationDate: format(date, 'dd/MM/yyyy')
                                                                });
                                                            }
                                                        }}
                                                        dateFormat="dd/MM/yyyy"
                                                        locale="th"
                                                        className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 focus:border-black focus:bg-white rounded-2xl outline-none transition font-medium text-gray-800 text-sm"
                                                        placeholderText="เลือกวันที่ (วว/ดด/ปปปป)"
                                                        showYearDropdown
                                                        scrollableYearDropdown
                                                        yearDropdownItemNumber={100}
                                                        portalId="root"
                                                        popperClassName="!z-[200]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Grouped Stats - Same layout as AnalysisResult */}
                                        <div className="space-y-8">
                                            {Object.entries(groupedStats).map(([category, items]) => (
                                                <div key={category}>
                                                    <h3 className="text-xl font-bold text-gray-800 mb-8 px-2 border-l-4 border-black pl-3">{category}</h3>
                                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                        {items.map(({ stat, originalIndex }) => {
                                                            const parseValue = (val: string) => {
                                                                if (!val || val === "N/A") return { num: val || "", unit: "" };
                                                                const match = val.match(/^([\d,.-]+)\s*(.*)$/);
                                                                if (match) return { num: match[1], unit: match[2].trim() };
                                                                return { num: val, unit: "" };
                                                            };
                                                            const { num, unit } = parseValue(stat.value);

                                                            return (
                                                                <div key={originalIndex}
                                                                    className="p-6 rounded-[2rem] border transition duration-300 bg-white border-gray-100">
                                                                    <div className="mb-4">
                                                                        <span className="font-semibold text-gray-500 text-sm truncate pr-2">{stat.name}</span>
                                                                    </div>

                                                                    {/* Editable value */}
                                                                    <div className="flex items-baseline gap-2 mb-2">
                                                                        <input
                                                                            type={stat.type}
                                                                            value={num}
                                                                            onChange={(e) => {
                                                                                const newNum = e.target.value;
                                                                                handleStatChange(originalIndex, 'value', unit ? `${newNum} ${unit}` : newNum);
                                                                            }}
                                                                            className="text-3xl font-bold bg-transparent border-b-2 border-dashed outline-none transition w-full text-gray-900 border-gray-200 focus:border-black"
                                                                            placeholder="—"
                                                                        />
                                                                        {unit && (
                                                                            <span className="text-sm font-medium flex-shrink-0 text-gray-500">{unit}</span>
                                                                        )}
                                                                    </div>

                                                                    {stat.normalRange && (stat.normalRange.min != null || stat.normalRange.max != null) && (
                                                                        <p className="text-xs text-gray-400 mt-1">
                                                                            เกณฑ์: {stat.normalRange.min != null && stat.normalRange.max != null ? `${stat.normalRange.min} - ${stat.normalRange.max}` : stat.normalRange.min != null ? `≥ ${stat.normalRange.min}` : `≤ ${stat.normalRange.max}`}
                                                                            {stat.unit && <span> {stat.unit}</span>}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <AnalysisResult data={log.analysis} showAdvice={false} showSummary={false} />
                        )}

                        {imageUrls.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-gray-200/50">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <ImageIcon size={16} /> รูปภาพใบตรวจ ({imageUrls.length})
                                </h3>
                                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x no-scrollbar">
                                    {imageUrls.map((url: string, index: number) => (
                                        <div
                                            key={index}
                                            onClick={() => setZoomedImage(url)}
                                            className="relative group shrink-0 w-40 h-56 md:w-48 md:h-64 rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-zoom-in snap-start"
                                        >
                                            <img
                                                src={url}
                                                alt={`Check-up report ${index + 1}`}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <div className="bg-white/90 p-2 rounded-full opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all">
                                                    <Maximize2 size={20} className="text-black" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
                    onClick={() => setZoomedImage(null)}
                >
                    <img
                        src={zoomedImage}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-up"
                        alt="Zoomed report"
                    />
                    <button
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition text-white"
                        onClick={() => setZoomedImage(null)}
                    >
                        <X size={28} />
                    </button>
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-sm font-medium bg-black/40 px-4 py-2 rounded-full border border-white/10">
                        คลิกที่ไหนก็ได้เพื่อปิด
                    </div>
                </div>
            )}
        </>
    );
};


// --- Main Page ---

export default function SettingsPage() {
    const { user, status } = useAuth();
    const navigate = useNavigate();
    const { data: logs, isLoading: logsLoading } = useHealthLogs(user?.uid);

    const [activeTab, setActiveTab] = useState<'profile' | 'metadata'>('profile');
    const [selectedLog, setSelectedLog] = useState<any>(null);

    const [formData, setFormData] = useState({
        birthDate: "",
        gender: "male",
        weight: "",
        height: "",
        phoneNumber: "",
        displayName: "",
        chronic_diseases: [] as string[],
        allergies: [] as string[]
    });

    const [newDisease, setNewDisease] = useState("");
    const [newAllergy, setNewAllergy] = useState("");

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [imageError, setImageError] = useState(false);
    const [phoneError, setPhoneError] = useState("");
    const [birthDateError, setBirthDateError] = useState("");
    const [weightError, setWeightError] = useState("");
    const [heightError, setHeightError] = useState("");

    // Delete confirmation modal state
    const [logToDelete, setLogToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const calculateAge = (dateString: string) => {
        if (!dateString) return "-";
        try {
            return differenceInYears(new Date(), parseISO(dateString));
        } catch (e) {
            return "-";
        }
    };

    // Delete log function
    const handleDeleteLog = async () => {
        if (!logToDelete || !user) return;

        setIsDeleting(true);
        try {
            // Delete associated storage files
            const imageUrls = logToDelete.imageUrls || (logToDelete.imageUrl ? [logToDelete.imageUrl] : []);

            for (const url of imageUrls) {
                try {
                    // Extract file path from URL
                    const filePathMatch = url.match(/\/o\/(.+?)\?/);
                    if (filePathMatch) {
                        const filePath = decodeURIComponent(filePathMatch[1]);
                        const fileRef = ref(storage, filePath);
                        await deleteObject(fileRef);
                    }
                } catch (error) {
                    console.error("Error deleting file:", error);
                    // Continue even if file deletion fails
                }
            }

            // Delete Firestore document
            await deleteDoc(doc(db, "users", user.uid, "reports", logToDelete.id));

            // Close modal if deleted log was selected
            if (selectedLog?.id === logToDelete.id) {
                setSelectedLog(null);
            }

            alert("ลบรายงานเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Error deleting log:", error);
            alert("เกิดข้อผิดพลาดในการลบรายงาน กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsDeleting(false);
            setLogToDelete(null);
        }
    };

    const validatePhoneNumber = (phone: string) => {
        if (!phone) return true;
        const phoneRegex = /^0\d{9}$/;
        return phoneRegex.test(phone);
    };

    useEffect(() => {
        if (status === "unauthenticated") navigate({ to: "/" });
    }, [status, navigate]);

    const resetForm = () => {
        if (user) {
            setFormData({
                birthDate: user.birthDate || "",
                gender: user.gender || "male",
                weight: user.weight?.toString() || "",
                height: user.height?.toString() || "",
                phoneNumber: user.phoneNumber || "",
                displayName: user.displayName || "",
                chronic_diseases: user.chronic_diseases || [],
                allergies: user.allergies || []
            });
        }
    };

    useEffect(() => {
        resetForm();
    }, [user]);

    // Keep selectedLog in sync with latest data
    useEffect(() => {
        if (selectedLog && logs) {
            const updatedLog = logs.find(l => l.id === selectedLog.id);
            if (updatedLog) {
                setSelectedLog(updatedLog);
            }
        }
    }, [logs]);

    const handleAddDisease = () => {
        if (newDisease.trim()) {
            setFormData(prev => ({
                ...prev,
                chronic_diseases: [...prev.chronic_diseases, newDisease.trim()]
            }));
            setNewDisease("");
        }
    };

    const handleRemoveDisease = (index: number) => {
        setFormData(prev => ({
            ...prev,
            chronic_diseases: prev.chronic_diseases.filter((_, i) => i !== index)
        }));
    };

    const handleAddAllergy = () => {
        if (newAllergy.trim()) {
            setFormData(prev => ({
                ...prev,
                allergies: [...prev.allergies, newAllergy.trim()]
            }));
            setNewAllergy("");
        }
    };

    const handleRemoveAllergy = (index: number) => {
        setFormData(prev => ({
            ...prev,
            allergies: prev.allergies.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        let hasError = false;

        if (!formData.phoneNumber) {
            setPhoneError("กรุณาระบุเบอร์มือถือ");
            hasError = true;
        } else if (!validatePhoneNumber(formData.phoneNumber)) {
            setPhoneError("เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 10 หลัก");
            hasError = true;
        }

        if (!formData.birthDate) {
            setBirthDateError("กรุณาระบุวันเกิด");
            hasError = true;
        } else {
            const today = new Date().toISOString().split("T")[0];
            if (formData.birthDate > today) {
                setBirthDateError("วันเกิดต้องไม่เป็นวันที่ในอนาคต");
                hasError = true;
            }
        }

        if (!formData.weight) {
            setWeightError("กรุณาระบุน้ำหนัก");
            hasError = true;
        } else if (Number(formData.weight) <= 0) {
            setWeightError("น้ำหนักต้องมากกว่า 0");
            hasError = true;
        }

        if (!formData.height) {
            setHeightError("กรุณาระบุส่วนสูง");
            hasError = true;
        } else if (Number(formData.height) <= 0) {
            setHeightError("ส่วนสูงต้องมากกว่า 0");
            hasError = true;
        }

        if (hasError) {
            setActiveTab('profile');
            return;
        }

        setSaving(true);
        const profilePayload = {
            birthDate: formData.birthDate,
            gender: formData.gender,
            weight: formData.weight ? Number(formData.weight) : null,
            height: formData.height ? Number(formData.height) : null,
            phoneNumber: formData.phoneNumber,
            chronic_diseases: formData.chronic_diseases,
            allergies: formData.allergies,
            isProfileSetup: true
        };

        try {
            const userPayload: any = {
                displayName: formData.displayName,
                email: user.email,
                photoURL: user.photoURL,
                uid: user.uid,
                profile: profilePayload
            };

            if (!user.createdAt) {
                userPayload.createdAt = serverTimestamp();
            }

            await setDoc(doc(db, "users", user.uid), userPayload, { merge: true });
            alert("บันทึกเรียบร้อย");

            if (!user.isProfileSetup) {
                navigate({ to: '/' });
            }
        } catch (error) {
            alert("Error: " + (error as any).message);
        } finally {
            setSaving(false);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        resetForm();
        setIsEditing(false);
        setPhoneError("");
        setBirthDateError("");
        setWeightError("");
        setHeightError("");
        setNewDisease("");
        setNewAllergy("");
    };

    if (status === "loading" || !user) return <div className="p-10 text-center text-gray-400">Loading...</div>;

    const emailInitial = user.email ? user.email.charAt(0).toUpperCase() : "?";

    return (
        <div className="min-h-screen min-h-dvh bg-[#F5F5F7] text-gray-900 font-sans pb-32 md:pb-6">
            <Navbar />
            <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in-up">
                <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">ตั้งค่า</h1>
                    <p className="text-sm sm:text-base text-gray-500">จัดการข้อมูลส่วนตัวและข้อมูลสุขภาพ</p>
                </div>

                <div className="flex bg-gray-200/50 p-1 rounded-2xl sm:p-1.5 mb-6">
                    <button
                        onClick={() => { setActiveTab('profile'); setIsEditing(false); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <User size={16} className="sm:w-[18px] sm:h-[18px]" />
                        ข้อมูลส่วนตัว
                    </button>
                    <button
                        onClick={() => { setActiveTab('metadata'); setIsEditing(false); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'metadata' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Database size={16} className="sm:w-[18px] sm:h-[18px]" />
                        ข้อมูลสุขภาพ
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                    {activeTab === 'profile' ? (
                        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                                {user.photoURL && !imageError ? (
                                    <img
                                        src={user.photoURL}
                                        onError={() => setImageError(true)}
                                        className="w-16 h-16 rounded-full border-2 border-white shadow-md object-cover"
                                        alt="Profile"
                                    />
                                ) : (
                                    <div
                                        className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500">
                                        {emailInitial}
                                    </div>
                                )}

                                <div className="flex-1">
                                    <input type="text"
                                        value={formData.displayName}
                                        onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                        disabled={!isEditing}
                                        className="font-bold text-lg text-gray-900 bg-transparent border border-transparent rounded focus:bg-white focus:border-gray-200 outline-none transition disabled:opacity-100 disabled:cursor-text w-full mb-2"
                                        placeholder="ชื่อของคุณ" />
                                    <p className="text-sm text-gray-500">{user.email}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-full space-y-2">
                                    <label className="text-sm font-medium text-gray-600">เบอร์มือถือ</label>
                                    <input type="tel" value={formData.phoneNumber}
                                        onChange={e => {
                                            const digitValue = e.target.value.replace(/\D/g, "");
                                            const cappedValue = digitValue.slice(0, 10);
                                            setFormData({ ...formData, phoneNumber: cappedValue });
                                            if (phoneError) setPhoneError("");
                                        }}
                                        placeholder="0xxxxxxxxx"
                                        className={`w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 ${phoneError ? "border-red-500 focus:border-red-500" : ""} disabled:opacity-60 disabled:cursor-not-allowed`}
                                        disabled={!isEditing} />
                                    {phoneError && <p className="text-red-500 text-sm pl-1">{phoneError}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600 flex justify-between">
                                        วันเกิด {formData.birthDate && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">อายุ {calculateAge(formData.birthDate)} ปี</span>}
                                    </label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={formData.birthDate ? parseISO(formData.birthDate) : null}
                                            onChange={(date: Date | null, event?: React.SyntheticEvent<any>) => {
                                                if (date && isValid(date)) {
                                                    const year = date.getFullYear();
                                                    const isCompleteTyped = event && (event.target as HTMLInputElement).value?.length === 10;
                                                    const isPicked = !event;

                                                    if (isPicked || isCompleteTyped || year > 1900) {
                                                        const value = format(date, "yyyy-MM-dd");
                                                        setFormData({ ...formData, birthDate: value });
                                                        setBirthDateError("");
                                                    }
                                                }
                                                else if (event) {
                                                    const target = event.target as HTMLInputElement;
                                                    if (target.value === "") {
                                                        setFormData({ ...formData, birthDate: "" });
                                                    }
                                                }
                                            }}
                                            maxDate={new Date()}
                                            disabled={!isEditing}
                                            dateFormat="dd/MM/yyyy"
                                            placeholderText="วว/ดด/ปปปป"
                                            locale="th"
                                            autoComplete="off"
                                            className={`w-full p-4 pl-12 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 ${birthDateError ? "border-red-500 focus:border-red-500" : ""} disabled:opacity-60 disabled:cursor-not-allowed`}
                                            wrapperClassName="w-full"
                                            customInput={<CustomDateInput />}
                                            portalId="root"
                                        />
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" size={20} />
                                    </div>
                                    {birthDateError && <p className="text-red-500 text-sm pl-1">{birthDateError}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">เพศ</label>
                                    <div className="relative">
                                        <select value={formData.gender}
                                            onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                            className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                            disabled={!isEditing}>
                                            <option value="male">ชาย</option>
                                            <option value="female">หญิง</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">น้ำหนัก (kg)</label>
                                    <input type="number" value={formData.weight}
                                        min="1"
                                        step="any"
                                        onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === "" || Number(val) > 0) {
                                                setFormData({ ...formData, weight: val });
                                            }
                                            if (weightError) setWeightError("");
                                        }}
                                        className={`w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 ${weightError ? "border-red-500 focus:border-red-500" : ""} disabled:opacity-60 disabled:cursor-not-allowed`}
                                        disabled={!isEditing} />
                                    {weightError && <p className="text-red-500 text-sm pl-1">{weightError}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">ส่วนสูง (cm)</label>
                                    <input type="number" value={formData.height}
                                        min="1"
                                        step="any"
                                        onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === "" || Number(val) > 0) {
                                                setFormData({ ...formData, height: val });
                                            }
                                            if (heightError) setHeightError("");
                                        }}
                                        className={`w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 ${heightError ? "border-red-500 focus:border-red-500" : ""} disabled:opacity-60 disabled:cursor-not-allowed`}
                                        disabled={!isEditing} />
                                    {heightError && <p className="text-red-500 text-sm pl-1">{heightError}</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {isEditing ? (
                                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <span className="p-2 bg-red-50 text-red-500 rounded-lg"><Database size={20} /></span>
                                            โรคประจำตัว
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.chronic_diseases.length > 0 ? (
                                                formData.chronic_diseases.map((disease, index) => (
                                                    <div key={index} className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-sm font-medium">
                                                        {disease}
                                                        <button type="button" onClick={() => handleRemoveDisease(index)} className="text-gray-400 hover:text-red-500 transition">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-gray-400 text-sm italic">ไม่มีข้อมูลโรคประจำตัว</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <input
                                                type="text"
                                                value={newDisease}
                                                onChange={(e) => setNewDisease(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDisease())}
                                                placeholder="เพิ่มโรคประจำตัว..."
                                                className="flex-1 p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddDisease}
                                                className="bg-black text-white p-4 rounded-2xl hover:bg-gray-800 transition shadow-sm"
                                            >
                                                <Plus size={24} />
                                            </button>
                                        </div>
                                    </div>

                                    <hr className="border-gray-100" />

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <span className="p-2 bg-orange-50 text-orange-500 rounded-lg"><X size={20} /></span>
                                            ประวัติแพ้ยา/อาหาร
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.allergies.length > 0 ? (
                                                formData.allergies.map((allergy, index) => (
                                                    <div key={index} className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-sm font-medium">
                                                        {allergy}
                                                        <button type="button" onClick={() => handleRemoveAllergy(index)} className="text-gray-400 hover:text-red-500 transition">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-gray-400 text-sm italic">ไม่มีข้อมูลการแพ้</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <input
                                                type="text"
                                                value={newAllergy}
                                                onChange={(e) => setNewAllergy(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllergy())}
                                                placeholder="เพิ่มประวัติความแพ้..."
                                                className="flex-1 p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddAllergy}
                                                className="bg-black text-white p-4 rounded-2xl hover:bg-gray-800 transition shadow-sm"
                                            >
                                                <Plus size={24} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-2">
                                        <h3 className="bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold text-gray-900 border border-gray-100 shadow-sm flex items-center gap-2">
                                            <Database size={16} /> ข้อมูลจากรายงานผลตรวจ
                                        </h3>
                                    </div>

                                    {logsLoading ? (
                                        <div className="p-12 text-center text-gray-400 bg-white rounded-[2rem] border border-dashed border-gray-200">
                                            <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                                            <p className="font-medium">กำลังโหลดข้อมูล...</p>
                                        </div>
                                    ) : logs && logs.length > 0 ? (
                                        <div className="grid gap-4">
                                            {logs.map((log: any) => (
                                                <div
                                                    key={log.id}
                                                    className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                                                >
                                                    <div className="flex justify-between items-start mb-8">
                                                        <div
                                                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:scale-[0.98] transition-transform"
                                                            onClick={() => setSelectedLog(log)}
                                                        >
                                                            <div className="p-3 bg-gray-50 rounded-2xl text-black group-hover:bg-black group-hover:text-white transition-colors duration-300 shrink-0">
                                                                <FileText size={20} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                                                                    <Clock size={14} className="text-gray-400 shrink-0" />
                                                                    <span className="truncate">{formatDate(log.analysis?.examinationDate || log.createdAt, 'D MMMM BBBB')}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mt-0.5">
                                                                    <MapPin size={12} className="shrink-0" />
                                                                    <span className="truncate">{log.analysis?.hospitalName || 'ไม่ระบุโรงพยาบาล'}</span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-300 mt-1">
                                                                    บันทึกเมื่อ {formatDate(log.createdAt, 'D MMM BBBB HH:mm')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setLogToDelete(log);
                                                                }}
                                                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-all hover:scale-110"
                                                                title="ลบรายงาน"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                            <div
                                                                className="bg-gray-50 p-2 rounded-full text-gray-300 group-hover:text-black group-hover:bg-gray-100 transition-all cursor-pointer"
                                                                onClick={() => setSelectedLog(log)}
                                                            >
                                                                <ChevronRight size={20} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p
                                                        className="text-gray-600 text-sm leading-relaxed line-clamp-2 italic cursor-pointer"
                                                        onClick={() => setSelectedLog(log)}
                                                    >
                                                        {log.analysis?.summary || 'ไม่มีข้อมูลสรุป'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-gray-400 bg-white rounded-[2rem] border border-dashed border-gray-200">
                                            ยังไม่มีข้อมูลรายงานผลตรวจสุขภาพ
                                        </div>
                                    )}

                                    {/* Show manual metadata summary even when not editing if it exists */}
                                    {(formData.chronic_diseases.length > 0 || formData.allergies.length > 0) && (
                                        <div className="mt-8 pt-8 border-t border-gray-200/50 space-y-4">
                                            <h3 className="bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold text-gray-900 border border-gray-100 shadow-sm inline-flex items-center gap-2">
                                                <Database size={16} /> รายการข้อมูลสุขภาพที่บันทึกไว้
                                            </h3>
                                            <div className="grid gap-4">
                                                {formData.chronic_diseases.length > 0 && (
                                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                                                        <label className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 block">โรคประจำตัว</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {formData.chronic_diseases.map((d, i) => (
                                                                <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm font-medium">{d}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {formData.allergies.length > 0 && (
                                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                                                        <label className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 block">ประวัติแพ้ยา/อาหาร</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {formData.allergies.map((a, i) => (
                                                                <span key={i} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">{a}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {isEditing ? (
                        <div className="flex gap-4">
                            <button type="button" onClick={handleCancel}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2">
                                <X size={20} /> ยกเลิก
                            </button>
                            <button type="submit" disabled={saving}
                                className="flex-1 bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap">
                                {saving ? (
                                    <div key="saving-spinner" className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>กำลังบันทึก...</span>
                                    </div>
                                ) : (
                                    <div key="save-idle" className="flex items-center gap-2">
                                        <Save size={20} />
                                        <span>บันทึก</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    ) : (
                        activeTab === 'profile' && (
                            <button type="button" onClick={() => setIsEditing(true)}
                                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2">
                                <Edit2 size={20} /> แก้ไขข้อมูลส่วนตัว
                            </button>
                        )
                    )}
                </form>
            </div>

            {/* Modal for detail view */}
            {selectedLog && <ReportModal log={selectedLog} userId={user.uid} user={user} onClose={() => setSelectedLog(null)} />}

            {/* Delete Confirmation Modal */}
            {logToDelete && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-6 sm:p-8 animate-scale-up">
                        <div className="flex items-center justify-center mb-4 sm:mb-6">
                            <div className="p-3 sm:p-4 bg-red-50 rounded-full">
                                <Trash2 size={28} className="text-red-600 sm:w-8 sm:h-8" />
                            </div>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-2 sm:mb-3">ยืนยันการลบรายงาน</h2>
                        <p className="text-sm sm:text-base text-gray-600 text-center mb-1 sm:mb-2">
                            คุณแน่ใจหรือไม่ว่าต้องการลบรายงานผลตรวจสุขภาพนี้?
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 text-center mb-4 sm:mb-6">
                            วันที่: {formatDate(logToDelete.analysis?.examinationDate || logToDelete.createdAt, 'D MMMM BBBB')}
                        </p>
                        <p className="text-[10px] sm:text-xs text-red-600 text-center mb-6 font-medium">
                            ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้ และจะลบรูปภาพที่เกี่ยวข้องทั้งหมด
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setLogToDelete(null)}
                                disabled={isDeleting}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-bold transition disabled:opacity-50 text-sm sm:text-base"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteLog}
                                disabled={isDeleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap text-sm sm:text-base"
                            >
                                {isDeleting ? (
                                    <div key="deleting-spinner" className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={16} />
                                        <span>กำลังลบ...</span>
                                    </div>
                                ) : (
                                    <div key="delete-idle" className="flex items-center gap-2">
                                        <Trash2 size={16} />
                                        <span>ลบรายงาน</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
