import { OpenAI } from "openai";
import labMasterData from "@/data/metadata.json";

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
    console.warn("Missing VITE_OPENAI_API_KEY. AI features will not work.");
}

const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for client-side usage
});

// ── Build STANDARD_CRITERIA from metadata.json ──

const masterData = labMasterData.lab_master_data as Record<string, { category_name: string; items: any[] }>;

function buildStandardCriteria(): string {
    const criteria: Record<string, any[]> = {};

    for (const group of Object.values(masterData)) {
        criteria[group.category_name] = group.items.map(item => {
            const entry: Record<string, any> = {
                name: item.display_name,
                aliases: item.aliases,
            };

            if (item.unit) entry.unit = item.unit;

            if (item.normalRange) {
                entry.min = item.normalRange.min;
                entry.max = item.normalRange.max;
            }
            if (item.normalRange_male) {
                entry.normalRange_male = item.normalRange_male;
            }
            if (item.normalRange_female) {
                entry.normalRange_female = item.normalRange_female;
            }
            if (item.normal_value) {
                entry.text_value = item.normal_value;
            }

            return entry;
        });
    }

    return JSON.stringify(criteria, null, 2);
}

// Build the list of category names for the output instruction
function buildCategoryList(): string {
    return Object.values(masterData)
        .map(group => `"${group.category_name}"`)
        .join(', ');
}

const STANDARD_CRITERIA = buildStandardCriteria();
const CATEGORY_LIST = buildCategoryList();

