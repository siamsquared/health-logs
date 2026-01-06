import type {Metadata} from "next";
// 1. เปลี่ยนการ import จาก Inter เป็น Poppins
import {Poppins} from "next/font/google";
import "./globals.css";
import StoreProvider from "./StoreProvider";

// 2. ตั้งค่า Poppins
const poppins = Poppins({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"], // เลือกความหนาที่ใช้บ่อย
    variable: "--font-poppins", // ตั้งชื่อ variable เผื่อใช้ใน Tailwind config
    display: "swap",
});

export const metadata: Metadata = {
    title: "AI Health Check",
    description: "ตรวจสุขภาพและวิเคราะห์ผลด้วย AI",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th">
        {/* 3. เรียกใช้ poppins.className ที่ body */}
        <body className={poppins.className}>
        <StoreProvider>
            {children}
        </StoreProvider>
        </body>
        </html>
    );
}