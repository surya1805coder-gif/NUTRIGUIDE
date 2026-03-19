const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");

// GET / - Landing Page
router.get("/", (req, res) => {
    res.render("landing", { title: "NutriGuide - Your AI Nutritionist" });
});

// POST /calculate - Process BMI and Advice
router.post("/calculate", async (req, res, next) => {
    try {
        const { age, weight, height, goal, days, gender, activity, steps, diet, allergies } = req.body;

        if (!age || !weight || !height) {
            return res.redirect("/");
        }

        // BMI Formula: weight (kg) / [height (m)]^2
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);

        // BMR Calculation (Mifflin-St Jeor Equation)
        let bmr;
        if (gender === 'male') {
            bmr = 10 * weight + 6.25 * height - 5 * age + 5;
        } else {
            bmr = 10 * weight + 6.25 * height - 5 * age - 161;
        }

        // TDEE Calculation (Activity Multipliers)
        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            extra_active: 1.9
        };
        const tdee = bmr * (multipliers[activity] || 1.2);

        const userProfile = { 
            age, weight, height, bmi, goal, days: parseInt(days) || 1,
            gender, activity, steps, diet, allergies, bmr: Math.round(bmr), tdee: Math.round(tdee)
        };
        const aiAdvice = await aiService.getAdvice(userProfile);

        res.render("dashboard", {
            title: "Your Dashboard",
            userProfile,
            aiAdvice
        });
    } catch (error) {
        next(error);
    }
});

// POST /purge - Clear data and start over
router.post("/purge", (req, res) => {
    // In this simple app, we just redirect back to home. 
    // If sessions were used, we'd clear them here.
    res.redirect("/");
});

module.exports = router;
