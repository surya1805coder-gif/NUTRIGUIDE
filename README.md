# NutriGuide - Precision AI Nutritionist

NutriGuide is a professional-grade nutrition recommendation engine that uses **Retrieval-Augmented Generation (RAG)** and clinical datasets to provide personalized meal plans based on individual physiological data.

## 🚀 Key Features
- **Precision Metabolic Engine**: Calculates BMR and TDEE using the Mifflin-St Jeor equation.
- **RAG Architecture**: Uses clinical Indian nutrition datasets to ground AI recommendations in factual data.
- **Triple-Shield Redundancy**: Multi-tier AI fallback system (Groq, Gemini, Mistral) for 99.9% availability.
- **Enhanced Profile**: Supports Age, Weight, Height, Gender, Activity Levels, Step Counts, and Dietary Preferences.
- **Privacy First**: Stateless architecture—user data is never stored and exists only during the session.

## 🛠 Tech Stack
- **Backend**: Node.js & Express
- **Frontend**: EJS (Templating Engine) & Tailwind CSS (Styling)
- **AI/LLM**: Google Gemini, Groq (Llama 3.1), and Mistral
- **Data**: CSV-based Local RAG for Indian Food Nutrition

## ⚙️ Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env` file with:
   ```env
   GEMINI_API_KEY=your_key
   GROQ_API_KEY=your_key
   OPENROUTER_API_KEY=your_key
   PORT=3000
   ```
4. Run the development server: `npm run dev`

---
*Built with ❤️ for a Healthier Future.*
