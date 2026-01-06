"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Activity, User, History, LogOut} from "lucide-react";
import {useAppDispatch} from "@/lib/hooks";
import {logout} from "@/lib/features/auth/authSlice";
import {clearLogs} from "@/lib/features/health/healthSlice";
import {signOut} from "firebase/auth";
import {auth} from "@/lib/firebase";

export default function Navbar() {
    const pathname = usePathname();
    const dispatch = useAppDispatch();

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem("health_app_disclaimer_accepted");
        dispatch(logout());
        dispatch(clearLogs());
    };

    const linkClass = (path: string) =>
        `flex items-center gap-2 px-4 py-2 rounded-full transition text-sm font-medium ${
            pathname === path ? "bg-black text-white" : "text-gray-500 hover:bg-gray-200"
        }`;

    return (
        <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 sticky top-0 z-50">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
                <Link href="/" className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="bg-black text-white p-1 rounded-lg">
                        <Activity size={18}/>
                    </div>
                    Health AI
                </Link>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full">
                    <Link href="/" className={linkClass("/")}>ตรวจใหม่</Link>
                    <Link href="/logs" className={linkClass("/logs")}>ประวัติ</Link>
                    <Link href="/profile" className={linkClass("/profile")}>โปรไฟล์</Link>
                </div>

                <button onClick={handleLogout}
                        className="hidden md:flex items-center gap-2 text-gray-400 hover:text-red-500 transition text-sm font-medium">
                    <LogOut size={16}/> ออกระบบ
                </button>
            </div>
        </nav>
    );
}