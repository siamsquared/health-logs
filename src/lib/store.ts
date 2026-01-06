import {configureStore} from '@reduxjs/toolkit'
import authReducer from './features/auth/authSlice'
import healthReducer from './features/health/healthSlice';

export const makeStore = () => {
    return configureStore({
        reducer: {
            auth: authReducer,
            health: healthReducer
        },
    })
}

// Export Types สำหรับใช้ใน Component
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']