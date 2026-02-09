import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useHealthLogs } from "@/features/health/queries";
import Navbar from "@/components/Navbar";
import AnalysisResult from "@/components/AnalysisResult";
import { ChevronDown, Clock, LayoutGrid } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/date";

// --- Sub-Components ---

const LogsSkeleton = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-pulse">
        <div className="bg-gray-200 h-12 w-full rounded-xl mb-6"></div>
        <div className="bg-gray-200 h-[400px] w-full rounded-[2.5rem]"></div>
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="bg-gray-200 h-24 w-full rounded-[1.5rem]"></div>)}</div>
    </div>
);

// --- Main Page ---

export default function LogsPage() {
    const { user, status: authStatus } = useAuth();
    const { data: logs, isLoading: logsLoading } = useHealthLogs(user?.uid);

    const navigate = useNavigate();

    const [activeLogId, setActiveLogId] = useState<string | null>(null);

    useEffect(() => { if (authStatus === "unauthenticated") navigate({ to: "/" }); }, [authStatus, navigate]);

    // Auto-select first log logic
    const activeLog = useMemo(() => {
        if (!logs || logs.length === 0) return null;
        if (activeLogId) {
            const found = logs.find(l => l.id === activeLogId);
            if (found) return found;
        }
        return logs[0];
    }, [logs, activeLogId]);

    const handleSelectLog = (logId: string) => { setActiveLogId(logId); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    if (authStatus === "loading" || logsLoading) return <div className="min-h-screen bg-[#F5F5F7]"><Navbar /><LogsSkeleton /></div>;
    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans">
            <Navbar />

            <div className="max-w-4xl mx-auto p-4 md:p-6 animate-fade-in">

                {/* Header Section: Identity of the record */}
                {activeLog && activeLog.createdAt && (
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">ผลการตรวจ</h1>
                        <div className="flex flex-col gap-2 text-gray-500">
                            <span className="flex items-center gap-1.5 text-sm">
                                📅 วันที่รับการตรวจ {formatDate(activeLog.analysis?.examinationDate, 'D MMMM BBBB')}
                                {(() => {
                                    const examDate = activeLog.analysis?.examinationDate;
                                    if (!examDate || examDate === 'N/A') return null;
                                    const rel = formatRelativeTime(examDate);
                                    return rel ? ` (${rel})` : "";
                                })()}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm">
                                🏥 โรงพยาบาล {activeLog.analysis.hospitalName}
                            </span>
                        </div>
                    </div>
                )}

                {/* Control Row: Switcher for different records */}
                {logs && logs.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6 mb-6 border-y border-gray-200/60 bg-white/30 -mx-4 px-4 md:mx-0 md:rounded-2xl md:px-6">
                        <div className="flex items-center gap-2 text-gray-900">
                            <LayoutGrid size={18} className="text-black" />
                            <span className="text-sm font-bold uppercase tracking-wide">ภาพรวมสุขภาพ</span>
                        </div>

                        <div className="relative group w-full md:w-72">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-black transition-colors">
                                <Clock size={16} />
                            </div>
                            <select
                                value={activeLog?.id || ''}
                                onChange={(e) => handleSelectLog(e.target.value)}
                                className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-10 pr-10 rounded-2xl hover:border-gray-400 transition-all shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/5 text-sm font-medium"
                            >
                                {logs.map((log) => {
                                    const dateValue = log.analysis?.examinationDate && log.analysis.examinationDate !== 'N/A'
                                        ? log.analysis.examinationDate
                                        : log.createdAt;
                                    return (
                                        <option key={log.id} value={log.id}>
                                            รอบวันที่ {formatDate(dateValue, 'D MMM BBBB')}
                                        </option>
                                    );
                                })}
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-black transition-colors pointer-events-none">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                {activeLog ? (
                    <div className="mb-12">
                        <AnalysisResult data={activeLog.analysis} />
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-400 bg-white rounded-[2rem] border border-dashed border-gray-200 mb-12">ยังไม่มีข้อมูลประวัติการตรวจสุขภาพ</div>
                )}


                {/* Footer Metadata */}
                {activeLog && (
                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-400 font-medium">บันทึกข้อมูลเมื่อ {formatDateTime(activeLog.createdAt)} น.</p>
                    </div>
                )}
            </div >
        </div >
    );
}
