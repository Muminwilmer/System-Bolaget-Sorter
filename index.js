const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Connect to SQLite database
const db = new sqlite3.Database('./sql/bolaget.db');

// Serve static HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './public', 'index.html'));
});

// API endpoint to get top 100 drinks sorted by a dynamic field
app.get('/leaderboard', (req, res) => {
    const limit = 100; // Number of top entries to return
    const validChoices = [
        'price', 'price_per_liter', 'price_per_percent', 'price_per_liter_alcohol', 'alcohol_percent'
    ];

    const choice = req.query.choice || 'price_per_liter_alcohol'; // Default sort field
    const skipNoAlc = req.query.skipNoAlc === 'true'; // Convert to Boolean

    // Validate `choice`
    if (!validChoices.includes(choice)) {
        return res.status(400).json({ error: `Invalid choice field. Must be one of: ${validChoices.join(', ')}` });
    }

    // Query the database
    db.all(
        `SELECT id, url, country, brand, name, type, sub_type, description, price, amount, alcohol_percent, 
                price_per_liter, price_per_percent, price_per_liter_alcohol, food_recommendations
         FROM products`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Filter and process rows
            const processedRows = rows
                .filter(drink => {
                    const isAlcoholFree = drink.alcohol_percent === null || drink.alcohol_percent === 0;
                    return !(isAlcoholFree && skipNoAlc); // Skip if non-alcoholic and skipNoAlc is true
                })
                .map(drink => {
                    const price = drink.price;
                    const amount = drink.amount || Math.round(price / drink.price_per_liter * 100) / 100;
                    const alcoholPercent = drink.alcohol_percent ?? Infinity;
                    const pricePerPercent = drink.price_per_percent || Infinity;
                    const pricePerLiterAlcohol = drink.price_per_liter_alcohol ?? 0;
                    const amountToDrink = ((1000 / (amount * (alcoholPercent / 100)))/1000).toFixed(2)
                    const amountToDrinkLiters = ((amount*amountToDrink)).toFixed(2)
                    return {
                        id: drink.id,
                        url: drink.url,
                        country: drink.country,
                        brand: drink.brand,
                        name: drink.name,
                        type: drink.type,
                        sub_type: drink.sub_type,
                        description: drink.description,
                        price,
                        amount,
                        alcohol_percent: alcoholPercent,
                        price_per_liter: drink.price_per_liter,
                        price_per_percent: pricePerPercent,
                        price_per_liter_alcohol: pricePerLiterAlcohol,
                        food_recommendations: JSON.stringify(drink.food_recommendations),
                        is_alcohol_free: drink.alcohol_percent === null || drink.alcohol_percent === 0,
                        amount_to_drink: amountToDrink,
                        amount_to_drink_liters: amountToDrinkLiters
                    };
                });

            // Sort by the chosen field
            const sortedRows = processedRows
                .sort((a, b) => {
                    const aValue = isFinite(a[choice]) ? a[choice] : 0; // Default null/Infinity to 0
                    const bValue = isFinite(b[choice]) ? b[choice] : 0; // Default null/Infinity to 0
                    return aValue - bValue; // Ascending order
                })
                .slice(0, limit);

            // Return JSON response
            res.json(sortedRows);
        }
    );
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running at ${PORT}`);
});
