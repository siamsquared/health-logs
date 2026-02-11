import { useEffect, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useHealthLogs } from "@/features/health/queries";
import Navbar from "@/components/Navbar";
import { normalizeMetricName } from "@/components/AnalysisResult";
import { TrendingUp } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatDate } from "@/lib/date";

// --- Highcharts Imports ---
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// --- Sub-Components ---

const CompareSkeleton = () => (
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
    if (compareLogs.length < 2) return <div className="text-center py-10 text-gray-400 bg-white rounded-[2rem] border border-dashed border-gray-100">ต้องมีประวัติอย่างน้อย 2 ครั้งเพื่อเปรียบเทียบ</div>;

    const allMetricNames = Array.from(new Set(
        compareLogs.flatMap(log =>
            log.analysis.health_stats?.map((s: any) => normalizeMetricName(s.name)) || []
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
                                <th key={log.id} className={`py-4 px-6 font-bold min-w-[140px] text-center align-middle ${i === 0 ? 'bg-blue-50/30 text-blue-900' : 'text-gray-400'}`}>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs uppercase tracking-wider mb-1 opacity-70">{i === 0 ? 'ล่าสุด' : 'ย้อนหลัง'}</span>
                                        <span className="text-sm">{formatDate(log.analysis?.examinationDate && log.analysis.examinationDate !== 'N/A' ? log.analysis.examinationDate : log.createdAt, 'D MMM BBBB')}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {Object.entries(groupedMetrics).map(([category, metrics]) => (
                            <div key={category} className="contents">
                                {/* Sticky Category */}
                                <tr className="bg-black">
                                    <td className="py-3 px-6 text-sm font-bold text-white sticky left-0 z-30 bg-black border-r border-gray-800 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)]">
                                        {category}
                                    </td>
                                    {/* Fill rest with black */}
                                    <td colSpan={compareLogs.length} className="bg-black"></td>
                                </tr>

                                {metrics.sort().map((metricName: string) => {
                                    const refRange = compareLogs.flatMap(log => log.analysis.health_stats || [])
                                        .find((s: any) => normalizeMetricName(s.name) === metricName)?.ref_range;

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
                                                const stat = log.analysis.health_stats?.find((s: any) => normalizeMetricName(s.name) === metricName);
                                                const isNormal = stat?.status === 'ปกติ';
                                                const isNA = !stat || stat.value === 'N/A';

                                                return (
                                                    <td key={log.id} className={`py-4 px-6 text-center align-middle ${i === 0 ? 'bg-blue-50/10' : ''}`}>
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
                            </div>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Main Page ---

export default function ComparePage() {
    const { user, status: authStatus } = useAuth();
    const { data: logs, isLoading: logsLoading } = useHealthLogs(user?.uid);
    const navigate = useNavigate();

    useEffect(() => { if (authStatus === "unauthenticated") navigate({ to: "/" }); }, [authStatus, navigate]);

    // --- Highcharts Logic ---
    const chartOptions = useMemo(() => {
        if (!logs || logs.length === 0) return {};

        const sortedLogs = [...logs].sort((a, b) => a.createdAt - b.createdAt);
        const categories = sortedLogs.map(log => {
            const dateValue = log.analysis?.examinationDate && log.analysis.examinationDate !== 'N/A'
                ? log.analysis.examinationDate
                : log.createdAt;
            return formatDate(dateValue, 'D MMM BBBB');
        });

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
                const stat = log.analysis.health_stats?.find((s: any) => normalizeMetricName(s.name) === metricName);
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

        const standardColors = [
            '#2563EB', '#DC2626', '#16A34A', '#EA580C', '#9333EA',
            '#DB2777', '#0891B2', '#EAB308', '#4F46E5', '#0D9488'
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
            colors: standardColors,
            credits: { enabled: false },
            legend: {
                itemStyle: { color: '#4B5563', fontWeight: 'normal', fontSize: '11px' },
                itemHoverStyle: { color: '#000000' }
            },
            series: series
        };
    }, [logs]);

    if (authStatus === "loading" || logsLoading) return <div className="min-h-screen bg-[#F5F5F7]"><Navbar /><CompareSkeleton /></div>;
    if (!user) return null;

    return (
        <div className="min-h-screen min-h-dvh bg-[#F5F5F7] text-gray-900 font-sans pb-32 md:pb-6">
            <Navbar />

            <div className="max-w-4xl mx-auto p-4 md:p-6 animate-fade-in">
                <div className="mb-4">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-1">เปรียบเทียบผลตรวจ</h1>
                    <p className="text-gray-500">ติดตามแนวโน้มสุขภาพของคุณจากการตรวจหลายครั้ง</p>
                </div>

                <div className="space-y-6 animate-fade-in-up">
                    {/* --- Highcharts Section --- */}
                    {((logs || []).length > 1) ? (
                        <>
                            <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-8">
                                    <div className="bg-blue-50 p-2 rounded-full text-blue-600"><TrendingUp size={20} /></div>
                                    <h2 className="font-bold text-lg text-gray-800">แนวโน้มสุขภาพ</h2>
                                </div>
                                <div className="w-full">
                                    <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                                </div>
                            </div>
                            <ComparisonTable logs={logs || []} />
                        </>
                    ) : (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-[2rem] border border-dashed border-gray-100">
                            ยังไม่มีข้อมูลเพียงพอสำหรับเปรียบเทียบ (ต้องการประวัติอย่างน้อย 2 ครั้ง)
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
