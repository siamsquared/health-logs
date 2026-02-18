"use client";
import { FileText, Apple, Dumbbell } from "lucide-react";
import labMasterData from "@/data/metadata.json";

// ── Build lookup maps from metadata.json ──

const masterData = labMasterData.lab_master_data as Record<string, { category_name: string; items: any[] }>;

const aliasToDisplayName = new Map<string, string>();
const displayNameToCategory = new Map<string, string>();
const categoryOrder: string[] = [];

for (const group of Object.values(masterData)) {
    categoryOrder.push(group.category_name);

    for (const item of group.items) {
        const displayName: string = item.display_name;

        displayNameToCategory.set(displayName.toLowerCase(), group.category_name);

        aliasToDisplayName.set(displayName.toLowerCase(), displayName);
        for (const alias of item.aliases as string[]) {
            aliasToDisplayName.set(alias.toLowerCase(), displayName);
        }
    }
}

// ── Helpers ──

export const normalizeMetricName = (name: string): string => {
    const inputLower = name.trim().toLowerCase();

    // Exact match (case-insensitive)
    const exact = aliasToDisplayName.get(inputLower);
    if (exact) return exact;

    // Try with separators normalized (e.g. "HDL-C" vs "HDL C")
    const cleaned = inputLower.replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [alias, displayName] of aliasToDisplayName) {
        if (cleaned === alias.replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim()) {
            return displayName;
        }
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
};

export const getCategory = (normalizedName: string): string => {
    return displayNameToCategory.get(normalizedName.toLowerCase()) || 'อื่นๆ';
};

export { categoryOrder };

// ── Sub-Components ──

const ValueDisplay = ({ valueStr, isNormal }: { valueStr?: string | number | null, isNormal: boolean }) => {
    if (valueStr === null || valueStr === undefined || valueStr === 'N/A' || valueStr === '') {
        return <div className="text-3xl font-bold text-gray-200">N/A</div>;
    }
    const match = String(valueStr).match(/^([\d.]+)\s*(.*)$/);
    if (match && !isNaN(parseFloat(match[1]))) {
        const parts = match[1].split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const formattedNum = parts.join('.');
        return (
            <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${isNormal ? 'text-gray-900' : 'text-red-600'}`}>{formattedNum}</span>
                <span className={`text-sm font-medium ${isNormal ? 'text-gray-500' : 'text-red-400'}`}>{match[2]}</span>
            </div>
        );
    }
    return <div className={`text-xl font-bold truncate ${isNormal ? 'text-gray-900' : 'text-red-600'}`}>{String(valueStr)}</div>;
};

// ── Main Component ──

export default function AnalysisResult({ data, showAdvice = true, showSummary = true }: { data: any, showAdvice?: boolean, showSummary?: boolean }) {

    if (!data) return null;

    // Build empty groups from metadata category order
    const groupedStats: Record<string, any[]> = {};
    for (const cat of categoryOrder) {
        groupedStats[cat] = [];
    }

    data.health_stats?.forEach((stat: any) => {
        const normalizedName = normalizeMetricName(stat.name);
        // Use AI-provided category if present, otherwise derive from name
        const category = stat.category || getCategory(normalizedName);

        if (!groupedStats[category]) {
            groupedStats[category] = [];
        }
        groupedStats[category].push({ ...stat, name: normalizedName });
    });

    // Remove empty categories
    Object.keys(groupedStats).forEach(key => {
        if (groupedStats[key].length === 0) delete groupedStats[key];
    });

    return (
        <div className="space-y-8 animate-fade-in-up">

            {/* Summary Card */}
            {showSummary && (
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 flex items-center gap-3 relative z-10">
                        <div className="bg-black text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl"><FileText size={20} className="sm:w-6 sm:h-6" /></div>
                        สรุปผลภาพรวม
                    </h2>
                    <p className="text-gray-600 leading-relaxed text-base sm:text-lg relative z-10">{data.summary || "ไม่มีข้อมูลสรุป"}</p>
                </div>
            )}

            {/* Grouped Stats Loop */}
            <div className="space-y-8">
                {Object.entries(groupedStats).map(([category, stats]) => (
                    <div key={category}>
                        <h3 className="text-xl font-bold text-gray-800 mb-8 px-2 border-l-4 border-black pl-3">{category}</h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {stats.map((stat: any, i: number) => {
                                const isNA = stat.value === 'N/A';
                                const isNormal = stat.status === 'ปกติ' || stat.status === 'ไม่ระบุ' || isNA;

                                return (
                                    <div key={i}
                                        className={`p-6 rounded-[2rem] border transition duration-300 ${isNormal ? 'bg-white border-gray-100' : 'bg-red-50/50 border-red-100'}`}>
                                        <div className="flex justify-between mb-6">
                                            <span
                                                className="font-semibold text-gray-500 text-sm truncate pr-2 min-w-0">{stat.name}</span>
                                            <span
                                                className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide flex-shrink-0 ${isNA ? 'bg-gray-100 text-gray-400' :
                                                    isNormal ? 'bg-green-50 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                {stat.status}
                                            </span>
                                        </div>

                                        <ValueDisplay valueStr={stat.value} isNormal={isNormal} />

                                        {stat.normalRange && (stat.normalRange.min != null || stat.normalRange.max != null) && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                เกณฑ์: {stat.normalRange.min != null && stat.normalRange.max != null ? `${stat.normalRange.min} - ${stat.normalRange.max}` : stat.normalRange.min != null ? `≥ ${stat.normalRange.min}` : `≤ ${stat.normalRange.max}`}
                                                {stat.unit && stat.unit != null && <span>{stat.unit}</span>}
                                            </p>
                                        )}
                                        {stat.advice && !isNA && <p className="text-xs text-gray-500 mt-6 pt-6 border-t border-gray-100 line-clamp-2">{stat.advice}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Food & Advice */}
            {showAdvice && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-gray-200/50">
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-6 sm:mb-8 flex items-center gap-3 text-lg sm:text-xl">
                            <span className="bg-green-100 text-green-700 p-2 rounded-xl"><Apple
                                size={18} className="sm:w-5 sm:h-5" /></span> อาหารแนะนำ
                        </h3>
                        <ul className="space-y-6 sm:space-y-8">
                            {data.food_plan && Object.entries(data.food_plan).map(([meal, menu]: any, i) => (
                                <li key={i} className="flex gap-3 sm:gap-4 items-start">
                                    <span
                                        className="font-bold capitalize min-w-[2.5rem] sm:min-w-[3rem] text-xs sm:text-sm text-gray-400 mt-1">{meal}</span>
                                    <span className="text-gray-800 font-medium text-sm sm:text-base">{menu}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-6 sm:mb-8 flex items-center gap-3 text-lg sm:text-xl">
                            <span className="bg-orange-100 text-orange-700 p-2 rounded-xl"><Dumbbell
                                size={18} className="sm:w-5 sm:h-5" /></span> คำแนะนำ
                        </h3>
                        <p className="text-gray-600 leading-relaxed font-medium mb-6 sm:mb-8 text-sm sm:text-base">{data.exercise}</p>
                        {data.general_advice && (
                            <div className="pt-6 sm:pt-8 border-t border-gray-100">
                                <ul className="space-y-2">
                                    {data.general_advice.map((advice: string, k: number) => (
                                        <li key={k} className="text-xs sm:text-sm text-gray-500 flex gap-2 items-start">
                                            <span className="text-orange-400 mt-1">•</span> {advice}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
