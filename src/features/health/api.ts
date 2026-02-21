import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

// Parses dd/MM/yyyy or yyyy-MM-dd (handles Buddhist Era years > 2400) → yyyyMMdd integer
const examDateKey = (dateStr?: string): number => {
    if (!dateStr || dateStr === 'N/A') return 0;
    const p = dateStr.split('/');
    if (p.length === 3) {
        let y = parseInt(p[2], 10);
        if (y > 2400) y -= 543;
        return y * 10000 + parseInt(p[1], 10) * 100 + parseInt(p[0], 10);
    }
    const iso = dateStr.split('-');
    if (iso.length === 3) {
        let y = parseInt(iso[0], 10);
        if (y > 2400) y -= 543;
        return y * 10000 + parseInt(iso[1], 10) * 100 + parseInt(iso[2], 10);
    }
    return 0;
};

export const sortByExamDate = (a: { analysis?: any; createdAt?: number }, b: { analysis?: any; createdAt?: number }): number => {
    const aKey = examDateKey(a.analysis?.examinationDate) || a.createdAt || 0;
    const bKey = examDateKey(b.analysis?.examinationDate) || b.createdAt || 0;
    return bKey - aKey;
};

export interface HealthStatsData {
    name: string;
    type: 'text' | 'number';
    value: any;
    unit?: string;
    normalRange?: { min?: number; max?: number };
    category: string;
}

export interface AnalysisData {
    hospitalName?: string;
    examinationDate?: string;
    summary: string;
    health_stats: Array<HealthStatsData>;
    recommendations: string[];
    food_plan?: Record<string, string>;
    exercise?: string;
    general_advice?: string[];
}

export interface HealthLog {
    id: string;
    imageUrls?: string[]; // New field for multiple images
    analysis: AnalysisData;
    createdAt: number;
    updatedAt: number;
    status: number;
    note?: string;
}

export const fetchLogs = async (userId: string): Promise<HealthLog[]> => {
    try {
        const q = query(
            collection(db, "users", userId, "reports"),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const logs: HealthLog[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Filter out deleted logs (status === 0) if needed, or handle in UI
            if (data.status !== 0) {
                logs.push({
                    id: doc.id,
                    imageUrls: data.imageUrls,
                    analysis: data.analysis,
                    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
                    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
                    status: data.status,
                    note: data.note,
                });
            }
        });
        logs.sort((a, b) => sortByExamDate(a, b));
        return logs;
    } catch (error) {
        throw new Error("Failed to fetch logs");
    }
};

export const deleteLog = async (userId: string, logId: string) => {
    // Soft delete by updating status to 0, matching previous logic
    const logRef = doc(db, "users", userId, "reports", logId);
    await updateDoc(logRef, { status: 0 });
};

export const updateLogDate = async (userId: string, logId: string, newDate: number) => {
    const logRef = doc(db, "users", userId, "reports", logId);

    // Convert newDate (timestamp) to DD/MM/YYYY string for analysis.examinationDate
    const dateObj = new Date(newDate);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const dateString = `${day}/${month}/${year}`;

    await updateDoc(logRef, {
        createdAt: newDate,
        "analysis.examinationDate": dateString
    });
};
export const updateLogAnalysis = async (userId: string, logId: string, analysis: AnalysisData) => {
    const logRef = doc(db, "users", userId, "reports", logId);
    await updateDoc(logRef, { analysis, updatedAt: serverTimestamp() });
};

export const updateLogNote = async (userId: string, logId: string, note: string) => {
    const logRef = doc(db, "users", userId, "reports", logId);
    await updateDoc(logRef, { note });
};
