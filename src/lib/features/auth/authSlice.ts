import {createSlice, PayloadAction} from "@reduxjs/toolkit";

interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    birthDate?: string | null; // เปลี่ยน age เป็น birthDate (Format: YYYY-MM-DD)
    gender?: string | null;
    weight?: number | null;
    height?: number | null;
    chronic_diseases?: string[];
    allergies?: string[];
}

interface AuthState {
    user: UserProfile | null;
    status: "loading" | "authenticated" | "unauthenticated";
    error: string | null;
    isDisclaimerAccepted: boolean;
}

const initialState: AuthState = {
    user: null,
    status: "loading",
    error: null,
    isDisclaimerAccepted: false,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        loginSuccess: (state, action: PayloadAction<UserProfile>) => {
            state.user = action.payload;
            state.status = "authenticated";
            state.error = null;
        },
        logout: (state) => {
            state.user = null;
            state.status = "unauthenticated";
            state.isDisclaimerAccepted = false;
        },
        setLoading: (state) => {
            state.status = "loading";
        },
        updateProfileData: (state, action: PayloadAction<Partial<UserProfile>>) => {
            if (state.user) {
                state.user = {...state.user, ...action.payload};
            }
        },
        acceptDisclaimer: (state) => {
            state.isDisclaimerAccepted = true;
        }
    },
});

export const {loginSuccess, logout, setLoading, updateProfileData, acceptDisclaimer} = authSlice.actions;
export default authSlice.reducer;