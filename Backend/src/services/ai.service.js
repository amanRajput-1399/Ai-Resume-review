const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate profile matches the job"),

    technicalQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ),

    behavioralQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ),

    skillGaps: z.array(
        z.object({
            skill: z.string(),
            severity: z.enum(["low", "medium", "high"])
        })
    ),

    preparationPlan: z.array(
        z.object({
            day: z.number(),
            focus: z.string(),
            tasks: z.array(z.string())
        })
    ),

    title: z.string()
})

// ============================
// GENERATE INTERVIEW REPORT
// ============================

async function generateInterviewReport({
    resume,
    selfDescription,
    jobDescription
}) {

    const prompt = `
Generate interview report in STRICT JSON format.

IMPORTANT:
Return ONLY valid JSON.

Use EXACT keys:
- title
- matchScore
- technicalQuestions
- behavioralQuestions
- skillGaps
- preparationPlan

technicalQuestions format:
[
 {
   "question": "",
   "intention": "",
   "answer": ""
 }
]

behavioralQuestions format:
[
 {
   "question": "",
   "intention": "",
   "answer": ""
 }
]

skillGaps format:
[
 {
   "skill": "",
   "severity": "low"
 }
]

preparationPlan format:
[
 {
   "day": 1,
   "focus": "",
   "tasks": ["", ""]
 }
]

Candidate Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}
`

    try {

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        })

        // console.log("RAW AI RESPONSE => ")
        // console.log(response.text)

        const parsedData = JSON.parse(response.text)

        return parsedData

    } catch (error) {

        console.log("AI ERROR => ", error)

        return {
            title: "Software Engineer",
            matchScore: 70,

            technicalQuestions: [],
            behavioralQuestions: [],
            skillGaps: [],
            preparationPlan: []
        }
    }
}

// ============================
// GENERATE PDF FROM HTML
// ============================

async function generatePdfFromHtml(htmlContent) {

    const browser = await puppeteer.launch({
        headless: true,

        executablePath:
            "C:/Program Files/Google/Chrome/Application/chrome.exe",

        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-features=site-per-process"
        ]
    })

    const page = await browser.newPage()

    await page.setContent(htmlContent, {
        waitUntil: "networkidle0"
    })

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

// ============================
// GENERATE RESUME PDF
// ============================

async function generateResumePdf({
    resume,
    selfDescription,
    jobDescription
}) {

    const resumePdfSchema = z.object({
        html: z.string()
    })

    const prompt = `
Generate a professional ATS friendly resume HTML.

Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}

Return only JSON with html field.
`

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })

    // console.log("RESUME PDF RESPONSE => ")
    // console.log(response.text)

    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(
        jsonContent.html
    )

    return pdfBuffer
}

module.exports = {
    generateInterviewReport,
    generateResumePdf
}