
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// Helper to read .env manually since we don't have dotenv installed
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, val] = line.split('=');
            if (key && val) {
                env[key.trim()] = val.trim().replace(/^["']|["']$/g, ''); // Remove quotes
            }
        });
        return env;
    } catch (e) {
        console.error("Could not read .env file. Make sure it exists.");
        process.exit(1);
    }
};

const env = loadEnv();

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: env.VITE_GEMINI_MODEL || "gemini-1.5-flash" });

const TARGET_EMAIL = "itupatti@gmail.com";

async function main() {
    console.log(`🔍 Fetching data for: ${TARGET_EMAIL}...`);

    try {
        // Try Email Key First
        let docRef = doc(db, 'users', TARGET_EMAIL);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.log(`⚠️ Document with ID '${TARGET_EMAIL}' not found.`);
            console.log("   (Note: If the user hasn't logged in with the new code yet, data might be under UID. Using Email as ID is the legacy/recovery method we restored.)");
            process.exit(1);
        }

        const data = docSnap.data();
        console.log("✅ Data found!");

        const outputFilename = 'user_data_export.json';
        fs.writeFileSync(outputFilename, JSON.stringify(data, null, 2));
        console.log(`💾 Raw data saved to: ${outputFilename}`);

        // Use Gemini to analyze/summarize the data
        console.log("\n🤖 Asking Gemini to analyze the data...");

        const habits = data.habits || [];
        const completions = data.completions || {};
        const notes = data.notes || {};

        const prompt = `
        Analyze the following user data from a habit tracker app.
         User Email: ${TARGET_EMAIL}
         Total Habits: ${habits.length}
         
         Data Summary:
         - Habits: ${JSON.stringify(habits.map(h => h.text))}
         - Recent Completions (Date: Completed IDs): ${JSON.stringify(completions)}
         - Notes: ${JSON.stringify(notes)}

         Please provide a detailed summary of this user's progress, consistency, and any patterns you see. 
         Also, list exactly what data points were found.
         Output as JSON.
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const analysis = result.response.text();
        const analysisFilename = 'gemini_analysis.json';
        fs.writeFileSync(analysisFilename, analysis);

        console.log(`🧠 Gemini Analysis saved to: ${analysisFilename}`);
        console.log("\n--- Analysis Preview ---");
        console.log(analysis.substring(0, 500) + "...");

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
