"use client";
import {useRef, useEffect} from "react";
import {Provider} from "react-redux";
import {makeStore, AppStore} from "@/lib/store";
import {onAuthStateChanged} from "firebase/auth";
import {doc, getDoc, setDoc, serverTimestamp} from "firebase/firestore";
import {auth, db} from "@/lib/firebase";
import {loginSuccess, logout, setLoading, acceptDisclaimer} from "@/lib/features/auth/authSlice";

export default function StoreProvider({children}: { children: React.ReactNode }) {
    // [Fix 1] กำหนด Type ให้รองรับ null และเริ่มด้วย null
    const storeRef = useRef<AppStore | null>(null);

    if (!storeRef.current) {
        storeRef.current = makeStore();
    }

    useEffect(() => {
        // [Fix 2] ใช้ ! หรือเช็ค null (แต่ logic ข้างบนรับประกันว่ามีค่าแล้ว)
        const store = storeRef.current!;
        store.dispatch(setLoading());

        const isAccepted = localStorage.getItem("health_app_disclaimer_accepted") === "true";
        if (isAccepted) {
            store.dispatch(acceptDisclaimer());
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const basicUserData = {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL,
                };

                try {
                    const userRef = doc(db, "users", currentUser.uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const profileData = userSnap.data().profile || {};
                        store.dispatch(loginSuccess({...basicUserData, ...profileData}));
                    } else {
                        // [Update] ปรับให้ตรงกับ Schema ล่าสุด (birthDate)
                        const defaultProfile = {
                            birthDate: null,
                            gender: null,
                            weight: null,
                            height: null,
                            chronic_diseases: [],
                            allergies: []
                        };

                        await setDoc(userRef, {
                            ...basicUserData,
                            createdAt: serverTimestamp(),
                            profile: defaultProfile
                        });
                        store.dispatch(loginSuccess({...basicUserData, ...defaultProfile}));
                    }
                } catch (error) {
                    console.error("Auth Error:", error);
                    store.dispatch(loginSuccess({...basicUserData}));
                }

            } else {
                store.dispatch(logout());
            }
        });

        return () => unsubscribe();
    }, []);

    // [Fix 3] ใส่ ! เพื่อยืนยันกับ TypeScript ว่า storeRef.current ไม่ใช่ null แน่นอน
    return <Provider store={storeRef.current!}>{children}</Provider>;
}