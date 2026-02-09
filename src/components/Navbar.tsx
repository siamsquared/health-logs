import { Link } from "@tanstack/react-router";
import { Activity, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Navbar() {
    const handleLogout = async () => {
        if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
            await signOut(auth);
            localStorage.removeItem("health_app_disclaimer_accepted");
            // AuthContext handles state update via onAuthStateChanged
        }
    };
    // TanStack Router Link supports activeProps/inactiveProps but simplifies "nav link" styling with [&.active] or props.
    // However, for advanced styling based on active state, we can use the `activeProps` or rely on data attributes if configured.
    // Actually, simple className conditionally is easiest if we don't have direct access.
    // TanStack Router Links automatically get `data-status="active"` when active.

    return (
        <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 sticky top-0 z-50">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
                <div className="w-full md:w-auto flex justify-between items-center">
                    <Link to="/" className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <div className="bg-black text-white p-1 rounded-lg">
                            <Activity size={18} />
                        </div>
                        OneHealth
                    </Link>

                    <button onClick={handleLogout}
                        className="flex md:hidden items-center gap-2 text-gray-400 hover:text-red-500 transition text-sm font-medium">
                        <LogOut size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full overflow-x-auto max-w-full">
                    <Link to="/" className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition text-sm font-medium text-gray-500 hover:bg-gray-200" activeProps={{ className: "bg-black text-white hover:bg-black" }}>
                        ตรวจใหม่
                    </Link>
                    <Link to="/logs" className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition text-sm font-medium text-gray-500 hover:bg-gray-200" activeProps={{ className: "bg-black text-white hover:bg-black" }}>
                        ประวัติ
                    </Link>
                    <Link to="/compare" className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition text-sm font-medium text-gray-500 hover:bg-gray-200" activeProps={{ className: "bg-black text-white hover:bg-black" }}>
                        เปรียบเทียบ
                    </Link>
                    <Link to="/profile" className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition text-sm font-medium text-gray-500 hover:bg-gray-200" activeProps={{ className: "bg-black text-white hover:bg-black" }}>
                        โปรไฟล์
                    </Link>
                </div>

                <button onClick={handleLogout}
                    className="hidden md:flex items-center gap-2 text-gray-400 hover:text-red-500 transition text-sm font-medium">
                    <LogOut size={16} /> ออกจากระบบ
                </button>
            </div>
        </nav>
    );
}