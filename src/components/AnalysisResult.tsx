"use client";
import {FileText, Apple, Dumbbell} from "lucide-react";

// --- Helpers & Sub-Components ---

export const normalizeMetricName = (name: string) => {
    const n = name.toLowerCase().trim().replace('.', '').replace('-', ' ');
    if (n.includes('sugar') || n.includes('glucose') || n.includes('fbs')) return 'Blood Sugar';
    if (n.includes('hba1c')) return 'HbA1c';
    if (n.includes('cholesterol') && !n.includes('hdl') && !n.includes('ldl')) return 'Cholesterol';
    if (n.includes('triglyceride')) return 'Triglyceride';
    if (n.includes('hdl')) return 'HDL-C';
    if (n.includes('ldl')) return 'LDL-C';
    if (n.includes('bun')) return 'BUN';
    if (n.includes('creatinine')) return 'Creatinine';
    if (n.includes('egfr') || n.includes('gfr')) return 'eGFR';
    if (n.includes('uric')) return 'Uric acid';
    if (n.includes('sgot') || n.includes('ast')) return 'SGOT';
    if (n.includes('sgpt') || n.includes('alt')) return 'SGPT';
    if (n.includes('alk') && n.includes('phos')) return 'Alk-phos';
    return name.charAt(0).toUpperCase() + name.slice(1);
};

const getCategory = (normalizedName: string) => {
    const n = normalizedName.toLowerCase();
    if (n === 'blood sugar' || n === 'hba1c' || n.includes('glucose')) return 'น้ำตาลในเลือด';
    if (['bun', 'creatinine', 'egfr'].includes(n)) return 'การทำงานของไต';
    if (n === 'uric acid') return 'กรดยูริค';
    if (['cholesterol', 'triglyceride', 'hdl-c', 'ldl-c'].includes(n)) return 'ระดับไขมันในเลือด';
    if (['sgot', 'sgpt', 'alk-phos'].includes(n)) return 'การทำงานของตับ';
    return 'อื่นๆ';
};

const ValueDisplay = ({valueStr, isNormal}: { valueStr?: string | null, isNormal: boolean }) => {
    if (!valueStr || valueStr === 'N/A') {
        return <div className="text-3xl font-bold text-gray-200">N/A</div>;
    }
    const match = valueStr.match(/^([\d.]+)\s*(.*)$/);
    if (match && !isNaN(parseFloat(match[1]))) {
        return (
            <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${isNormal ? 'text-gray-900' : 'text-red-600'}`}>{match[1]}</span>
                <span className={`text-sm font-medium ${isNormal ? 'text-gray-500' : 'text-red-400'}`}>{match[2]}</span>
            </div>
        );
    }
    return <div className={`text-xl font-bold ${isNormal ? 'text-gray-900' : 'text-red-600'}`}>{valueStr}</div>;
};

// --- Main Component ---

export default function AnalysisResult({data}: { data: any }) {
    if (!data) return null;

    // 1. กำหนดหมวดหมู่หลัก (เอา "อื่นๆ" ออก)
    const groupedStats: Record<string, any[]> = {
        'น้ำตาลในเลือด': [],
        'การทำงานของไต': [],
        'กรดยูริค': [],
        'ระดับไขมันในเลือด': [],
        'การทำงานของตับ': []
    };

    data.health_stats?.forEach((stat: any) => {
        const normalizedName = normalizeMetricName(stat.name);
        const category = getCategory(normalizedName);

        // 2. เช็คว่าถ้า category ตรงกับ key ที่มีอยู่ค่อยใส่ (ถ้าเป็น 'อื่นๆ' มันจะหาไม่เจอและข้ามไปเอง)
        if (groupedStats[category]) {
            groupedStats[category].push({...stat, name: normalizedName});
        }
    });

    // ลบหมวดที่ไม่มีข้อมูล
    Object.keys(groupedStats).forEach(key => {
        if (groupedStats[key].length === 0) delete groupedStats[key];
    });

    return (
        <div className="space-y-8 animate-fade-in-up">

            {/* Summary Card */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 relative z-10">
                    <div className="bg-black text-white p-3 rounded-2xl"><FileText size={24}/></div>
                    สรุปผลภาพรวม
                </h2>
                <p className="text-gray-600 leading-relaxed text-lg relative z-10">{data.summary || "ไม่มีข้อมูลสรุป"}</p>
            </div>

            {/* Grouped Stats Loop */}
            <div className="space-y-8">
                {Object.entries(groupedStats).map(([category, stats]) => (
                    <div key={category}>
                        <h3 className="text-xl font-bold text-gray-800 mb-4 px-2 border-l-4 border-black pl-3">{category}</h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {stats.map((stat: any, i: number) => {
                                const isNA = stat.value === 'N/A';
                                const isNormal = stat.status === 'ปกติ' || stat.status === 'ไม่ระบุ' || isNA;

                                return (
                                    <div key={i}
                                         className={`p-6 rounded-[2rem] border transition duration-300 ${isNormal ? 'bg-white border-gray-100' : 'bg-red-50/50 border-red-100'}`}>
                                        <div className="flex justify-between mb-3">
                                            <span
                                                className="font-semibold text-gray-500 text-sm truncate pr-2">{stat.name}</span>
                                            <span
                                                className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide flex-shrink-0 ${
                                                    isNA ? 'bg-gray-100 text-gray-400' :
                                                        isNormal ? 'bg-green-50 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                            {stat.status}
                                        </span>
                                        </div>

                                        <ValueDisplay valueStr={stat.value} isNormal={isNormal}/>

                                        {stat.ref_range &&
                                            <p className="text-xs text-gray-400 mt-1">เกณฑ์: {stat.ref_range}</p>}
                                        {stat.advice && !isNA &&
                                            <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100 line-clamp-2">{stat.advice}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Food & Advice */}
            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-gray-200/50">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-3 text-xl">
                        <span className="bg-green-100 text-green-700 p-2 rounded-xl"><Apple
                            size={20}/></span> อาหารแนะนำ
                    </h3>
                    <ul className="space-y-4">
                        {data.food_plan && Object.entries(data.food_plan).map(([meal, menu]: any, i) => (
                            <li key={i} className="flex gap-4 items-start">
                                <span
                                    className="font-bold capitalize min-w-[3rem] text-sm text-gray-400 mt-1">{meal}</span>
                                <span className="text-gray-800 font-medium">{menu}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-3 text-xl">
                        <span className="bg-orange-100 text-orange-700 p-2 rounded-xl"><Dumbbell
                            size={20}/></span> คำแนะนำ
                    </h3>
                    <p className="text-gray-600 leading-relaxed font-medium mb-4">{data.exercise}</p>
                    {data.general_advice && (
                        <div className="pt-4 border-t border-gray-100">
                            <ul className="space-y-2">
                                {data.general_advice.map((advice: string, k: number) => (
                                    <li key={k} className="text-sm text-gray-500 flex gap-2 items-start">
                                        <span className="text-orange-400 mt-1">•</span> {advice}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}