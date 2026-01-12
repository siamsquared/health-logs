import {AlertTriangle} from "lucide-react";

export default function DisclaimerModal({onAgree}: { onAgree: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in-up">
                <div className="text-center mb-6">
                    <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="text-yellow-600" size={32}/>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">คำเตือนสำคัญ</h2>
                </div>

                <div className="space-y-4 text-gray-600 mb-8 text-sm leading-relaxed">
                    <p>
                        1. ระบบนี้ใช้ <strong>Artificial Intelligence (AI)</strong> ในการวิเคราะห์ข้อมูล
                        ซึ่งอาจมีความผิดพลาดได้
                    </p>
                    <p>
                        2.
                        ข้อมูลที่แสดงผล <strong>"ไม่ใช่คำวินิจฉัยทางการแพทย์"</strong> และไม่สามารถใช้แทนการรักษาโดยแพทย์ผู้เชี่ยวชาญ
                    </p>
                    <p>
                        3. โปรดตรวจสอบความถูกต้องกับเอกสารผลตรวจจริงทุกครั้ง
                        และปรึกษาแพทย์ก่อนปรับเปลี่ยนพฤติกรรมหรือการใช้ยา
                    </p>
                </div>

                <button
                    onClick={onAgree}
                    className="w-full bg-black hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition shadow-lg shadow-blue-200"
                >
                    รับทราบและยอมรับข้อตกลง
                </button>
            </div>
        </div>
    );
}