import { OpenAI } from "openai";

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
    console.warn("Missing VITE_OPENAI_API_KEY. AI features will not work.");
}

const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for client-side usage
});

const STANDARD_CRITERIA = JSON.stringify({
    "blood_chemistry": [
        { "test_name": "Blood Sugar", "min": 70, "max": 99, "unit": "mg/dl" },
        { "test_name": "BUN", "min": 8, "max": 23, "unit": "mg/dl" },
        { "test_name": "Creatinine", "min": 0.60, "max": 1.30, "unit": "mg/dl" },
        { "test_name": "eGFR", "min": 90.00, "max": null, "unit": "ml/min/1.73m^2", "note": "> 90.00" },
        { "test_name": "Uric acid", "min": 3.4, "max": 7.0, "unit": "mg/dl" },
        { "test_name": "Cholesterol", "min": null, "max": 200, "unit": "mg/dl", "note": "< 200" },
        { "test_name": "Triglyceride", "min": null, "max": 150, "unit": "mg/dl", "note": "< 150" },
        { "test_name": "HDL-C", "min": 40, "max": null, "unit": "mg/dl", "note": "> 40" },
        { "test_name": "LDL-C", "min": null, "max": 130, "unit": "mg/dl", "note": "< 130" },
        { "test_name": "SGOT", "min": 0, "max": 40, "unit": "U/L" },
        { "test_name": "SGPT", "min": 0, "max": 41, "unit": "U/L" },
        { "test_name": "Alk-phos", "min": 40, "max": 129, "unit": "U/L" }
    ],
    "urinalysis": [
        { "test_name": "Color", "text_value": "Yellow" },
        { "test_name": "Appearance", "text_value": "Clear" },
        { "test_name": "Sp.Gr.", "min": 1.005, "max": 1.030 },
        { "test_name": "pH", "min": 5.0, "max": 8.0 },
        { "test_name": "Protein", "text_value": "Negative" },
        { "test_name": "Glucose", "text_value": "Negative" },
        { "test_name": "Ketone", "text_value": "Negative" },
        { "test_name": "Blood", "text_value": "Negative" },
        { "test_name": "WBC", "min": 0, "max": 5, "unit": "/HPF" },
        { "test_name": "RBC", "min": 0, "max": 5, "unit": "/HPF" },
        { "test_name": "Epithelium", "min": 0, "max": 5, "unit": "/HPF" }
    ],
    "stool_examination": [
        { "test_name": "Color", "text_value": "Brown / Yellow" },
        { "test_name": "WBC", "text_value": "Negative" },
        { "test_name": "RBC", "text_value": "Negative" },
        { "test_name": "OVA / PARASITE", "text_value": "Negative" },
        { "test_name": "OCCULT BLOOD", "text_value": "Negative" }
    ]
});

