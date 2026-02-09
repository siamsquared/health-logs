import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";

export interface AnalysisData {
    hospitalName?: string;
    examinationDate?: string;
    summary: string;
    health_stats: Array<{
        name: string;
        value: string;
        ref_range: string;
        status: string;
    }>;
    recommendations: string[];
}

export interface HealthLog {
    id: string;
    imageUrl: string; // Keep for backward compatibility
    imageUrls?: string[]; // New field for multiple images
    analysis: AnalysisData;
    createdAt: number;
    status: number;
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
                    imageUrl: data.imageUrl || data.imageUrls?.[0] || '', // Use first image from array if imageUrl not present
                    imageUrls: data.imageUrls,
                    analysis: data.analysis,
                    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
                    status: data.status
                });
            }
        });
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
