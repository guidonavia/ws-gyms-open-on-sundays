import puppeteer, { Puppeteer, PuppeteerError } from "puppeteer";
import { createObjectCsvWriter } from 'csv-writer';
import dotenv from 'dotenv';

dotenv.config();

const gymURL = process.env.GYM_URL;
const facilitiesSelector = process.env.GYM_SELECTOR_FACILITIES;
const nameSelector = process.env.GYM_SELECTOR_NAME;
const locationSelector = process.env.GYM_SELECTOR_LOCATION;
const scheduleSelector = process.env.GYM_SELECTOR_SCHEDULE;
const buttonSelector = process.env.GYM_SELECTOR_LOAD_MORE_BTN;

async function obtainGymInfo(page) {
    
    const scrapingResults = await page.evaluate((facilitiesSelector, nameSelector, locationSelector, scheduleSelector) => {
        const facilitiesInDOM = document.querySelectorAll(facilitiesSelector); 
        
        const scrapedFacilities = Array.from(facilitiesInDOM).map(facility => {

            const name = facility.querySelector(nameSelector)?.innerText;
            const location = facility.querySelector(locationSelector)?.innerText;
            const hours = Array.from(facility.querySelectorAll(scheduleSelector)).map(p => p.innerText);            
            return { name, location, hours };

          });

        return { scrapedFacilities };
    }, facilitiesSelector, nameSelector, locationSelector, scheduleSelector);
    
    return scrapingResults;
}


function validateHoursInput(hours){

    return hours.some(h => 
        h.toLowerCase().includes('domingo') &&
        !h.toLowerCase().includes('cerrado')
      );
      
}


async function infiniteScroll(page, facilitiesSelector, buttonSelector) {
    let loadMore = true;
    let maxClicks = 20;
  
    while (loadMore && maxClicks > 0) {
      const prevCount = await page.evaluate((selector) =>
        document.querySelectorAll(selector).length, facilitiesSelector
      );
  
      const button = await page.$(buttonSelector);
  
      if (!button) break;
  
      await button.click();
  
      await page.waitForFunction((prev, selector) => {
        return document.querySelectorAll(selector).length > prev;
      }, {}, prevCount, facilitiesSelector);
  
      maxClicks--;
    }
}


async function saveToCSV(data, fileName = 'gyms_open_on_sundays.csv') {
    
    const csvWriter = createObjectCsvWriter({
        path: fileName,
        header: [
        { id: 'name', title: 'Name' },
        { id: 'location', title: 'Location' },
        { id: 'hours', title: 'Hours' }
        ]
    });

    const formattedData = data.map(item => ({
        name: item.name,
        location: item.location,
        hours: item.hours.join(' | ')
    }));

    await csvWriter.writeRecords(formattedData);
    console.log(`Data saved in: ${fileName}`);
}


const main = async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: false
    });
    const page = await browser.newPage();
    await page.goto(gymURL, {waitUntil: "networkidle0"});
    await infiniteScroll(page, facilitiesSelector, buttonSelector);
    const { scrapedFacilities } = await obtainGymInfo(page);
    const gymsOpenedOnSunday = scrapedFacilities.filter(facility => validateHoursInput(facility.hours));    
    console.log(JSON.stringify(gymsOpenedOnSunday, null, 2));
    await browser.close();
    await saveToCSV(gymsOpenedOnSunday);
}

main();