import { useState, useEffect, forwardRef } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import { Save, Loader2, Calendar, Edit2, X, ChevronDown, User, Database, Plus, Trash2, FileText, ChevronRight, Clock, MapPin } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { differenceInYears, parseISO, format, isValid } from "date-fns";
import { th } from "date-fns/locale";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useHealthLogs } from "@/features/health/queries";
import AnalysisResult from "@/components/AnalysisResult";
import { formatDate } from "@/lib/date";

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

const ReportModal = ({ log, onClose }: { log: any, onClose: () => void }) => {
    if (!log) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#F5F5F7] w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-up">
                <div className="p-6 md:p-8 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">รายละเอียดผลการตรวจ</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {formatDate(log.analysis?.examinationDate || log.createdAt, 'D MMMM BBBB')} • {log.analysis?.hospitalName || 'ไม่ระบุโรงพยาบาล'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-500 hover:text-black"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <AnalysisResult data={log.analysis} />
                </div>
            </div>
        </div>
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

    const calculateAge = (dateString: string) => {
        if (!dateString) return "-";
        try {
            return differenceInYears(new Date(), parseISO(dateString));
        } catch (e) {
            return "-";
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
        <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans pb-20">
            <Navbar />
            <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in-up">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">ตั้งค่า</h1>
                    <p className="text-gray-500 mt-2">จัดการข้อมูลส่วนตัวและข้อมูลสุขภาพ</p>
                </div>

                <div className="flex bg-gray-200/50 p-1.5 rounded-2xl mb-6">
                    <button
                        onClick={() => { setActiveTab('profile'); setIsEditing(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <User size={18} />
                        ข้อมูลส่วนตัว
                    </button>
                    <button
                        onClick={() => { setActiveTab('metadata'); setIsEditing(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'metadata' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Database size={18} />
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
                                        className="font-bold text-lg text-gray-900 bg-transparent border border-transparent rounded focus:bg-white focus:border-gray-200 outline-none transition disabled:opacity-100 disabled:cursor-text w-full"
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
                                                    onClick={() => setSelectedLog(log)}
                                                    className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]"
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-3 bg-gray-50 rounded-2xl text-black group-hover:bg-black group-hover:text-white transition-colors duration-300">
                                                                <FileText size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                                                                    <Clock size={14} className="text-gray-400" />
                                                                    {formatDate(log.analysis?.examinationDate || log.createdAt, 'D MMMM BBBB')}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mt-0.5">
                                                                    <MapPin size={12} />
                                                                    {log.analysis?.hospitalName || 'ไม่ระบุโรงพยาบาล'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-gray-50 p-2 rounded-full text-gray-300 group-hover:text-black group-hover:bg-gray-100 transition-all">
                                                            <ChevronRight size={20} />
                                                        </div>
                                                    </div>
                                                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 italic">
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
                                className="flex-1 bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} บันทึก
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
            {selectedLog && <ReportModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
}
