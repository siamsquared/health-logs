import {createSlice, createAsyncThunk, PayloadAction} from "@reduxjs/toolkit";
import {collection, getDocs, query, orderBy, doc, updateDoc, Timestamp} from "firebase/firestore"; // ✅ เพิ่ม Timestamp
import {db} from "@/lib/firebase";

export interface HealthReport {
    id: string;
    createdAt: number;
    imageUrl: string;
    analysis: any;
    status?: number; // 0 = deleted, 1 = active
}

interface HealthState {
    logs: HealthReport[];
    status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: HealthState = {
    logs: [],
    status: "idle",
};

const sortLogsByDate = (logs: HealthReport[]) => {
    return logs.sort((a, b) => b.createdAt - a.createdAt);
};

export const fetchHealthLogs = createAsyncThunk(
    "health/fetchLogs",
    async (userId: string) => {
        const q = query(collection(db, "users", userId, "reports"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const logs: HealthReport[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status !== 0) {
                // ✅ รองรับทั้ง Timestamp และ Number (เผื่อข้อมูลเก่า)
                const createdTime = data.createdAt?.toMillis
                    ? data.createdAt.toMillis()
                    : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());

                logs.push({
                    id: doc.id,
                    imageUrl: data.imageUrl,
                    analysis: data.analysis,
                    createdAt: createdTime,
                    status: data.status ?? 1
                });
            }
        });

        return sortLogsByDate(logs);
    }
);

export const updateLogData = createAsyncThunk(
    "health/updateLog",
    async ({userId, logId, updates}: { userId: string, logId: string, updates: Partial<HealthReport> }) => {
        const docRef = doc(db, "users", userId, "reports", logId);

        // ✅ สร้าง object สำหรับส่ง Firestore โดยเฉพาะ
        const firestoreUpdates: any = {...updates};

        // ✅ ถ้ามีการแก้วันที่ (ส่งมาเป็น number) ให้แปลงเป็น Timestamp
        if (typeof updates.createdAt === 'number') {
            firestoreUpdates.createdAt = Timestamp.fromMillis(updates.createdAt);
        }

        await updateDoc(docRef, firestoreUpdates);

        // ส่งค่าเดิม (Number) กลับไปอัปเดต Redux Store (เพราะ Redux ห้ามเก็บ Timestamp Object)
        return {logId, updates};
    }
);

const healthSlice = createSlice({
    name: "health",
    initialState,
    reducers: {
        addNewLog: (state, action: PayloadAction<HealthReport>) => {
            state.logs.unshift(action.payload);
            state.logs = sortLogsByDate(state.logs);
        },
        clearLogs: (state) => {
            state.logs = [];
            state.status = 'idle';
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchHealthLogs.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchHealthLogs.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.logs = action.payload;
            })
            .addCase(fetchHealthLogs.rejected, (state) => {
                state.status = "failed";
            })
            .addCase(updateLogData.fulfilled, (state, action) => {
                const {logId, updates} = action.payload;
                if (updates.status === 0) {
                    state.logs = state.logs.filter(log => log.id !== logId);
                } else {
                    const index = state.logs.findIndex(log => log.id === logId);
                    if (index !== -1) {
                        state.logs[index] = {...state.logs[index], ...updates};
                        state.logs = sortLogsByDate(state.logs); // ✅ Sort ใหม่ทันที
                    }
                }
            });
    },
});

export const {addNewLog, clearLogs} = healthSlice.actions;
export default healthSlice.reducer;