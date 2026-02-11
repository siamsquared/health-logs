import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLogs, deleteLog, updateLogDate, updateLogAnalysis, HealthLog, AnalysisData } from "./api";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

export const useHealthLogs = (userId: string | undefined) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!userId) return;

        const q = query(
            collection(db, "users", userId, "reports"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const logs: HealthLog[] = [];
            snapshot.forEach((doc: any) => {
                const data = doc.data();
                if (data.status !== 0) {
                    logs.push({
                        id: doc.id,
                        imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
                        analysis: data.analysis,
                        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
                        status: data.status
                    });
                }
            });
            // Update the cache immediately with fresh data from Firestore
            queryClient.setQueryData(["healthLogs", userId], logs);
        });

        return () => unsubscribe();
    }, [userId, queryClient]);

    return useQuery({
        queryKey: ["healthLogs", userId],
        queryFn: () => fetchLogs(userId!),
        enabled: !!userId,
        staleTime: Infinity, // Rely on real-time updates
    });
};

export const useDeleteLog = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, logId }: { userId: string; logId: string }) => deleteLog(userId, logId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ["healthLogs", userId] });
        },
    });
};

export const useUpdateLogDate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, logId, newDate }: { userId: string; logId: string; newDate: number }) => updateLogDate(userId, logId, newDate),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ["healthLogs", userId] });
        },
    });
};

export const useUpdateLogAnalysis = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, logId, analysis }: { userId: string; logId: string; analysis: AnalysisData }) => updateLogAnalysis(userId, logId, analysis),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ["healthLogs", userId] });
        },
    });
};

