import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile extends Partial<User> {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    birthDate?: string | null;
    gender?: string | null;
    weight?: number | null;
    height?: number | null;
    phoneNumber?: string | null;
    chronic_diseases?: string[];
    allergies?: string[];
}

interface AuthContextType {
    user: UserProfile | null;
    status: "loading" | "authenticated" | "unauthenticated";
    isDisclaimerAccepted: boolean;
    acceptDisclaimer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
    const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);

    useEffect(() => {
        const storedDisclaimer = localStorage.getItem("health_app_disclaimer_accepted") === "true";
        setIsDisclaimerAccepted(storedDisclaimer);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const basicUserData = {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL,
                };

                const unsubscribeUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const profileData = docSnap.data().profile || {};
                        setUser({ ...basicUserData, ...profileData });
                    } else {
                         // Create default if not exists (though usually we might want to do this only once)
                         // For now, if missing, just set basic data.
                         setUser({ ...basicUserData });
                    }
                    setStatus("authenticated");
                }, (error) => {
                    console.error("Auth Snapshot Error:", error);
                    setUser({ ...basicUserData });
                    setStatus("authenticated");
                });

                return () => unsubscribeUser();
            } else {
                setUser(null);
                setStatus("unauthenticated");
                setIsDisclaimerAccepted(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const acceptDisclaimer = () => {
        localStorage.setItem("health_app_disclaimer_accepted", "true");
        setIsDisclaimerAccepted(true);
    };

    return (
        <AuthContext.Provider value={{ user, status, isDisclaimerAccepted, acceptDisclaimer }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
