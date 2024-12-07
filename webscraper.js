const puppeteer = require('puppeteer');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./sql/bolaget.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the database.');
  }
});


/*
  I'm sorry for making you read this mess :D


*/



async function webscrapeMainpage() {
  const browser = await puppeteer.launch({ headless: true, args: ['--headless=old'] }); // Use headless: false for debugging
  const page = await browser.newPage();
  await page.goto('https://www.systembolaget.se/sortiment/', { waitUntil: 'networkidle2' });
  console.log("Started page!");

  // Press the "verification"
  await page.waitForSelector(`a[href="/sortiment/"]`);
  await page.click(`a[href="/sortiment/"]`);
  console.log("Pressed verification");

  // Accept cookies
  await page.waitForSelector(`button[class="css-xute7l ecpbukt0"]`);
  await page.click(`button[class="css-xute7l ecpbukt0"]`);
  console.log("Accepted cookies");

  let currentPage = 1;
  let hasNextPage = true;
  const allItems = [];

  while (hasNextPage) {
    console.log(`Scraping page ${currentPage}...`);

    // Wait for products to load (Ensure the page has finished loading)
    await page.waitForSelector('.css-1fgrh1r');

    // Scrape product links on the current page
    const items = await page.evaluate(() => {
      const items = [];
      const productElements = document.querySelectorAll('.css-1fgrh1r a');
      productElements.forEach((productLink) => {
        const url = productLink.getAttribute('href')?.trim();
        if (url) {
          items.push(url);
        }
      });
      return items;
    });

    allItems.push(...items);

    // Check for the "next page" button
    const nextPageUrl = await page.evaluate(() => {
      // <a display="flex" cursor="pointer" width="1" href="/sortiment/?p=3" class="css-17veatv ecpbukt0">Till sida 3</a>
      const nextPageButton = document.querySelector('.css-17veatv');
      return nextPageButton ? nextPageButton.href : null;
    });

    if (nextPageUrl) {
      console.log(nextPageUrl)
      await page.goto(nextPageUrl, { waitUntil: 'networkidle2' }); // Wait for the next page to fully load
      currentPage++;
    } else {
      hasNextPage = false; // No next page URL found, so stop
    }
  }

  console.log("Scraping complete!");
  console.log(`Collected ${allItems.length} product URLs.`);

  for (const [index, url] of allItems.entries()) {
    console.log(`Index: ${index}/${allItems.length}, URL: ${url}`);
    const product = await webscrapeIndividualDrinks(url, browser);
  
    // First, check if the product already exists
    db.get(`SELECT * FROM products WHERE url = ?`, [url], (err, existingProduct) => {
      if (err) {
        console.error('Error checking product:', err.message);
      } else if (existingProduct) {
        // If the product exists, update the existing record
        db.run(`
          UPDATE products 
          SET 
            country = ?, 
            brand = ?, 
            name = ?, 
            type = ?, 
            sub_type = ?, 
            description = ?,
            price = ?, 
            amount = ?,
            alcohol_percent = ?, 
            price_per_liter = ?, 
            price_per_percent = ?,
            price_per_liter_alcohol = ?
          WHERE url = ?
        `, [
          product.country || null,
          product.brand || null,
          product.name || null,
          product.type || null,
          product.subType || null,
          product.description || null,
          product.price || null,
          product.amount || null,
          product.alcoholPercent || null,
          product.pricePerLiter || null,
          product.pricePerPercent || null,
          product.pricePerLiterAlcohol || null,
          url
        ], (err) => {
          if (err) {
            console.error('Error updating product:', err.message);
          } else {
            console.log(`Product updated: ${product.name}`);
          }
        });
      } else {
        // If the product doesn't exist, insert a new record
        db.run(`
          INSERT INTO products (url, country, brand, name, type, sub_type, description, price, amount, alcohol_percent, price_per_liter, price_per_percent, price_per_liter_alcohol)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          url,
          product.country || null,
          product.brand || null,
          product.name || null,
          product.type || null,
          product.subType || null,
          product.description || null,
          product.price || null,
          product.amount || null,
          product.alcoholPercent || null,
          product.pricePerLiter || null,
          product.pricePerPercent || null,
          product.pricePerLiterAlcohol || null
        ], (err) => {
          if (err) {
            console.error('Error inserting product:', err.message);
          } else {
            console.log(`Product inserted: ${product.name}`);
          }
        });
      }
    });
  }
  
}

async function webscrapeIndividualDrinks(url, browser) {
  try {
    const page = await browser.newPage();
    await page.goto("https://www.systembolaget.se"+url, { waitUntil: 'networkidle2' });

    await page.waitForSelector(".css-1wsh82o");
    
    const product = await page.evaluate(() => {
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.innerText.trim() : '';
      };

      const getAttribute = (selector, attribute) => {
        const element = document.querySelector(selector);
        return element ? element.getAttribute(attribute) : '';
      };
      
      const parseNumber = (text, regex) => {
        if (!text) return 0;
        const cleanedText = text.replace(/[^\d,.-]/g, '').replace(/\s+/g, '').replace(',', '.');
        const match = cleanedText.match(regex);
        return match ? parseFloat(match[0]) : 0;
      };

      const getChildFromDiv = (parentQuery, childQuery) => {
        const parentDiv = document.querySelector(parentQuery); // Find the parent
        if (parentDiv) {
          const description = parentDiv.querySelector(childQuery); // Find the child
          return description ? description.textContent : null;
        }
        return null;
      };

      const country = getAttribute('.css-r9u0bx', 'name'); // Country of origin
      const brand = getText('h1.css-1uk1gs8 p.css-m7kuem'); // First <p> in <h1> for the brand
      const name = getText('h1.css-1uk1gs8 p.css-1mvo2ni');
      const type = getText('.css-3pl8w3.eqfj59s0'); // This will get the text of the first <a> tag (Öl)
      const subType = getText('.css-3pl8w3.eqfj59s0:nth-child(2)'); // This will get the text of the second <a> tag (Ljus lager)
      const description = getChildFromDiv('.css-1ixxwv1', '.css-173act9') || 'No description available.';

      const priceText = getText('.css-ylm6mu'); // Price text (e.g., "77:-")
      const price = parseNumber(priceText, /\d+([,\.]\d+)?/); // Extract numeric price
      const pricePerLiterText = getText('.css-d2oo9m p:last-child'); // Price per liter text (e.g., "102:67 kr/l")
      const pricePerLiter = Math.round(parseNumber(pricePerLiterText, /\d+([,\.]\d+)?/) * 100) / 100; // Extract numeric price per liter

      const amount = Math.round(price / pricePerLiter * 100) / 100;

      const alcoholText = getText('p.css-1sy82wm.e1o91dat0:last-child'); // Alcohol content text (e.g., "13 % vol.")
      const alcoholPercent = parseNumber(alcoholText, /\d+([,\.]\d+)?/); // Extract alcohol percentage
      const pricePerLiterAlcohol = price / (amount * (alcoholPercent/100))
      const pricePerPercent = Math.round(pricePerLiter / alcoholPercent * 100) / 100;
    

      return {
        name,
        brand,
        subType,
        country,
        price,
        amount,
        alcoholPercent,
        pricePerLiter,
        pricePerLiterAlcohol,
        pricePerPercent,
        type,
        description
      };
    });

    console.log(product);
    await page.close();
    return product;
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    return null; // Return a placeholder or null
  }
}

webscrapeMainpage();
