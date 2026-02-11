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
import ImagePreviewModal from "@/components/ImagePreviewModal";

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

const FacebookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

export default function HomePage() {
    const { user, status, isDisclaimerAccepted, acceptDisclaimer } = useAuth();
    const isAuthenticated = status === "authenticated" && user;
    const isAuthLoading = status === "loading";

    const [processing, setProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState("");
    const [result, setResult] = useState<any>(null);

    // Image Preview State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !isAuthenticated || !user) return;
        setSelectedFiles(Array.from(e.target.files));
        setIsPreviewOpen(true);
        e.target.value = "";
    };

    const handleUploadConfirm = async (files: File[]) => {
        setIsPreviewOpen(false);
        if (!files || files.length === 0 || !isAuthenticated || !user) return;

        setProcessing(true);
        setProcessingStatus(`กำลังเตรียมอัปโหลด ${files.length} รายการ...`);

        const profileData = {
            gender: user.gender || "ไม่ระบุ",
            age: calculateAge(user.birthDate) || "ไม่ระบุ",
            weight: user.weight || "ไม่ระบุ",
            height: user.height || "ไม่ระบุ",
            chronic_diseases: user.chronic_diseases || [],
            allergies: user.allergies || []
        };

        try {
            const uploadedUrls: string[] = [];

            // Upload all files first
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProcessingStatus(`กำลังอัปโหลดไฟล์ที่ ${i + 1}/${files.length}: ${file.name}`);

                const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                uploadedUrls.push(url);
            }

            // Analyze all images in one go
            setProcessingStatus(`กำลังประมวลผลข้อมูลจาก ${files.length} รูปภาพ...`);
            const data = await analyzeImage(uploadedUrls, profileData);

            const reportId = Date.now().toString();
            const nowTimestamp = Timestamp.now();

            await setDoc(doc(db, "users", user.uid, "reports", reportId), {
                imageUrls: uploadedUrls,    // Store all URLs
                analysis: data,
                createdAt: nowTimestamp,
                status: 1
            });

            setResult(data);
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setProcessing(false);
            setProcessingStatus("");
            setSelectedFiles([]);
        }
    };

    if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] text-gray-400">Loading...</div>;

    return (
        <div className="min-h-screen min-h-dvh bg-[#F5F5F7] text-gray-900 font-sans pb-32 md:pb-6">
            {isAuthenticated && <Navbar />}
            {isAuthenticated && !isDisclaimerAccepted && <DisclaimerModal onAgree={handleAgreeDisclaimer} />}

            <ImagePreviewModal
                isOpen={isPreviewOpen}
                files={selectedFiles}
                onClose={() => { setIsPreviewOpen(false); setSelectedFiles([]); }}
                onConfirm={handleUploadConfirm}
            />

            <div
                className={`p-4 md:p-6 transition duration-500 ${isAuthenticated && !isDisclaimerAccepted ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="max-w-4xl mx-auto animate-fade-in">
                    {!isAuthenticated && (
                        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
                            <div className="w-24 h-24 bg-black text-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl">
                                <Activity size={48} />
                            </div>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 font-sans">OneHealth</h1>
                            <p className="text-lg sm:text-xl text-gray-500 max-w-lg mb-10 sm:mb-12 font-medium px-4">เปลี่ยนผลตรวจสุขภาพที่เข้าใจยาก
                                ให้เป็นเรื่องง่ายด้วย AI</p>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleLogin}
                                    className="bg-black text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-800 hover:scale-105 transition shadow-lg flex items-center justify-center gap-3">
                                    <GoogleIcon />
                                    <span>Start with Google</span>
                                </button>
                                <button onClick={handleFacebookLogin}
                                    className="bg-[#1877F2] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-[#165dbb] hover:scale-105 transition shadow-lg flex items-center justify-center gap-3">
                                    <FacebookIcon />
                                    <span>Start with Facebook</span>
                                </button>

                            </div>
                        </div>
                    )}

                    {isAuthenticated && !result && !processing && (
                        <div className="mt-12 sm:mt-16 text-center">
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 tracking-tight">สวัสดี {user?.displayName?.split(' ')[0]}</h2>
                            <p className="text-gray-500 mb-12 sm:mb-16 text-base md:text-lg">สุขภาพวันนี้เป็นอย่างไรบ้าง?</p>
                            <div
                                className="bg-white rounded-[2rem] md:rounded-[3rem] p-8 sm:p-12 md:p-16 shadow-xl hover:shadow-2xl transition duration-500 max-w-xl mx-auto cursor-pointer group border border-gray-100 relative overflow-hidden">
                                <input type="file" onChange={handleFileSelect} accept="image/*" multiple className="hidden"
                                    id="fileInput" />
                                <label htmlFor="fileInput"
                                    className="cursor-pointer flex flex-col items-center gap-8 sm:gap-12 w-full h-full relative z-10">
                                    <div
                                        className="w-20 h-20 sm:w-24 sm:h-24 bg-[#F5F5F7] rounded-full flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition duration-500">
                                        <Upload size={32} className="sm:w-10 sm:h-10" /></div>
                                    <div className="text-center px-4">
                                        <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">แตะเพื่ออัปโหลด</p>
                                        <p className="text-sm sm:text-base text-gray-400 font-medium">รูปถ่ายใบผลตรวจสุขภาพ</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {processing && (
                        <div className="max-w-xl mx-auto mt-20 text-center">
                            <div
                                className="animate-spin w-16 h-16 border-4 border-gray-200 border-t-black rounded-full mx-auto mb-8"></div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">AI กำลังวิเคราะห์...</h3>
                            <p className="text-gray-500">{processingStatus || "กำลังประมวลผลข้อมูลของคุณ"}</p>
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
                            <AnalysisResult data={result} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
