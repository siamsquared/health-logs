"use client";
import {useState, useEffect} from "react";
import {useAppSelector, useAppDispatch} from "@/lib/hooks";
import {updateProfileData} from "@/lib/features/auth/authSlice";
import {doc, updateDoc} from "firebase/firestore";
import {db} from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import {Save, Loader2, Calendar} from "lucide-react";
import {useRouter} from "next/navigation";
import {differenceInYears, parseISO} from "date-fns";

export default function ProfilePage() {
    const {user, status} = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const router = useRouter();

    const [formData, setFormData] = useState({birthDate: "", gender: "male", weight: "", height: ""});
    const [saving, setSaving] = useState(false);

    // State to track if the image failed to load
    const [imageError, setImageError] = useState(false);

    const calculateAge = (dateString: string) => {
        if (!dateString) return "-";
        try {
            return differenceInYears(new Date(), parseISO(dateString));
        } catch (e) {
            return "-";
        }
    };

    useEffect(() => {
        if (status === "unauthenticated") router.push("/");
    }, [status, router]);

    useEffect(() => {
        if (user) setFormData({
            birthDate: user.birthDate || "",
            gender: user.gender || "male",
            weight: user.weight?.toString() || "",
            height: user.height?.toString() || ""
        });
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        const payload = {
            birthDate: formData.birthDate,
            gender: formData.gender,
            weight: formData.weight ? Number(formData.weight) : null,
            height: formData.height ? Number(formData.height) : null
        };
        try {
            await updateDoc(doc(db, "users", user.uid), {
                profile: {
                    ...payload,
                    chronic_diseases: user.chronic_diseases || []
                }
            });
            dispatch(updateProfileData(payload));
            alert("บันทึกเรียบร้อย");
        } catch (error) {
            alert("Error");
        } finally {
            setSaving(false);
        }
    };

    if (status === "loading" || !user) return <div className="p-10 text-center text-gray-400">Loading...</div>;

    // Get first character of email for default avatar
    const emailInitial = user.email ? user.email.charAt(0).toUpperCase() : "?";

    return (
        <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans">
            <Navbar/>
            <div className="max-w-2xl mx-auto p-6 animate-fade-in-up">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">ข้อมูลส่วนตัว</h1>
                    <p className="text-gray-500 mt-2">ตั้งค่าข้อมูลพื้นฐาน</p>
                </div>

                <form onSubmit={handleSubmit}
                      className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-8">
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
                            <p className="font-bold text-lg text-gray-900">{user.displayName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600 flex justify-between">
                                วันเกิด {formData.birthDate && <span
                                className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">อายุ {calculateAge(formData.birthDate)}</span>}
                            </label>
                            <div className="relative">
                                <input type="date" value={formData.birthDate}
                                       onChange={e => setFormData({...formData, birthDate: e.target.value})}
                                       className="w-full p-4 pl-12 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800"/>
                                <Calendar className="absolute left-4 top-4 text-gray-400" size={20}/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">เพศ</label>
                            <select value={formData.gender}
                                    onChange={e => setFormData({...formData, gender: e.target.value})}
                                    className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800 appearance-none">
                                <option value="male">ชาย</option>
                                <option value="female">หญิง</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">น้ำหนัก (kg)</label>
                            <input type="number" value={formData.weight}
                                   onChange={e => setFormData({...formData, weight: e.target.value})}
                                   className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-600">ส่วนสูง (cm)</label>
                            <input type="number" value={formData.height}
                                   onChange={e => setFormData({...formData, height: e.target.value})}
                                   className="w-full p-4 bg-gray-50 border-transparent focus:bg-white border focus:border-black rounded-2xl outline-none transition font-medium text-gray-800"/>
                        </div>
                    </div>
                    <button type="submit" disabled={saving}
                            className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="animate-spin"/> : <Save size={20}/>} บันทึก
                    </button>
                </form>
            </div>
        </div>
    );
}