
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
} else {
    console.warn("Gemini API Key is missing. Smart features will be disabled.");
}

const MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-flash";
const model = genAI ? genAI.getGenerativeModel({ model: MODEL_NAME }) : null;

export interface SmartTaskSuggestion {
    emoji: string;
    category: 'Work' | 'Personal' | 'Health' | 'Finance' | 'Learning' | 'Social' | 'Other';
}

export async function suggestTaskDetails(taskName: string): Promise<SmartTaskSuggestion> {
    if (!model) {
        return { emoji: '📝', category: 'Other' };
    }

    try {
        const prompt = `
        Analyze the following task and suggest a relevant emoji and a category.
        Task: "${taskName}"
        
        Categories: Work, Personal, Health, Finance, Learning, Social, Other.
        
        return valid JSON format:
        {
            "emoji": "🎯",
            "category": "Work"
        }
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const response = result.response;
        const text = response.text();
        const json = JSON.parse(text);

        return {
            emoji: json.emoji || '📝',
            category: json.category || 'Other'
        };
    } catch (error) {
        console.error("Gemini AI Error:", error);
        throw error; // Re-throw so component can show notification
    }
}

export async function identifyPriorityTask(tasks: { id: string, text: string }[]): Promise<string | null> {
    if (!model || tasks.length === 0) return null;

    try {
        const tasksList = tasks.map(t => `- [${t.id}] ${t.text}`).join('\n');
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', weekday: 'long' });

        const prompt = `
        You are a productivity expert using the "Eat The Frog" method.
        Current Time: ${timeString}
        
        Analyze the following list of tasks and identify the ONE single task that is the most relevant to do NOW.
        
        Rules:
        1. TIME AWARENESS:
           - Late (> 18:00): Avoid heavy "Work". Prioritize family, relax, or prep for tomorrow.
           - Work Hours (9-17): Prioritize high-impact professional tasks.
           - Lunch/Break (12-13): Suggest lighter tasks or break-related habits.
        
        2. DAY AWARENESS:
           - Weekend (Saturday/Sunday): Prioritize personal hobbies, social, family, or chores. AVOID strictly office work unless it says "Urgent".
           
        3. FROG DEFINITION:
           - The "Frog" is the task that best fits effective time management for the CURRENT moment.


        Tasks:
        ${tasksList}
        
        Return valid JSON with the ID of the priority task and a short reason (max 10 words).
        Example:
        {
            "priorityTaskId": "12345",
            "reason": "Best to do in evening"
        }
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const response = result.response;
        const text = response.text();
        const json = JSON.parse(text);

        return json.priorityTaskId || null;
    } catch (error) {
        console.error("Gemini Priority Error:", error);
        throw error; // Re-throw so component can show notification
    }
}

export interface MorningBriefing {
    greeting: string;
    summary: string;
    suggestion: string;
    motivation: string;
}

export async function generateMorningBriefing(
    userName: string,
    yesterdayCompletionRate: number,
    yesterdayTotal: number,
    todayHabits: string[],
    language: 'id' | 'en' = 'id'
): Promise<MorningBriefing | null> {
    if (!model) return null;

    try {
        const habitsList = todayHabits.map(h => `- ${h}`).join('\n');

        const prompt = `
        You are a friendly, energetic, and supportive AI productivity coach named "PingTidy AI".
        User Name: ${userName}
        Language: ${language === 'id' ? 'Indonesian (Casual, Gen-Z friendly, Use slang like "Semangat", "Gaspol")' : 'English (Casual, Upbeat, Gen-Z friendly)'}
        
        Context:
        - Yesterday, the user completed ${Math.round(yesterdayCompletionRate * 100)}% of their habits (Total items: ${yesterdayTotal}).
        - Today, they have these habits planned:
        ${habitsList}
        
        Generate a morning briefing in valid JSON format with the following fields:
        1. "greeting": A warm, personalized morning greeting.
        2. "summary": A 1-sentence comment on yesterday's performance. Be encouraging if low, celebratory if high.
        3. "suggestion": Pick 1-2 habits from today's list to focus on first, or suggest a general mindset based on the list. Max 1 sentence.
        4. "motivation": A short, punchy motivational quote or sentence to start the day.
        
        IMPORTANT: Output MUST be in ${language === 'id' ? 'Indonesian' : 'English'}.

        Example JSON (${language === 'id' ? 'ID' : 'EN'}):
        {
            "greeting": "${language === 'id' ? 'Morning, Sarah! ☀️ Semangat pagi!' : 'Morning, Sarah! ☀️ Rise and shine!'}",
            "summary": "${language === 'id' ? 'Kemarin produktivitasmu oke banget, pertahankan!' : 'You crushed it yesterday, keep it up!'}",
            "suggestion": "${language === 'id' ? 'Fokus selesaikan \'Lari Pagi\' dulu biar mood booster.' : 'Knock out \'Morning Run\' first for a mood boost.'}",
            "motivation": "${language === 'id' ? 'Consistency is key. Gaspol! 🚀' : 'Consistency is key. Let\'s go! 🚀'}"
        }
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const response = result.response;
        const text = response.text();
        const json = JSON.parse(text);

        return {
            greeting: json.greeting || `Hi ${userName}!`,
            summary: json.summary || "Let's make today count!",
            suggestion: json.suggestion || "Focus on your top priority.",
            motivation: json.motivation || "You got this!"
        };
    } catch (error) {
        console.error("Gemini Briefing Error:", error);
        throw error; // Re-throw so component can show notification
    }
}
