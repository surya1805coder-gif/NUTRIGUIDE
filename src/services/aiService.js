const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
require("dotenv").config();

// Initialize SDKs
// Initialize Clients (Safe check)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

/**
 * Loads nutritional data from CSV
 * @returns {Promise<Array>}
 */
async function loadNutritionData() {
    return new Promise((resolve, reject) => {
        const results = [];
        const csvPath = path.join(__dirname, "../data/Indian_Food_Nutrition_Processed.csv");
        
        if (!fs.existsSync(csvPath)) {
            return resolve([]);
        }

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => resolve(results))
            .on("error", (err) => reject(err));
    });
}

/**
 * Generates personalized nutritional advice using Triple-Shield Redundancy
 * @param {Object} userProfile - { age, weight, height, bmi, goal }
 */
async function getAdvice(userProfile) {
    const nutritionData = await loadNutritionData();
    
    // 1. Safety Check
    if (!nutritionData || nutritionData.length === 0) {
        throw new Error("CSV data is empty or file not found");
    }

    // 2. Dynamic Filtering based on Clinical BMI
    let smartFilteredFoods = [...nutritionData]; // Copy to avoid mutation

    if (userProfile.bmi >= 25) {
        // Filter for lower calorie options for Overweight/Obese
        smartFilteredFoods = smartFilteredFoods.filter(item => 
            parseFloat(item['Calories (kcal)']) < 300
        );
    } else if (userProfile.bmi < 18.5) {
        // Filter for higher calorie options for Underweight
        smartFilteredFoods = smartFilteredFoods.filter(item => 
            parseFloat(item['Calories (kcal)']) > 350
        );
    }

    // 3. Randomization (Shuffle)
    smartFilteredFoods.sort(() => 0.5 - Math.random());

    // 4. Final Selection
    const filteredFoods = smartFilteredFoods.slice(0, 15);
    const contextData = filteredFoods.map(item => 
        `- ${item['Dish Name']}: ${item['Calories (kcal)']} kcal, Protein: ${item['Protein (g)']}g, Fats: ${item['Fats (g)']}g, Fibre: ${item['Fibre (g)']}g, Iron: ${item['Iron (mg)']}mg`
    ).join("\n");

    // The Bharat Protocol: Calculate exact protein needs
    const proteinMultiplier = userProfile.goal.toLowerCase().includes('muscle') ? 2.2 : 1.1;
    const targetProtein = (userProfile.weight * proteinMultiplier).toFixed(1);

    const prompt = `
        Act as an elite Indian Clinical Nutritionist.
        User Profile: ${userProfile.age}y, ${userProfile.weight}kg, ${userProfile.height}cm, BMI: ${userProfile.bmi.toFixed(1)}, Goal: ${userProfile.goal}.
        Calculated Daily Protein Target: ${targetProtein}g.

        CLINICAL RULES TO ENFORCE:
        1. For vegetarian/vegan options, pair complementary proteins (e.g., Rice + Dal) to ensure a complete amino acid profile (bioavailability).
        2. Pair Iron-rich foods with Vitamin C (like lemon squeeze) for absorption.
        3. Hit the ${targetProtein}g protein target strictly for each of the ${userProfile.days} days. Balance healthy fats and complex carbs.
        4. Include a brief tip about getting 15 mins of morning sunlight for Vitamin D synthesis.
        5. Include one short, powerful motivational quote about health/food from a great mind.

        AVAILABLE DATA:
        ${contextData}

        OUTPUT FORMAT (STRICT HTML DASHBOARD):
        Do NOT write intro paragraphs. Output ONLY pure HTML using Tailwind classes. Use this exact structure for EACH day (multiply for ${userProfile.days} days):
        <div class="space-y-6 mb-10 border-b pb-8">
            <h2 class="text-2xl font-bold text-slate-800">📅 Day [N] Plan</h2>
            <div class="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500">
                <h3 class="font-bold text-blue-800 text-lg">💡 Daily Targets & Protocol</h3>
                <p class="text-blue-700">Protein Goal: <strong>${targetProtein}g</strong> | Focus: Amino Acid Bioavailability & Food Pairing</p>
                <p class="text-sm text-blue-600 mt-2">☀️ Protocol: 15 mins of direct morning sunlight recommended for Vitamin D.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <h4 class="font-bold text-emerald-600 border-b pb-2 mb-2">🍳 Breakfast</h4>
                    <ul class="text-gray-700 text-sm space-y-1 list-disc pl-4">
                        <!-- Items here -->
                    </ul>
                    <p class="text-xs text-gray-500 mt-2"><em>Pairing note: [Insert pairing logic here]</em></p>
                </div>
                <!-- Repeat for Lunch, Dinner, and 2 Snacks -->
            </div>

            <blockquote class="italic border-l-4 border-gray-300 pl-4 py-2 mt-6 text-gray-600">
                "[Insert Quote]" - [Author]
            </blockquote>
        </div>
    `;

    // TIER 1: Primary - Groq (Llama 3.1) - UPDATED TO PRIMARY
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.1-8b-instant",
            });
            return completion.choices[0]?.message?.content || "No content from Groq";
        } catch (error) {
            console.warn("TIER 1 (Groq) failed. Rerouting to Tier 2...", error.message);
        }
    } else {
        console.warn("TIER 1 (Groq) skipped: GROQ_API_KEY missing.");
    }

    // TIER 2: Secondary - Google Gemini
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.warn("TIER 2 (Gemini) failed. Rerouting to Tier 3...", error.message);
        }
    } else {
        console.warn("TIER 2 (Gemini) skipped: GEMINI_API_KEY missing.");
    }

    // TIER 3: Tertiary - OpenRouter (Mistral)
    if (process.env.OPENROUTER_API_KEY) {
        try {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "openrouter/auto",
                messages: [{ role: "user", content: prompt }]
            }, {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "NutriGuide Premium"
                }
            });
            return response.data.choices[0]?.message?.content || "No content from OpenRouter";
        } catch (error) {
            console.error("TIER 3 (OpenRouter) failed. Engaging Local Fallback.", error.message);
        }
    } else {
        console.warn("TIER 3 (OpenRouter) skipped: OPENROUTER_API_KEY missing.");
    }

    // TIER 4: Final - Titanium Net (Local Fallback)
    const localAdvice = filteredFoods.slice(0, 5).map(f => `<li><strong>${f['Dish Name']}</strong>: ${f['Calories (kcal)']} kcal, ${f['Protein (g)']}g protein.</li>`).join("");
    
    return `
        <div class="p-6 border-2 border-orange-200 rounded-2xl bg-orange-50">
            <h3 class="text-orange-800 font-bold mb-2">Offline Mode Active</h3>
            <p class="text-orange-700 mb-4">Based on your BMI of ${userProfile.bmi.toFixed(1)} and our clinical database, we recommend these specific options from our Indian nutrition library for your ${userProfile.days}-day plan:</p>
            <ul class="list-disc pl-5 text-orange-900 space-y-2">
                ${localAdvice}
            </ul>
            <p class="mt-4 text-xs italic">Note: Advanced AI analysis is currently offline. These recommendations are curated for your health goal: ${userProfile.goal}.</p>
        </div>
    `;
}

module.exports = { getAdvice };