export async function analyzeImage(imageUrls: string | string[], profile: any) {
    try {
        const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
        const profileText = profile
            ? `
                *** ข้อมูลส่วนตัวของผู้ตรวจ (Profile) ***
                - เพศ: ${profile.gender || "ไม่ระบุ"}
                - อายุ: ${profile.age || "ไม่ระบุ"} ปี
                - น้ำหนัก: ${profile.weight || "ไม่ระบุ"} กก.
                - ส่วนสูง: ${profile.height || "ไม่ระบุ"} ซม.
                - โรคประจำตัว: ${profile.chronic_diseases?.length > 0 ? profile.chronic_diseases.join(", ") : "ไม่มี"}
                - ประวัติแพ้ยา/อาหาร: ${profile.allergies?.length > 0 ? profile.allergies.join(", ") : "ไม่มี"}
            `
            : "";

        const prompt = `
            คุณคือผู้เชี่ยวชาญด้านเทคนิคการแพทย์และสุขภาพ หน้าที่ของคุณคือวิเคราะห์รูปภาพผลตรวจสุขภาพ (Lab Report)
            และแปลงข้อมูลเป็น JSON ตามโครงสร้างที่กำหนด โดยยึด "เกณฑ์มาตรฐาน" (STANDARD_CRITERIA) และ "ข้อมูลส่วนตัว" (Profile) ของผู้ตรวจประกอบการวิเคราะห์
            
            *** สำคัญ: ฉันส่งรูปภาพให้คุณ ${urls.length} รูป โปรดรวบรวมข้อมูลจากทุกรูปมาไว้ใน Report เดียวกัน ***
            หากพบรายการตรวจเดียวกันในหลายรูป ให้เลือกค่าที่สมบูรณ์ที่สุด หรือค่าล่าสุด (ถ้ามีวันที่ระบุในภาพ)

            ${profileText}

            *** 1. เกณฑ์มาตรฐาน (STANDARD_CRITERIA) ***
            ใช้ข้อมูล JSON นี้เป็น Reference ในการตรวจสอบค่า (Min/Max/Value):
            ${STANDARD_CRITERIA}

            *** 2. กฎการตั้งชื่อ (Name Standardization) ***
            ให้ Map ชื่อรายการตรวจที่พบในภาพ ให้ตรงกับ 'test_name' ใน STANDARD_CRITERIA ด้านบนให้มากที่สุด:
            - กลุ่มน้ำตาล: Glucose, FBS, Sugar -> "Blood Sugar"
            - กลุ่มไขมัน: Cholesterol (Total), Triglyceride, HDL, LDL -> ใช้ชื่อตาม Standard
            - กลุ่มตับ: AST -> "SGOT", ALT -> "SGPT", Alkaline Phosphatase -> "Alk-phos"
            - ปัสสาวะ (Urine): Color, Appearance, Sp.Gr., pH, Protein, Ketone, Blood -> ใช้ชื่อตาม Standard
            - อุจจาระ (Stool): WBC, RBC, Parasite, Occult Blood -> ใช้ชื่อตาม Standard
            * หากรายการไหนไม่อยู่ใน Standard ให้ใช้ชื่อภาษาอังกฤษที่เป็นสากลที่สุด

            *** 3. กฎการตัดสินผล (Status) ***
            - ถ้าใน Standard มี min/max: ให้เทียบค่าตัวเลข ถ้าหลุดช่วงให้ถือว่า "ผิดปกติ"
            - ถ้าใน Standard มี text_value (เช่น Negative, Clear): ค่าที่ได้ต้องตรงกันเป๊ะๆ ถึงจะ "ปกติ" (เช่น ถ้าเจอ Trace, Positive, Turbid ให้ถือว่า "ผิดปกติ")
            - ให้ระบุ "ref_range" ตามที่เขียนใน Standard หรือตามใบตรวจถ้าใน Standard ไม่มี
            - *สำคัญ:* หากผลการตรวจมีความสัมพันธ์กับ เพศ หรือ อายุ (เช่น eGFR, Creatinine) ให้ใช้ข้อมูล Profile ในการช่วยตัดสินใจหรือให้คำแนะนำที่เหมาะสมยิ่งขึ้น

            *** 4. กรณีหาค่าไม่เจอ (Missing Value) - สำคัญ ***
            - หากรายการไหนใน Standard "ไม่มีปรากฏในรูปภาพ" หรือ "อ่านค่าไม่ได้"
            - ให้ระบุ value: "N/A"
            - ให้ระบุ status: "ไม่ระบุ"
            - ห้ามใส่ค่าเดา หรือข้อความอื่นลงใน value เด็ดขาด

            *** 5. Output Structure (JSON Only) ***
            ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมี Markdown:
            {
                "hospitalName": "ชื่อโรงพยาบาลหรือคลินิกที่ระบุในใบตรวจ (หรือ 'N/A' ถ้าไม่มี)",
                "examinationDate": "วันที่รับการตรวจในรูปแบบ DD/MM/YYYY (หรือ 'N/A' ถ้าไม่มี)",
                "summary": "สรุปผลการตรวจภาพรวมสั้นๆ เข้าใจง่าย (ภาษาไทย) โดยอ้างอิงข้อมูล Profile ผู้ตรวจด้วย",
                "health_stats": [
                    {
                        "name": "ชื่อค่าตรวจ (Map ให้ตรงกับ test_name ใน Standard)",
                        "value": "ค่าที่ตรวจได้พร้อมหน่วย (หรือ 'N/A' ถ้าไม่มี)",
                        "ref_range": "ช่วงค่ามาตรฐาน", 
                        "status": "ปกติ, ผิดปกติ, หรือ ไม่ระบุ",
                        "advice": "คำแนะนำสั้นๆ เฉพาะค่านี้ (ภาษาไทย) ปรับให้เหมาะกับเพศ/อายุ"
                    }
                ],
                "food_plan": {
                    "เช้า": "เมนูแนะนำ 1 อย่าง (เหมาะกับ Profile)",
                    "กลางวัน": "เมนูแนะนำ 1 อย่าง (เหมาะกับ Profile)",
                    "เย็น": "เมนูแนะนำ 1 อย่าง (เหมาะกับ Profile)"
                },
                "exercise": "คำแนะนำการออกกำลังกายสั้นๆ (เหมาะกับเพศ/อายุ/น้ำหนัก)",
                "general_advice": [
                    "คำแนะนำการปรับพฤติกรรม 1",
                    "คำแนะนำการปรับพฤติกรรม 2",
                    "คำแนะนำการปรับพฤติกรรม 3"
                ]
            }
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        ...urls.map(url => ({ type: "image_url", image_url: { url } } as const)),
                    ],
                },
            ],
            max_tokens: 2500,
        });

        const content = response.choices[0].message.content || "{}";

        try {
            // clean potential markdown if any (unlikely with json_object mode but safe to keep)
            const cleanContent = content.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleanContent);
        } catch (parseError) {
            console.error("AI Response content that failed to parse:", content);
            throw parseError;
        }
    } catch (error) {
        console.error("Error in analyzeImage:", error);
        throw error;
    }
}
