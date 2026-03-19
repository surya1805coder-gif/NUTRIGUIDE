const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
require("dotenv").config();

// Initialize SDKs
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

/**
 * Loads nutritional data from CSV
 */
async function loadNutritionData() {
    return new Promise((resolve, reject) => {
        const results = [];
        const csvPath = path.join(__dirname, "../data/Indian_Food_Nutrition_Processed.csv");
        if (!fs.existsSync(csvPath)) return resolve([]);
        fs.createReadStream(csvPath).pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => resolve(results))
            .on("error", (err) => reject(err));
    });
}

/**
 * Reverted to Clean Triple-Shield Architecture
 */
async function getAdvice(userProfile) {
    const nutritionData = await loadNutritionData();
    if (!nutritionData.length) throw new Error("Database missing.");

    // FILTERING
    let filtered = [...nutritionData];
    if (userProfile.bmi >= 25) filtered = filtered.filter(f => parseFloat(f['Calories (kcal)']) < 300);
    else if (userProfile.bmi < 18.5) filtered = filtered.filter(f => parseFloat(f['Calories (kcal)']) > 350);
    filtered.sort(() => 0.5 - Math.random());
    const finalFoods = filtered.slice(0, 15);
    const contextData = finalFoods.map(f => `- ${f['Dish Name']}: ${f['Calories (kcal)']}kcal, Protein: ${f['Protein (g)']}g`).join("\n");

    // MATH
    const proteinMultiplier = userProfile.goal.toLowerCase().includes('muscle') ? 2.2 : 1.1;
    const targetProtein = (userProfile.weight * proteinMultiplier).toFixed(1);

    const prompt = `
        Act as an elite Indian Clinical Nutritionist.
        Generate a ${userProfile.days}-DAY meal plan for a ${userProfile.age}y user (${userProfile.weight}kg, Goal: ${userProfile.goal}).
        Strict Protein Target: ${targetProtein}g/day.

        CLINICAL RULES:
        1. Pair complementary proteins (Rice+Dal). 
        2. Pair Iron with Vit C. 
        3. 15 mins morning sunlight tip.
        4. Unique motivational quote.

        DATA:
        ${contextData}

        OUTPUT FORMAT:
        Output ONLY pure HTML with Tailwind. No intro/outro. 
        YOU MUST GENERATE ALL ${userProfile.days} DAYS INDIVIDUALLY.
        Each day MUST have its own 2-column grid and Daily Targets box.

        Structure for EACH day:
        <div class="mb-10 p-6 border-b border-gray-200">
            <h2 class="text-2xl font-bold">📅 Day [N]</h2>
            <div class="bg-blue-50 p-4 rounded-xl mb-4">
                <p><strong>Protein: ${targetProtein}g</strong> | Sunlight Protocol included</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Breakfast, Lunch, Dinner, Snack Cards -->
            </div>
            <p class="italic mt-4 text-gray-500">"[Quote]" - [Author]</p>
        </div>
    `;

    // TIER 1: GROQ
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.1-70b-versatile",
                max_tokens: 8192
            });
            return completion.choices[0]?.message?.content?.replace(/```html|```/g, "").trim();
        } catch (e) { console.warn("Groq failed."); }
    }

    // TIER 2: GEMINI
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 8192 }
            });
            return result.response.text().replace(/```html|```/g, "").trim();
        } catch (e) { console.warn("Gemini failed."); }
    }

    // TIER 3: OPENROUTER
    if (process.env.OPENROUTER_API_KEY) {
        try {
            const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "openrouter/auto",
                messages: [{ role: "user", content: prompt }]
            }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });
            return res.data.choices[0]?.message?.content?.replace(/```html|```/g, "").trim();
        } catch (e) { console.error("OpenRouter fail."); }
    }

    // TIER 4: FALLBACK
    return `<div class="p-6 bg-orange-50 rounded-xl"><h3>Offline Mode</h3><p>Here is your ${userProfile.days}-day plan based on BMI: ${userProfile.bmi.toFixed(1)}...</p></div>`;
}

module.exports = { getAdvice };
