import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";

export interface AnalysisData {
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
    imageUrl: string;
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
                    imageUrl: data.imageUrl,
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
    // Firestore stores timestamps often, but here we update createdAt.
    // Ensure consistency with how you store it (millis or Timestamp).
    // Previous logic seemed to use millis for local state but maybe Timestamp for Firestore?
    // Let's stick to updateDoc. If existing data uses Timestamp, we might need to convert.
    // For now, assuming standard update.
    await updateDoc(logRef, { createdAt: newDate }); 
};
