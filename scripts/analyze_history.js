
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// Helper to read .env manually
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, val] = line.split('=');
            if (key && val) {
                env[key.trim()] = val.trim().replace(/^["']|["']$/g, '');
            }
        });
        return env;
    } catch (e) {
        console.error("Could not read .env file.");
        process.exit(1);
    }
};

const env = loadEnv();
const genAI = new GoogleGenerativeAI(env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: env.VITE_GEMINI_MODEL || "gemini-1.5-flash" });

// Target Dates: Jan 18 - Jan 21, 2026
const TARGET_DATES = ['2026-01-18', '2026-01-19', '2026-01-20', '2026-01-21'];

async function main() {
    console.log("📂 Reading user_data.json...");

    let data;
    try {
        const raw = fs.readFileSync('user_data.json', 'utf8');
        data = JSON.parse(raw);
    } catch (e) {
        console.error("❌ Could not read 'user_data.json'. Please make sure it exists and has valid JSON.");
        console.error("   Tip: Open your app console, copy your data, and paste it here.");
        return;
    }

    if (data.habits && data.habits.length === 0) {
        console.warn("⚠️ 'user_data.json' appears to be empty or default. Please paste your actual data.");
    }

    // Filter logic
    const dailyBreakdown = {};

    TARGET_DATES.forEach(date => {
        const dayHabits = data.habits.filter(h => h.createdAt === date);
        const dayCompletions = data.completions[date] || [];
        const dayNotes = data.notes[date] || "";

        dailyBreakdown[date] = {
            total_tasks: dayHabits.length,
            completed_count: dayHabits.filter(h => dayCompletions.includes(h.id)).length,
            tasks: dayHabits.map(h => ({
                text: h.text,
                status: dayCompletions.includes(h.id) ? "DONE" : "PENDING",
                category: h.category || "General"
            })),
            note: dayNotes
        };
    });

    console.log("\n📊 Analyzing data for Jan 18 - Jan 21, 2026...");
    console.log(JSON.stringify(dailyBreakdown, null, 2));

    const prompt = `
    Analyze the daily habit performance for the User from Jan 18 to Jan 21, 2026.
    
    Data:
    ${JSON.stringify(dailyBreakdown, null, 2)}

    Please provide a specific summary for each day, highlighting:
    1. Completion Rate
    2. Notable Tasks (completed or missed)
    3. Any notes recorded
    
    Then provide an overall trend analysis for these 4 days.
    Output in clean Markdown format.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        console.log("\n🤖 GEMINI ANALYSIS RESULT:\n");
        console.log("---------------------------------------------------");
        console.log(response);
        console.log("---------------------------------------------------");

        fs.writeFileSync('analysis_result.md', response);
        console.log("\n✅ Analysis saved to 'analysis_result.md'");

    } catch (error) {
        console.error("Gemini Error:", error);
    }
}

main();