export async function reAnalyzeFromData(healthStats: any[], profile: any) {
    try {
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

        const statsJson = JSON.stringify(healthStats, null, 2);

        const prompt = `
            คุณคือผู้เชี่ยวชาญด้านเทคนิคการแพทย์และสุขภาพ หน้าที่ของคุณคือวิเคราะห์ข้อมูลผลตรวจสุขภาพ (health_stats) ที่ผู้ใช้แก้ไขค่าแล้ว
            แล้วคำนวณ status, advice, summary, food_plan, exercise, general_advice ใหม่ทั้งหมด

            ${profileText}

            *** 1. เกณฑ์มาตรฐาน (STANDARD_CRITERIA) ***
            ${STANDARD_CRITERIA}

            *** 2. ข้อมูลผลตรวจที่ผู้ใช้แก้ไขแล้ว ***
            ${statsJson}

            *** 3. กฎการตัดสินผล (Status) ***
            - ถ้าใน Standard มี min/max: ให้เทียบค่าตัวเลข ถ้าหลุดช่วงให้ถือว่า "ผิดปกติ"
            - ถ้าใน Standard มี text_value (เช่น Negative, Clear): ค่าที่ได้ต้องตรงกันเป๊ะๆ ถึงจะ "ปกติ"
            - ถ้ามี normalRange_male / normalRange_female ให้ใช้ค่าตามเพศของผู้ตรวจจาก Profile
            - หากค่าเป็น "N/A" ให้ status เป็น "ไม่ระบุ"

            *** 4. Output Structure (JSON Only) ***
            ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมี Markdown:
            {
                "summary": "สรุปผลการตรวจภาพรวมสั้นๆ เข้าใจง่าย (ภาษาไทย) โดยอ้างอิงข้อมูล Profile ผู้ตรวจด้วย",
                "health_stats": [
                    {
                        "name": "ชื่อรายการตรวจ (ใช้ชื่อเดิมจากข้อมูลที่ส่งมา)",
                        "value": "ค่าเดิมจากข้อมูลที่ส่งมา (ห้ามแก้ไข) เฉพาะตัวเลขหรือข้อความ ไม่รวมหน่วย",
                        "unit": "หน่วยเดิมจากข้อมูลที่ส่งมา (ห้ามแก้ไข)",
                        "type": "text หรือ number (ใช้ค่าเดิม)",
                        "normalRange": { "min": "ค่าเดิม", "max": "ค่าเดิม" },
                        "category": "ค่าเดิม",
                        "status": "ปกติ, ผิดปกติ, หรือ ไม่ระบุ (คำนวณใหม่)",
                        "advice": "คำแนะนำสั้นๆ เฉพาะค่านี้ (ภาษาไทย) ปรับให้เหมาะกับเพศ/อายุ (สร้างใหม่)"
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

            *** สำคัญ ***
            - ห้ามเปลี่ยนแปลง value, unit, name, normalRange, category, type ของแต่ละรายการ ให้ใช้ค่าเดิมทั้งหมด
            - ให้คำนวณ status ใหม่โดยเทียบ value กับ normalRange ตามเกณฑ์มาตรฐาน
            - ให้สร้าง advice ใหม่ตามค่าผลตรวจปัจจุบัน
            - ให้สร้าง summary, food_plan, exercise, general_advice ใหม่ทั้งหมดตามผลตรวจปัจจุบัน
            - จำนวน health_stats ต้องเท่ากับข้อมูลที่ส่งมา และเรียงลำดับเดิม
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
            max_tokens: 5000,
        });

        const content = response.choices[0].message.content || "{}";
        const cleanContent = content.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanContent);
    } catch (error) {
        console.error("Error in reAnalyzeFromData:", error);
        throw error;
    }
}

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
            ใช้ข้อมูล JSON นี้เป็น Reference โดยแต่ละหมวดประกอบด้วย name, aliases สำหรับจับคู่ชื่อ, ค่า min/max หรือ text_value, และ unit:
            ${STANDARD_CRITERIA}

            *** 2. กฎการตั้งชื่อ (Name Standardization) ***
            - ให้จับคู่ชื่อรายการตรวจที่พบในภาพ กับ 'name' ใน STANDARD_CRITERIA โดยใช้ 'aliases' ช่วย
            - ใช้ 'name' เป็น name ในผลลัพธ์เสมอ (ห้ามใช้ alias)
            - ใช้ชื่อหมวด (key) จาก STANDARD_CRITERIA เป็น category เช่น ${CATEGORY_LIST}
            - หากรายการไหนไม่อยู่ใน Standard ให้ใช้ชื่อภาษาอังกฤษที่เป็นสากลที่สุด และตั้ง category เป็น "อื่นๆ"

            *** 3. กฎการตัดสินผล (Status) ***
            - ถ้าใน Standard มี min/max: ให้เทียบค่าตัวเลข ถ้าหลุดช่วงให้ถือว่า "ผิดปกติ"
            - ถ้าใน Standard มี text_value (เช่น Negative, Clear): ค่าที่ได้ต้องตรงกันเป๊ะๆ ถึงจะ "ปกติ" (เช่น Trace, Positive, Turbid ให้ถือว่า "ผิดปกติ")
            - ถ้ามี normalRange_male / normalRange_female ให้ใช้ค่าตามเพศของผู้ตรวจจาก Profile
            - *สำคัญ:* หากผลการตรวจมีความสัมพันธ์กับ เพศ หรือ อายุ ให้ใช้ข้อมูล Profile ในการช่วยตัดสินใจหรือให้คำแนะนำที่เหมาะสมยิ่งขึ้น

            *** 4. รายการบังคับที่ต้องมีเสมอ (MANDATORY ITEMS) ***
            ไม่ว่ารูปภาพจะมีรายการต่อไปนี้หรือไม่ก็ตาม ต้องระบุรายการเหล่านี้ครบทุกตัวใน health_stats เสมอ
            หากไม่พบค่าในรูปภาพ ให้ใส่ value: "N/A" และ status: "ไม่ระบุ" ห้ามละเว้น:

            กลุ่มปัสสาวะ (ปัสสาวะ (Urinalysis)):
            - Color, Turbidity, pH, Protein, Sugar, Occult Blood, Crystal, Ketone

            กลุ่มเลือด (กลุ่มเลือด (Complete Blood Count)):
            - Hgb, WBC Count, RBC Count, Platelet Count

            กลุ่มน้ำตาล (กลุ่มน้ำตาล (Glucose)):
            - Glucose

            กลุ่มไต (กลุ่มไต (Kidney Profile)):
            - BUN, Creatinine, eGFR

            กลุ่มไขมัน (กลุ่มไขมัน (Lipid Profile)):
            - Cholesterol, HDL Chol, Triglyceride, LDL Chol / Calculate

            กลุ่มตับ (กลุ่มตับ (Liver Profile)):
            - SGOT, SGPT

            CRITICAL: health_stats ต้องมีรายการบังคับทั้งหมด 24 รายการข้างต้นเสมอ ก่อนเพิ่มรายการอื่นๆ ที่พบในรูป

            *** 5. กรณีหาค่าไม่เจอ (Missing Value) ***
            - หากรายการใดใน MANDATORY ITEMS "ไม่มีปรากฏในรูปภาพ" หรือ "อ่านค่าไม่ได้"
            - ให้ระบุ value: "N/A"
            - ให้ระบุ status: "ไม่ระบุ"
            - ห้ามใส่ค่าเดา หรือข้อความอื่นลงใน value เด็ดขาด

            *** 6. Output Structure (JSON Only) ***
            ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมี Markdown:
            {
                "hospitalName": "ชื่อโรงพยาบาลหรือคลินิกที่ระบุในใบตรวจ (หรือ 'N/A' ถ้าไม่มี)",
                "examinationDate": "วันที่รับการตรวจในรูปแบบ DD/MM/YYYY (หรือ 'N/A' ถ้าไม่มี)",
                "summary": "สรุปผลการตรวจภาพรวมสั้นๆ เข้าใจง่าย (ภาษาไทย) โดยอ้างอิงข้อมูล Profile ผู้ตรวจด้วย",
                "health_stats": [
                    {
                        "name": "test_name จาก Standard",
                        "value": "ค่าที่ตรวจได้ เฉพาะตัวเลขหรือข้อความเท่านั้น ห้ามรวมหน่วยไว้ใน value (หรือ 'N/A' ถ้าไม่มี) ตัวอย่าง: '105.41' ไม่ใช่ '105.41 mL/min/1.73m²'",
                        "unit": "หน่วยของค่านั้น ดึงจาก STANDARD_CRITERIA (เช่น 'mg/dL', 'mL/min/1.73m²') หรือ null ถ้าไม่มีหน่วย",
                        "type": "text หรือ number",
                        "normalRange": { "min": "ค่าต่ำสุด หรือ null", "max": "ค่าสูงสุด หรือ null" },
                        "category": "ชื่อหมวดจาก STANDARD_CRITERIA เช่น 'กลุ่มน้ำตาล' หรือ 'อื่นๆ'",
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
            max_tokens: 5000,
        });

        const content = response.choices[0].message.content || "{}";

        try {
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
