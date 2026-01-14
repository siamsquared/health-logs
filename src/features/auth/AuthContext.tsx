import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
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
    createdAt?: any;
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

        let unsubscribeUser: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            // Cleanup previous user listener if exists
            if (unsubscribeUser) {
                unsubscribeUser();
                unsubscribeUser = null;
            }

            if (currentUser) {
                const basicUserData = {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL,
                };

                unsubscribeUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const profileData = data.profile || {};
                        // Prioritize root display name if exists
                        const finalUserData = { 
                            ...basicUserData, 
                            ...profileData,
                            displayName: data.displayName || basicUserData.displayName,
                            createdAt: data.createdAt
                        };
                        setUser(finalUserData);
                    } else {
                         // Create default if not exists (though usually we might want to do this only once)
                         // For now, if missing, just set basic data.
                         setUser({ ...basicUserData });
                    }
                    setStatus("authenticated");
                }, (error) => {
                    console.error("Auth Snapshot Error:", error);
                    // Do not restore stale user data on error during logout
                    if (auth.currentUser) {
                         setUser({ ...basicUserData });
                         setStatus("authenticated");
                    }
                });
            } else {
                setUser(null);
                setStatus("unauthenticated");
                setIsDisclaimerAccepted(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUser) {
                unsubscribeUser();
            }
        };
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
