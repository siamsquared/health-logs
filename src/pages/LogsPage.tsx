import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useHealthLogs, useUpdateLogDate, useDeleteLog } from "@/features/health/queries";
import Navbar from "@/components/Navbar";
import AnalysisResult, { normalizeMetricName } from "@/components/AnalysisResult";
import { TrendingUp, ChevronRight, Clock, Trash2, Edit2, Save, X, LayoutGrid, BarChart2, AlertCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatDate } from "@/lib/date";

// --- Highcharts Imports ---
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// --- Sub-Components ---

const LogsSkeleton = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-pulse">
        <div className="bg-gray-200 h-12 w-full rounded-xl mb-6"></div>
        <div className="bg-gray-200 h-[400px] w-full rounded-[2.5rem]"></div>
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="bg-gray-200 h-24 w-full rounded-[1.5rem]"></div>)}</div>
    </div>
);

const getCategory = (normalizedName: string) => {
    const n = normalizedName.toLowerCase();
    if (n === 'blood sugar' || n === 'hba1c' || n.includes('glucose')) return 'น้ำตาลในเลือด';
    if (['bun', 'creatinine', 'egfr'].includes(n)) return 'การทำงานของไต';
    if (n === 'uric acid') return 'กรดยูริค';
    if (['cholesterol', 'triglyceride', 'hdl-c', 'ldl-c'].includes(n)) return 'ระดับไขมันในเลือด';
    if (['sgot', 'sgpt', 'alk-phos'].includes(n)) return 'การทำงานของตับ';
    return 'อื่นๆ';
};

const TableValueDisplay = ({ valueStr, isNormal }: { valueStr: string, isNormal: boolean }) => {
    const match = valueStr.match(/^([\d.]+)\s*(.*)$/);
    if (match) {
        return (
            <div className="flex items-baseline justify-center gap-1">
                <span className={`text-base ${isNormal ? 'text-gray-900 font-normal' : 'text-red-600 font-medium'}`}>{match[1]}</span>
                <span className="text-[10px] text-gray-400 font-light">{match[2]}</span>
            </div>
        );
    }
    return <span className={`text-sm ${isNormal ? 'text-gray-900' : 'text-red-600 font-medium'}`}>{valueStr}</span>;
};

