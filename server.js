const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Routes
const appRoutes = require("./src/routes/appRoutes");
app.use("/", appRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render("errors/500", { 
        message: "Page not found.",
        title: "404 - Gone Hiking"
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("errors/500", { 
        message: "A server error occurred. Our nutritionists are looking into it.",
        title: "500 - Server Error"
    });
});

app.listen(PORT, () => {
    console.log(`[NutriGuide] Running on http://localhost:${PORT}`);
});
