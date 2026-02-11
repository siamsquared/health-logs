import { Link } from "@tanstack/react-router";
import { Activity, LogOut, PlusCircle, History, BarChart2, Settings } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Navbar() {
    const handleLogout = async () => {
        if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
            await signOut(auth);
            localStorage.removeItem("health_app_disclaimer_accepted");
        }
    };

    const navItems = [
        { to: "/", label: "ตรวจใหม่", icon: PlusCircle },
        { to: "/logs", label: "ประวัติ", icon: History },
        { to: "/compare", label: "เปรียบเทียบ", icon: BarChart2 },
        { to: "/settings", label: "ตั้งค่า", icon: Settings },
    ];

    return (
        <>
            {/* Top Navigation / Header */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-3 sm:py-4 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <Link to="/" className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <div className="bg-black text-white p-1 rounded-lg">
                            <Activity size={18} />
                        </div>
                        <span className="hidden sm:inline">OneHealth</span>
                    </Link>

                    {/* Desktop Pill Navigation */}
                    <div className="hidden md:flex items-center gap-1 bg-gray-200/50 p-1 rounded-full border border-gray-200/50">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-bold text-gray-400 hover:text-gray-900 hover:bg-white"
                                activeProps={{ className: "bg-black text-white hover:bg-black shadow-lg scale-105" }}
                            >
                                <item.icon size={16} />
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition text-sm font-bold"
                    >
                        <LogOut size={18} />
                        <span className="hidden sm:inline">ออกจากระบบ</span>
                    </button>
                </div>
            </nav>

            {/* Bottom Tab Bar (Mobile Only - iOS 26 High-Tech Style) */}
            <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm z-[100] animate-in fade-in slide-in-from-bottom-6 duration-700">
                <nav className="bg-[#1C1C1E]/85 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] px-3 py-2 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                    <div className="flex justify-around items-center h-12 relative">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-500 relative group"
                                activeProps={{ className: "text-white scale-110" }}
                                inactiveProps={{ className: "text-[#8E8E93]" }}
                            >
                                <item.icon size={20} className="transition-transform duration-300 group-active:scale-90" />
                                <span className="text-[10px] font-bold tracking-tight text-center">{item.label}</span>

                                {/* Futuristic Indicator: Subtle light glow when active */}
                                <div className="absolute -bottom-1.5 w-1 h-1 bg-white rounded-full opacity-0 group-[.active]:opacity-100 transition-all duration-500 shadow-[0_0_8px_white]" />
                            </Link>
                        ))}
                    </div>
                </nav>
            </div>
        </>
    );
}