// --- Comparison Table ---
const ComparisonTable = ({ logs }: { logs: any[] }) => {
    const compareLogs = [...logs];
    if (compareLogs.length < 2) return <div className="text-center py-10 text-gray-400">ต้องมีประวัติอย่างน้อย 2 ครั้งเพื่อเปรียบเทียบ</div>;

    const allMetricNames = Array.from(new Set(
        compareLogs.flatMap(log =>
            log.analysis.health_stats?.map((s:any) => normalizeMetricName(s.name)) || []
        )
    ));

    const groupedMetrics: Record<string, string[]> = {
        'น้ำตาลในเลือด': [],
        'การทำงานของไต': [],
        'กรดยูริค': [],
        'ระดับไขมันในเลือด': [],
        'การทำงานของตับ': []
    };

    allMetricNames.forEach(name => {
        const category = getCategory(name);
        if (groupedMetrics[category]) {
            groupedMetrics[category].push(name);
        }
    });

    Object.keys(groupedMetrics).forEach(key => {
        if (groupedMetrics[key].length === 0) delete groupedMetrics[key];
    });

    return (
        <div className="bg-white rounded-[2rem] shadow-sm mb-6 border border-gray-100 overflow-hidden animate-fade-in relative">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
                    <thead>
                    <tr className="bg-white border-b border-gray-100">
                        {/* Sticky Header Column */}
                        <th className="py-4 pl-6 pr-4 font-bold text-gray-900 min-w-[160px] sticky left-0 bg-white z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] border-r border-gray-50">
                            รายการตรวจ
                        </th>
                        {compareLogs.map((log, i) => (
                            <th key={log.id} className={`py-4 px-6 font-bold min-w-[140px] text-center align-middle ${i===0 ? 'bg-blue-50/30 text-blue-900' : 'text-gray-400'}`}>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs uppercase tracking-wider mb-1 opacity-70">{i === 0 ? 'ล่าสุด' : 'ย้อนหลัง'}</span>
                                    <span className="text-sm">{formatDate(log.createdAt, 'D MMM BB')}</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                    {Object.entries(groupedMetrics).map(([category, metrics]) => (
                        <>
                            {/* Sticky Category */}
                            <tr key={category} className="bg-black">
                                <td className="py-3 px-6 text-sm font-bold text-white sticky left-0 z-30 bg-black border-r border-gray-800 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)]">
                                    {category}
                                </td>
                                {/* Fill rest with black */}
                                <td colSpan={compareLogs.length} className="bg-black"></td>
                            </tr>

                            {metrics.sort().map((metricName: string) => {
                                const refRange = compareLogs.flatMap(log => log.analysis.health_stats || [])
                                    .find((s:any) => normalizeMetricName(s.name) === metricName)?.ref_range;

                                return (
                                    <tr key={metricName} className="hover:bg-gray-50/50 transition group">
                                        {/* Sticky Row Title */}
                                        <td className="py-4 pl-6 pr-4 bg-white group-hover:bg-gray-50/50 sticky left-0 z-10 border-r border-gray-50 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
                                            <div className="font-medium text-gray-700">{metricName}</div>
                                            {refRange && (
                                                <div className="text-[10px] text-gray-400 font-light mt-0.5">
                                                    เกณฑ์: {refRange}
                                                </div>
                                            )}
                                        </td>
                                        {compareLogs.map((log, i) => {
                                            const stat = log.analysis.health_stats?.find((s:any) => normalizeMetricName(s.name) === metricName);
                                            const isNormal = stat?.status === 'ปกติ';
                                            const isNA = !stat || stat.value === 'N/A';

                                            return (
                                                <td key={log.id} className={`py-4 px-6 text-center align-middle ${i===0 ? 'bg-blue-50/10' : ''}`}>
                                                    {stat && !isNA ? (
                                                        <TableValueDisplay valueStr={stat.value} isNormal={isNormal} />
                                                    ) : (
                                                        <span className="text-gray-300 text-lg">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Main Page ---

export default function LogsPage() {
    const { user, status: authStatus } = useAuth();
    const { data: logs, isLoading: logsLoading } = useHealthLogs(user?.uid);
    const deleteLogMutation = useDeleteLog();
    const updateLogDateMutation = useUpdateLogDate();

    const navigate = useNavigate();

    const [activeLogId, setActiveLogId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'detail' | 'compare'>('detail');
    const [isEditing, setIsEditing] = useState(false);
    const [editDate, setEditDate] = useState("");

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

    // --- Highcharts Logic ---
    const chartOptions = useMemo(() => {
        if (!logs || logs.length === 0) return {};

        const sortedLogs = [...logs].sort((a, b) => a.createdAt - b.createdAt);
        const categories = sortedLogs.map(log => formatDate(log.createdAt, 'D MMM BB'));

        const metricSet = new Set<string>();
        sortedLogs.forEach(log => {
            log.analysis.health_stats?.forEach((stat: any) => {
                const name = normalizeMetricName(stat.name);
                const category = getCategory(name);
                if (category !== 'อื่นๆ' && stat.value && stat.value !== 'N/A') {
                    const numValue = parseFloat(stat.value.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numValue)) metricSet.add(name);
                }
            });
        });

        const series = Array.from(metricSet).map(metricName => {
            const data = sortedLogs.map(log => {
                const stat = log.analysis.health_stats?.find((s:any) => normalizeMetricName(s.name) === metricName);
                if (stat && stat.value && stat.value !== 'N/A') {
                    const numValue = parseFloat(stat.value.replace(/[^0-9.]/g, ''));
                    return isNaN(numValue) ? null : numValue;
                }
                return null;
            });
            return {
                name: metricName,
                data,
                marker: { enabled: false, symbol: 'circle' }
            };
        });

        const pastelColors = [
            '#A0C4FF', '#FFADAD', '#CAFFBF', '#FDFFB6', '#BDB2FF',
            '#FFC6FF', '#9BF6FF', '#FFD6A5', '#E4C1F9', '#D0F4DE'
        ];

        return {
            chart: {
                type: 'spline',
                backgroundColor: 'transparent',
                style: { fontFamily: 'inherit' }
            },
            title: { text: undefined },
            xAxis: {
                categories: categories,
                crosshair: true,
                lineColor: '#E5E7EB',
                labels: {
                    style: { color: '#9CA3AF', fontSize: '11px' },
                    autoRotation: [-45]
                }
            },
            yAxis: {
                title: { text: null },
                gridLineColor: '#F3F4F6',
                labels: { style: { color: '#9CA3AF' } }
            },
            tooltip: {
                shared: true,
                useHTML: true,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 12,
                shadow: true,
                borderWidth: 0,
                padding: 8,
                style: { color: '#374151', fontSize: '10px' },
                formatter: function (this: any) {
                    const headerDate = (this.points && this.points[0]) ? this.points[0].key : this.x;
                    let s = `<div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; color: #111827;">${headerDate}</div>`;

                    const groups: Record<string, any[]> = {};
                    this.points.forEach((point: any) => {
                        const category = getCategory(point.series.name);
                        if (!groups[category]) groups[category] = [];
                        groups[category].push(point);
                    });

                    const categoryOrder = [
                        'น้ำตาลในเลือด', 'การทำงานของไต', 'กรดยูริค', 'ระดับไขมันในเลือด', 'การทำงานของตับ'
                    ];

                    categoryOrder.forEach(cat => {
                        if (groups[cat]) {
                            s += `<div style="margin-top: 4px; font-weight: bold; color: #9CA3AF; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #F3F4F6; padding-bottom: 2px; margin-bottom: 2px;">${cat}</div>`;
                            groups[cat].forEach((p: any) => {
                                s += `<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px;">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <span style="color:${p.series.color}; font-size: 10px;">●</span>
                                        <span style="color: #4B5563; font-size: 10px;">${p.series.name}</span>
                                    </div>
                                    <span style="font-weight: bold; color: #111827; font-size: 11px;">${p.y}</span>
                                  </div>`;
                            });
                        }
                    });
                    return s;
                }
            },
            plotOptions: {
                series: {
                    marker: { enabled: false, states: { hover: { enabled: true } } },
                    lineWidth: 3
                }
            },
            colors: pastelColors,
            credits: { enabled: false },
            legend: {
                itemStyle: { color: '#4B5563', fontWeight: 'normal', fontSize: '11px' },
                itemHoverStyle: { color: '#000000' }
            },
            series: series
        };
    }, [logs]);

    const handleSelectLog = (logId: string) => { setActiveLogId(logId); setIsEditing(false); setActiveTab('detail'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const startEdit = () => { if (!activeLog?.createdAt) return; setActiveLogId(activeLog.id); setEditDate(new Date(activeLog.createdAt).toLocaleDateString('en-CA')); setIsEditing(true); };
    
    const saveDate = async () => { 
        if (!user || !editDate || !activeLog) return; 
        updateLogDateMutation.mutate({ userId: user.uid, logId: activeLog.id, newDate: new Date(editDate).getTime() });
        setIsEditing(false); 
    };
    
    const handleDelete = async () => { 
        if (!confirm("ยืนยันการลบ?")) return; 
        if (!user || !activeLog) return; 
        deleteLogMutation.mutate({ userId: user.uid, logId: activeLog.id });
    };

    if (authStatus === "loading" || logsLoading) return <div className="min-h-screen bg-[#F5F5F7]"><Navbar /><LogsSkeleton /></div>;
    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#F5F5F7] text-gray-900 font-sans">
            <Navbar />

            <div className="max-w-4xl mx-auto p-6 animate-fade-in">

                {/* Header */}
                {activeLog && activeLog.createdAt && (
                    <div className="mb-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-gray-900">ผลการตรวจ</h1>
                                <div className="mt-2 flex items-center gap-3">
                                    <Clock size={16} className="text-gray-500"/>
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 animate-fade-in">
                                            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-black outline-none" />
                                            <button onClick={saveDate} className="bg-green-600 text-white p-1.5 rounded-lg hover:bg-green-700 transition"><Save size={14}/></button>
                                            <button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-600 p-1.5 rounded-lg hover:bg-gray-300 transition"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500">ประจำวันที่ {formatDate(activeLog.createdAt, 'D MMMM YYYY')}</span>
                                    )}
                                </div>
                            </div>
                            {!isEditing && (
                                <div className="flex gap-2">
                                    <button onClick={startEdit} className="p-2 bg-white border border-gray-200 text-gray-500 rounded-full hover:bg-gray-50 hover:text-black transition shadow-sm"><Edit2 size={16}/></button>
                                    <button onClick={handleDelete} className="p-2 bg-red-50 border border-red-100 text-red-500 rounded-full hover:bg-red-100 hover:text-red-600 transition shadow-sm"><Trash2 size={16}/></button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Menu */}
                <div className="bg-gray-200/50 p-1 rounded-2xl flex gap-1 mb-8 max-w-md">
                    <button onClick={() => setActiveTab('detail')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'detail' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}><LayoutGrid size={16}/> รายละเอียด</button>
                    <button onClick={() => setActiveTab('compare')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'compare' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}><BarChart2 size={16}/> เปรียบเทียบ</button>
                </div>

                {/* Content */}
                {activeLog ? (
                    <div className="mb-12">
                        {activeTab === 'detail' && <AnalysisResult data={activeLog.analysis} />}
                        {activeTab === 'compare' && (
                            <div className="space-y-6 animate-fade-in-up">
                                {/* --- Highcharts Section --- */}
                                {((logs || []).length > 1) && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="bg-blue-50 p-2 rounded-full text-blue-600"><TrendingUp size={20}/></div>
                                            <h2 className="font-bold text-lg text-gray-800">แนวโน้มสุขภาพ</h2>
                                        </div>
                                        <div className="w-full">
                                            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                                        </div>
                                    </div>
                                )}

                                <ComparisonTable logs={logs || []} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-400 bg-white rounded-[2rem] border border-dashed border-gray-200 mb-12">ยังไม่มีข้อมูลประวัติการตรวจ</div>
                )}

                {/* --- History List --- */}
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6 px-2">ประวัติย้อนหลัง</h3>
                    <div className="space-y-4">
                        {(logs || []).map((log) => {
                            if (!log || !log.createdAt) return null;
                            const isActive = activeLog?.id === log.id;

                            const abnormalStats = log.analysis?.health_stats?.filter((s: any) => {
                                const name = normalizeMetricName(s.name);
                                const category = getCategory(name);
                                return s.status === 'ผิดปกติ' && category !== 'อื่นๆ';
                            }) || [];

                            return (
                                <div key={log.id} onClick={() => handleSelectLog(log.id)} className={`p-5 rounded-[1.5rem] transition cursor-pointer flex items-center justify-between group border ${isActive ? 'bg-black text-white shadow-lg ring-2 ring-offset-2 ring-gray-200 border-black' : 'bg-white text-gray-900 shadow-sm hover:shadow-md border-transparent hover:border-gray-200'}`}>
                                    <div className="flex items-center gap-5 overflow-hidden w-full">
                                        <div className={`w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-90'}`}>
                                            <img src={log.imageUrl} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className={`font-bold text-lg truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                                ผลการตรวจ {formatDate(log.createdAt, 'D MMM BB')}
                                            </h3>

                                            <p className={`text-sm truncate mb-1 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
                                                {log.analysis?.summary || "ไม่มีข้อมูลสรุป"}
                                            </p>

                                            {abnormalStats.length > 0 && (
                                                <div className={`flex flex-wrap items-center gap-1.5 mt-2 text-xs font-bold ${isActive ? 'text-red-300' : 'text-red-500'}`}>
                                                    <div className="flex items-center gap-1 whitespace-nowrap">
                                                        <AlertCircle size={12} strokeWidth={3} />
                                                        <span>ผิดปกติ {abnormalStats.length} :</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {abnormalStats.map((stat:any, i:number) => (
                                                            <span key={i} className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${isActive ? 'bg-red-900/40 text-red-200 border-red-800' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {normalizeMetricName(stat.name)}
                                                </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`${isActive ? 'text-white' : 'text-gray-300'} transition flex-shrink-0 pl-2`}><ChevronRight /></div>
                                </div>
                            )})}
                    </div>
                </div>

            </div>
        </div>
    );
}
