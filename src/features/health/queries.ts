import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLogs, deleteLog, updateLogDate, HealthLog } from "./api";

export const useHealthLogs = (userId: string | undefined) => {
    return useQuery({
        queryKey: ["healthLogs", userId],
        queryFn: () => fetchLogs(userId!),
        enabled: !!userId,
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
