import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, facebookProvider, storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/features/auth/useAuth";
import Navbar from "@/components/Navbar";
import DisclaimerModal from "@/components/DisclaimerModal";
import AnalysisResult from "@/components/AnalysisResult";
import { Upload, Activity } from "lucide-react";
import { analyzeImage } from "@/services/ai";

export default function HomePage() {
    const { user, status, isDisclaimerAccepted, acceptDisclaimer } = useAuth();
    console.log('user :>> ', user);
    const isAuthenticated = status === "authenticated" && user;
    const isAuthLoading = status === "loading";

    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (e) {
            console.error(e);
        }
    };

    const handleFacebookLogin = async () => {
        try {
            await signInWithPopup(auth, facebookProvider);
        } catch (e) {
            console.error("Facebook Login Error:", e);
        }
    };

    const handleAgreeDisclaimer = () => {
        acceptDisclaimer();
    };

    const calculateAge = (birthDateString?: string | null) => {
        if (!birthDateString) return null;
        try {
            const birthDate = new Date(birthDateString);
            const ageDifMs = Date.now() - birthDate.getTime();
            const ageDate = new Date(ageDifMs);
            return Math.abs(ageDate.getUTCFullYear() - 1970);
        } catch (e) {
            return null;
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !isAuthenticated || !user) return;
        setProcessing(true);
        const file = e.target.files[0];

        try {
            const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            const profileData = {
                gender: user.gender || "ไม่ระบุ",
                age: calculateAge(user.birthDate) || "ไม่ระบุ",
                weight: user.weight || "ไม่ระบุ",
                height: user.height || "ไม่ระบุ"
            };

            // Call Client-side Service
            const data = await analyzeImage(url, profileData);
            
            const reportId = Date.now().toString();
            const nowTimestamp = Timestamp.now();

            await setDoc(doc(db, "users", user.uid, "reports", reportId), {
                imageUrl: url,
                analysis: data,
                createdAt: nowTimestamp,
                status: 1
            });
            
            // No need to dispatch anything. LogsPage will refetch if visited.

            setResult(data);

        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาดในการวิเคราะห์ หรือ API Key ไม่ถูกต้อง");
        } finally {
            setProcessing(false);
        }
    };

    if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] text-gray-400">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans text-gray-900">
            {isAuthenticated && <Navbar/>}
            {isAuthenticated && !isDisclaimerAccepted && <DisclaimerModal onAgree={handleAgreeDisclaimer}/>}

            <div
                className={`p-4 md:p-6 transition duration-500 ${isAuthenticated && !isDisclaimerAccepted ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="max-w-4xl mx-auto animate-fade-in">
                    {!isAuthenticated && (
                        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
                            <div className="w-24 h-24 bg-black text-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl">
                                <Activity size={48}/>
                            </div>
                            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 mb-6">AI Health
                                Check.</h1>
                            <p className="text-xl text-gray-500 max-w-lg mb-12 font-medium">เปลี่ยนผลตรวจสุขภาพที่เข้าใจยาก
                                ให้เป็นเรื่องง่ายด้วย AI</p>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleLogin}
                                        className="bg-black text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-800 hover:scale-105 transition shadow-lg">Start
                                    with Google
                                </button>
                                <button onClick={handleFacebookLogin}
                                        className="bg-[#1877F2] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#165dbb] hover:scale-105 transition shadow-lg">Start
                                    with Facebook
                                </button>

                            </div>
                        </div>
                    )}

                    {isAuthenticated && !result && !processing && (
                        <div className="mt-12 text-center">
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 tracking-tight">สวัสดี, {user?.displayName?.split(' ')[0]}</h2>
                            <p className="text-gray-500 mb-8 md:mb-12 text-base md:text-lg">สุขภาพวันนี้เป็นอย่างไรบ้าง?</p>
                            <div
                                className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-16 shadow-xl hover:shadow-2xl transition duration-500 max-w-xl mx-auto cursor-pointer group border border-gray-100 relative overflow-hidden">
                                <input type="file" onChange={handleFileUpload} accept="image/*" className="hidden"
                                       id="fileInput"/>
                                <label htmlFor="fileInput"
                                       className="cursor-pointer flex flex-col items-center gap-6 w-full h-full relative z-10">
                                    <div
                                        className="w-24 h-24 bg-[#F5F5F7] rounded-full flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition duration-500">
                                        <Upload size={40}/></div>
                                    <div><p className="text-2xl font-bold text-gray-900 mb-2">แตะเพื่ออัปโหลด</p><p
                                        className="text-gray-400 font-medium">รูปถ่ายใบผลตรวจสุขภาพ</p></div>
                                </label>
                            </div>
                        </div>
                    )}

                    {processing && (
                        <div className="max-w-xl mx-auto mt-20 text-center">
                            <div
                                className="animate-spin w-16 h-16 border-4 border-gray-200 border-t-black rounded-full mx-auto mb-8"></div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">AI กำลังวิเคราะห์...</h3>
                            <p className="text-gray-500">กำลังประมวลผลข้อมูลของคุณ</p>
                        </div>
                    )}

                    {result && isAuthenticated && (
                        <div className="mt-6 space-y-6 animate-fade-in-up">
                            <div className="flex justify-between items-center px-2">
                                <h3 className="text-2xl font-bold">ผลการตรวจ</h3>
                                <button onClick={() => setResult(null)}
                                        className="text-sm font-medium text-gray-500 hover:text-black transition">ปิดหน้านี้
                                </button>
                            </div>
                            <AnalysisResult data={result}/>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
