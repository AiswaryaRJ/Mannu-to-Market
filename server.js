require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function callGemma(promptText) {
  const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });
  const result = await model.generateContent(promptText);
  const content = result.response.text();
  return { content, rawData: result };
}

async function callGemmaVision(promptText, base64Image) {
  // Strip the data URL prefix to get raw base64
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const mimeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent([
    promptText,
    { inlineData: { data: base64Data, mimeType } }
  ]);
  const content = result.response.text();
  return { content, rawData: result };
}

const verifiedFarmers = {
  "KL-IDK-0472": { name: "Ravi Kumar", verifiedRegion: "Idukki", verifiedCrops: ["idukki_cardamom"] },
  "KL-WYD-0891": { name: "Suresh Nair", verifiedRegion: "Wayanad", verifiedCrops: ["wayanad_pepper"] },
  "KL-IDK-0203": { name: "Meena Thomas", verifiedRegion: "Idukki", verifiedCrops: ["idukki_cardamom"] },
  "KL-PEND-0000": { name: "Pending Farmer", verifiedRegion: "Wayanad", verifiedCrops: ["wayanad_pepper"], status: "pending" }
};

const referenceData = {
  'wayanad_pepper': {region: 'Wayanad', harvest_months: ['December','January','February'], method: 'shade-grown'},
  'idukki_cardamom': {region: 'Idukki', harvest_months: ['August','September','October','November'], method: 'shade-grown'}
};

const regionBoundaries = {
  'idukki':  { minLat: 9.70,  maxLat: 10.15, minLng: 76.85, maxLng: 77.25 },
  'wayanad': { minLat: 11.55, maxLat: 11.95, minLng: 75.95, maxLng: 76.35 }
};

app.post('/api/verify', async (req, res) => {
  try {
    const { crop, region, harvestMonth, method, farmerId, gpsLat, gpsLng } = req.body;

    const farmer = verifiedFarmers[farmerId];
    if (!farmer) {
      return res.status(400).json({ error: "Farmer ID not found. Farmer must complete onboarding verification first." });
    }

    if (farmer.status === "pending") {
      return res.status(400).json({ error: "This farmer's onboarding is still pending officer land verification. Certificate cannot be issued until verification is complete." });
    }
    const cropKey = crop.toLowerCase().replace(' ', '_');
    if (!farmer.verifiedCrops.includes(cropKey)) {
      return res.status(400).json({ error: `This farmer is not verified to grow ${crop}. Flagged for officer review.` });
    }

    const methodMap = {
      "Shade-grown/Traditional": "shade-grown",
      "Intensive/Modern": "intensive"
    };
    const normalizedMethod = methodMap[method] || method;
    const expectedData = referenceData[cropKey];

    // GPS boundary check (pure JS, not sent to Gemma)
    let gpsFlag = null;
    if (gpsLat != null && gpsLng != null) {
      const bounds = regionBoundaries[region.toLowerCase()];
      if (bounds) {
        const inBounds = gpsLat >= bounds.minLat && gpsLat <= bounds.maxLat
                      && gpsLng >= bounds.minLng && gpsLng <= bounds.maxLng;
        if (!inBounds) {
          gpsFlag = 'gps';
        }
      }
    }

    const promptText = `You are a supply-chain verification assistant. Compare the farmer
submission against this reference data ONLY. Do not use outside
knowledge.

REFERENCE DATA:
{
  'wayanad_pepper': {region: 'Wayanad', harvest_months: ['December','January','February'], method: 'shade-grown'},
  'idukki_cardamom': {region: 'Idukki', harvest_months: ['August','September','October','November'], method: 'shade-grown'}
}

SUBMISSION: crop=${crop}, region=${region}, harvest_month=${harvestMonth}, method=${normalizedMethod}

Check if harvest_month is in the reference crop's harvest_months list,
if region matches (case-insensitive, normalize both to lowercase before checking), 
and if method matches. Output ONLY this JSON, no
reasoning, no markdown:
{"match_status": "consistent" or "inconsistent", "flags": [], "confidence_note": ""}`;

    const { content: rawResponse, rawData } = await callGemma(promptText);
    
    console.log("RAW GEMMA RESPONSE:", rawResponse);

    // Parse safely
    let cleanResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonStart = cleanResponse.indexOf('{');
    const jsonEnd = cleanResponse.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
      cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
    }

    if (!cleanResponse || cleanResponse.length < 10) {
      console.log("Empty or short response from Gemma. Raw response object:", JSON.stringify(rawData, null, 2));
    }

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error("JSON parse failed. Cleaned text:", cleanResponse);
      console.error("Parse Error:", parseError);
      return res.status(500).json({ error: "Failed to parse verification response." });
    }
    
    // Attach expected data for frontend display
    jsonResponse.expectedData = expectedData;
    jsonResponse.submittedData = { region, harvestMonth, normalizedMethod, gpsLat, gpsLng };

    // Merge GPS flag if present
    if (gpsFlag && !jsonResponse.flags.includes(gpsFlag)) {
      jsonResponse.flags.push(gpsFlag);
      if (jsonResponse.match_status !== 'inconsistent') {
        jsonResponse.match_status = 'inconsistent';
      }
    }

    res.json(jsonResponse);

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Failed to verify submission. Please try again later." });
  }
});

app.post('/api/certificate', async (req, res) => {
  try {
    const { crop, region, harvestMonth, method, farmerId } = req.body;

    let farmerName = "Verified Farmer";
    if (verifiedFarmers[farmerId]) {
      farmerName = verifiedFarmers[farmerId].name;
    }

    const promptText = `Write a short 3-4 sentence provenance certificate in English, then
translate it to Malayalam. Use only these verified facts: farmer=${farmerName}, crop=${crop},
region=${region}, harvested in ${harvestMonth}, method=${method}. Do not invent details.
Format output as:
ENGLISH: <text>
MALAYALAM: <text>`;

    const certificateId = `CERT-${Date.now()}`;
    const { content: response } = await callGemma(promptText);
    res.json({ certificate: response, farmerName, farmerId, certificateId });

  } catch (error) {
    console.error("Certificate generation error:", error);
    res.status(500).json({ error: "Failed to generate certificate." });
  }
});

app.post('/api/vision', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.json({ result: "UNCLEAR" });

    const promptText = "Look at this image. Does it show cardamom pods or pepper corns? Respond with ONLY one word: CARDAMOM, PEPPER, or UNCLEAR.";
    const { content } = await callGemmaVision(promptText, image);
    
    const cleaned = content.trim().toUpperCase();
    let result = "UNCLEAR";
    if (cleaned.includes("CARDAMOM")) result = "CARDAMOM";
    else if (cleaned.includes("PEPPER")) result = "PEPPER";

    res.json({ result });
  } catch (error) {
    console.error("Vision API error:", error);
    res.json({ result: "ERROR" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
