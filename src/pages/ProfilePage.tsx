import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import { Save, Loader2, Calendar, Edit2, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { differenceInYears, parseISO } from "date-fns";

export default function ProfilePage() {
    const { user, status } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({birthDate: "", gender: "male", weight: "", height: "", phoneNumber: "", displayName: ""});
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // State to track if the image failed to load
    const [imageError, setImageError] = useState(false);
    const [phoneError, setPhoneError] = useState("");

    const calculateAge = (dateString: string) => {
        if (!dateString) return "-";
        try {
            return differenceInYears(new Date(), parseISO(dateString));
        } catch (e) {
            return "-";
        }
    };

    const validatePhoneNumber = (phone: string) => {
        if (!phone) return true; // Allow empty? If required, change this. Assuming optional based on original code, but user asked for validation, likely implies correctness if present.
        // Rule: Start with 0 and be 10 digits
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
                displayName: user.displayName || ""
            });
        }
    };

    useEffect(() => {
        resetForm();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Validation
        if (formData.phoneNumber && !validatePhoneNumber(formData.phoneNumber)) {
            setPhoneError("เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 10 หลัก");
            return;
        }

        setSaving(true);
        const payload = {
            birthDate: formData.birthDate,
            gender: formData.gender,
            weight: formData.weight ? Number(formData.weight) : null,
            height: formData.height ? Number(formData.height) : null,
            phoneNumber: formData.phoneNumber
        };
        try {
            const userPayload: any = {
                displayName: formData.displayName,
                email: user.email,
                photoURL: user.photoURL,
                uid: user.uid,
                profile: {
                    ...payload,
                    chronic_diseases: user.chronic_diseases || [],
                    isProfileSetup: true
                }
            };

            if (!user.createdAt) {
                userPayload.createdAt = serverTimestamp();
            }

            await setDoc(doc(db, "users", user.uid), userPayload, { merge: true });
            // AuthContext listens to onSnapshot, so local user state will update automatically.
            alert("บันทึกเรียบร้อย");
            
            // Only reopen the review page (home) the first time profile is set up
            if (!user.isProfileSetup) {
                navigate({ to: '/' });
            }
        } catch (error) {
            alert("Error");
        } finally {
            setSaving(false);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        resetForm();
        setIsEditing(false);
        setPhoneError("");
    };

    if (status === "loading" || !user) return <div className="p-10 text-center text-gray-400">Loading...</div>;

    // Get first character of email for default avatar
    const emailInitial = user.email ? user.email.charAt(0).toUpperCase() : "?";

    return (
        <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans">
            <Navbar/>
            <div className="max-w-2xl mx-auto p-4 md:p-6 animate-fade-in-up">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">ข้อมูลส่วนตัว</h1>
                    <p className="text-gray-500 mt-2">ตั้งค่าข้อมูลพื้นฐาน</p>
                </div>

                <form onSubmit={handleSubmit}
                      className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-8">
                    <div className="flex items-center gap-4 pb-6 border-b border-gray-100">

                        {/* Logic to show Image or Default Avatar */}
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

                        <div>
                            <input type="text"
                                   value={formData.displayName}
                                   onChange={e => setFormData({...formData, displayName: e.target.value})}
                                   disabled={!isEditing}
                                   className="font-bold text-lg text-gray-900 bg-transparent border border-transparent rounded focus:bg-white focus:border-gray-200 outline-none transition disabled:opacity-100 disabled:cursor-text"
                                   placeholder="ชื่อของคุณ"/>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-full space-y-2">
                             <label className="text-sm font-medium text-gray-600">เบอร์มือถือ</label>
                             <input type="tel" value={formData.phoneNumber}
                                    onChange={e => {
                                        const value = e.target.value;
                                        // Allow only numbers
                                        if (!/^\d*$/.test(value)) return;
                                        
                                        setFormData({...formData, phoneNumber: value});
                                        if (phoneError) setPhoneError("");
                                    }}
                                    maxLength={10}
                                    placeholder="0xxxxxxxxx"
                                    className={`w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 ${phoneError ? "border-red-500 focus:border-red-500" : ""} disabled:opacity-60 disabled:cursor-not-allowed`}
                                    disabled={!isEditing} />
                             {phoneError && <p className="text-red-500 text-sm pl-1">{phoneError}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600 flex justify-between">
                                วันเกิด {formData.birthDate && <span
                                className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">อายุ {calculateAge(formData.birthDate)}</span>}
                            </label>
                            <div className="relative">
                                <input type="date" value={formData.birthDate}
                                       onChange={e => setFormData({...formData, birthDate: e.target.value})}
                                       className="w-full p-4 pl-12 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                       disabled={!isEditing}/>
                                <Calendar className="absolute left-4 top-4 text-gray-400" size={20}/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">เพศ</label>
                            <select value={formData.gender}
                                    onChange={e => setFormData({...formData, gender: e.target.value})}
                                    className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                    disabled={!isEditing}>
                                <option value="male">ชาย</option>
                                <option value="female">หญิง</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">น้ำหนัก (kg)</label>
                            <input type="number" value={formData.weight}
                                   onChange={e => setFormData({...formData, weight: e.target.value})}
                                   className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                   disabled={!isEditing}/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">ส่วนสูง (cm)</label>
                            <input type="number" value={formData.height}
                                   onChange={e => setFormData({...formData, height: e.target.value})}
                                   className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                   disabled={!isEditing}/>
                        </div>
                    </div>
                    
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button type="button" onClick={handleCancel}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2">
                                <X size={20}/> ยกเลิก
                            </button>
                            <button type="submit" disabled={saving}
                                    className="flex-1 bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                {saving ? <Loader2 className="animate-spin"/> : <Save size={20}/>} บันทึก
                            </button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setIsEditing(true)}
                                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2">
                            <Edit2 size={20}/> แก้ไขข้อมูล
                        </button>
                    )}

                </form>
            </div>
        </div>
    );
}
