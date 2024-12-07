const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;
const path = require('path')

// Connect to SQLite database
const db = new sqlite3.Database('./sql/bolaget.db');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './public', 'index.html'))
})

// API endpoint to get top 100 drinks sorted by pricePerLiterAlcohol
app.get('/leaderboard', (req, res) => {
    const limit = 100; // Number of top entries to return
    db.all(
        `SELECT id, url, country, brand, name, type, sub_type, description, price, amount, alcohol_percent, price_per_liter, price_per_percent, price_per_liter_alcohol
         FROM products`,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            // Calculate pricePerLiterAlcohol dynamically
            const processedRows = rows.map(drink => {
                const price = drink.price;
                const amount = Math.round(price / drink.price_per_liter * 100) / 100;

                const alcoholPercent = drink.alcohol_percent ?? 0;
                const pricePerPercent = drink.price_per_percent ?? "inf";
                const pricePerLiterAlcohol = Math.round(price / (amount * (alcoholPercent / 100)) * 100) / 100;
                // console.log(drink)
                // console.log(pricePerLiterAlcohol)
                // console.log(amount)
                return {
                  id: drink.id,
                  url: drink.url,
                  country: drink.country,
                  brand: drink.brand,
                  name: drink.name,
                  type: drink.type, // Add type
                  sub_type: drink.sub_type, // Add sub_type
                  description: drink.description, // Add description
                  price: drink.price, // Use price directly
                  amount: amount/*drink.amount*/, // Add amount
                  alcohol_percent: drink.alcohol_percent, // Use alcohol_percent directly
                  price_per_liter: drink.price_per_liter, // Add price_per_liter
                  price_per_percent: pricePerPercent, // Add price_per_percent
                  price_per_liter_alcohol: pricePerLiterAlcohol, // Format price_per_liter_alcohol
                };
            });

            // Sort by pricePerLiterAlcohol (descending) and limit to 100
            const sortedRows = processedRows
                .sort((a, b) => b.price_per_liter - a.price_per_liter)
                .slice(0, limit);

            res.json(sortedRows);
        }
    );
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
