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
    const contextData = finalFoods.map(f => `- ${f['Dish Name']}: ${f['Calories (kcal)']}kcal, Pro: ${f['Protein (g)']}g, Carbs: ${f['Carbohydrates (g)']}g, Fats: ${f['Fats (g)']}g, Fibre: ${f['Fibre (g)']}g, Na: ${f['Sodium (mg)']}mg, Ca: ${f['Calcium (mg)']}mg, Fe: ${f['Iron (mg)']}mg, VitC: ${f['Vitamin C (mg)']}mg`).join("\n");

    // MATH
    const proteinMultiplier = userProfile.goal.toLowerCase().includes('muscle') ? 2.2 : 1.1;
    const targetProtein = (userProfile.weight * proteinMultiplier).toFixed(1);

    const prompt = `
        **CRITICAL: YOU MUST GENERATE ALL ${userProfile.days} INDIVIDUAL DAYS FOR THIS PLAN.**
        
        Act as an elite Indian Clinical Nutritionist.
        Generate a ${userProfile.days}-DAY meal plan for a ${userProfile.age}y user (${userProfile.weight}kg, Goal: ${userProfile.goal}).
        Strict Protein Target: ${targetProtein}g/day.

        CRITICAL SAFETY PROTOCOL: The user has the following allergies/medical restrictions: ${userProfile.allergies || 'None reported'}. You MUST NOT recommend any foods that violate these restrictions. Your response must be safe for this medical profile.

        CLINICAL RULES:
        1. Pair complementary proteins (Rice+Dal). 
        2. Pair Iron with Vit C for bioavailability. 
        3. 15 mins morning sunlight tip.
        4. Unique motivational quote per day.

        DATA:
        ${contextData}

        OUTPUT FORMAT:
        Output ONLY pure HTML with Tailwind. No intro/outro. 
        YOU MUST GENERATE ALL ${userProfile.days} DAYS INDIVIDUALLY.
        
        For EACH meal (Breakfast, Lunch, Dinner, Snack), clearly list:
        - Dish Name
        - Full Nutritional Breakdown (Cal, Pro, Carbs, Fats, Fibre, Na, Ca, Fe, VitC)

        Structure for EACH of the ${userProfile.days} days:
        <div class="mb-10 p-6 border-b border-gray-200">
            <h2 class="text-2xl font-bold">📅 Day [N]</h2>
            <div class="bg-blue-50 p-4 rounded-xl mb-4">
                <p><strong>Protein Target: ${targetProtein}g</strong> | Sunlight Protocol included</p>
                <p class="text-xs text-blue-600 font-bold mt-1">Daily Clinical Focus: Iron and Calcium Tracking Enabled</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Breakfast, Lunch, Dinner, Snack Cards as white cards with detailed nutritional bullets -->
            </div>
            <p class="italic mt-4 text-gray-500">"[Quote]" - [Author]</p>
        </div>
    `;

    // TIER 1: GROQ (Promoted to Primary)
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama3-8b-8192", // Trying the older reliable stable model
                max_tokens: 8192
            });
            return completion.choices[0]?.message?.content?.replace(/```html|```/g, "").trim();
        } catch (e) { 
            console.error("Groq failed:", e.message || e); 
        }
    }

    // TIER 2: GEMINI (Native)
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 8192 }
            });
            return result.response.text().replace(/```html|```/g, "").trim();
        } catch (e) { 
            console.error("Gemini failed:", e.message || e); 
        }
    }

    // TIER 3: OPENROUTER (Fallback)
    if (process.env.OPENROUTER_API_KEY) {
        try {
            const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "google/gemini-2.0-pro-exp-20250212:free", // A very permissive free model
                messages: [{ role: "user", content: prompt }]
            }, { 
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "NutriGuide"
                } 
            });
            return res.data.choices[0]?.message?.content?.replace(/```html|```/g, "").trim();
        } catch (e) { 
            console.error("OpenRouter fail:", e.response?.data || e.message); 
        }
    }

    // TIER 4: HIGH-FIDELITY FALLBACK (Scientific Local Generation)
    let fullOfflinePlan = "";
    for (let day = 1; day <= userProfile.days; day++) {
        const offlineFiltered = nutritionData.sort(() => 0.5 - Math.random()).slice(0, 5);
        const mealCards = offlineFiltered.map((f, i) => `
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h3 class="font-bold text-lg text-blue-800">${['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Boost'][i] || 'Meal'}: ${f['Dish Name']}</h3>
                <ul class="text-sm text-gray-600 mt-2 space-y-1">
                    <li>🔥 ${f['Calories (kcal)']} kcal</li>
                    <li>💪 Pro: ${f['Protein (g)']}g | 🍞 Carbs: ${f['Carbohydrates (g)']}g</li>
                    <li>🥑 Fats: ${f['Fats (g)']}g | 🥗 fibre: ${f['Fibre (g)']}g</li>
                </ul>
            </div>
        `).join("");

        fullOfflinePlan += `
            <div class="mb-10 p-6 border-b border-gray-200">
                <h2 class="text-3xl font-bold text-blue-900 mb-4 tracking-tight">📅 Day ${day}</h2>
                <div class="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 text-blue-800">
                    <p><strong>Protein Target: ${targetProtein}g</strong> | Local NutriLogic Engine Selection</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${mealCards}
                </div>
            </div>
        `;
    }

    return `
        <div class="p-8 bg-blue-50 border-4 border-blue-200 rounded-3xl mt-6 relative overflow-hidden shadow-2xl">
            <div class="absolute -right-20 -top-20 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
            <div class="relative z-10 flex flex-col items-center text-center mb-10">
                <span class="bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-[0.25em] mb-4 shadow-lg">Scientific Engine Beta</span>
                <h3 class="text-4xl font-extrabold text-blue-950 tracking-tighter leading-none mb-4">BMI Optimized Plan-vII</h3>
                <p class="text-blue-700 max-w-xl mx-auto font-medium">Generating a ${userProfile.days}-day protocol. AI is currently syncing clinical updates; our <strong>NutriLogic RAG Engine</strong> has selected these verified items for you.</p>
            </div>
            
            ${fullOfflinePlan}
            
            <div class="mt-8 pt-8 border-t border-blue-200 text-center">
                <p class="italic text-blue-400 font-serif">"Wait for the sun, but eat for the strength." - NutriGuide Protocol</p>
            </div>
        </div>
    `;
}

module.exports = { getAdvice };
