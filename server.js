const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function callGemma(promptText) {
  const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-4-e4b",
      messages: [{ role: "user", content: promptText }],
      temperature: 0.3,
      max_tokens: 1500
    })
  });
  const data = await response.json();
  return { content: data.choices[0]?.message?.content || "", rawData: data };
}

async function callGemmaVision(promptText, base64Image) {
  const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-4-e4b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    })
  });
  const data = await response.json();
  return { content: data.choices[0]?.message?.content || "", rawData: data };
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
    const { crop, region, harvestMonth, method, farmerId, gpsLat, gpsLng, manualEntry, imageResult } = req.body;

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

    const promptText = `You are a strict agricultural supply-chain verification system.

TASK:
Validate whether the farmer’s submitted data is consistent and trustworthy.

INPUT:
- Crop: ${crop}
- Region: ${region}
- Harvest Month: ${harvestMonth}
- Method: ${normalizedMethod}
- GPS Coordinates: ${gpsLat != null ? gpsLat : 'Not provided'}, ${gpsLng != null ? gpsLng : 'Not provided'}
- Manual Coordinates Used: ${manualEntry}

REFERENCE RULES:
- Idukki Cardamom → Harvest: Aug–Nov → Method: shade-grown
- Wayanad Pepper → Harvest: Dec–Feb → Method: shade-grown

VALIDATION STEPS:
1. Check if crop matches region
2. Check if harvest month is valid for crop
3. Check if farming method is correct
4. If GPS present:
   - Validate if coordinates fall inside expected region

OUTPUT STRICT JSON ONLY:
{
  "match_status": "consistent | inconsistent",
  "flags": [],
  "confidence_score": 0-1,
  "final_decision": "APPROVE | REJECT | REVIEW",
  "reason": ""
}

DECISION RULES:
- Any major mismatch (crop, region, harvest, method) → REJECT
- REVIEW only if multiple inconsistencies exist

DO NOT:
- Add explanation outside JSON
- Add markdown
- Add extra text`;

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

    if (!jsonResponse.flags) {
      jsonResponse.flags = [];
    }

    // Merge GPS flag if present
    if (gpsFlag && !jsonResponse.flags.includes(gpsFlag)) {
      jsonResponse.flags.push(gpsFlag);
      jsonResponse.match_status = 'inconsistent';
      jsonResponse.final_decision = 'REJECT';
    }

    // Merge Image/Vision verification result rules
    if (imageResult) {
      const claimed = crop.toLowerCase();
      if (imageResult === 'UNCLEAR') {
        if (!jsonResponse.flags.includes('vision_unclear')) {
          jsonResponse.flags.push('vision_unclear');
        }
        if (jsonResponse.final_decision === 'APPROVE') {
          jsonResponse.final_decision = 'REVIEW';
        }
      } else if (
        (claimed.includes('cardamom') && imageResult === 'PEPPER') ||
        (claimed.includes('pepper') && imageResult === 'CARDAMOM')
      ) {
        if (!jsonResponse.flags.includes('image_mismatch')) {
          jsonResponse.flags.push('image_mismatch');
        }
        jsonResponse.match_status = 'inconsistent';
        jsonResponse.final_decision = 'REJECT';
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
    const { image, crop } = req.body;
    if (!image) return res.json({ final_decision: "REVIEW", reason: "No image uploaded" });

    // Use a simple, robust classification prompt for the local vision model
    const promptText = "Look at this image. Does it show cardamom pods or pepper corns? Respond with ONLY one word: CARDAMOM, PEPPER, or UNCLEAR.";
    const { content } = await callGemmaVision(promptText, image);
    
    const cleaned = content.trim().toUpperCase();
    let detected = "UNCLEAR";
    if (cleaned.includes("CARDAMOM")) {
      detected = "CARDAMOM";
    } else if (cleaned.includes("PEPPER")) {
      detected = "PEPPER";
    }

    const claimed = crop.toLowerCase();
    const isMismatch = (claimed.includes('cardamom') && detected === 'PEPPER') ||
                       (claimed.includes('pepper') && detected === 'CARDAMOM');

    const final_decision = isMismatch ? "REJECT" : (detected === "UNCLEAR" ? "REVIEW" : "APPROVE");
    const reason = isMismatch ? `Image does not match declared crop. Detected: ${detected}` : (detected === "UNCLEAR" ? "Image unclear — manual review required" : "Image consistent with claimed crop type");

    res.json({
      image_detected: detected,
      match_status: isMismatch ? "inconsistent" : "consistent",
      flags: isMismatch ? ["image_mismatch"] : (detected === "UNCLEAR" ? ["vision_unclear"] : []),
      final_decision,
      reason
    });
  } catch (error) {
    console.error("Vision API error:", error);
    res.json({ final_decision: "REVIEW", reason: "Vision classification failed", image_detected: "UNCLEAR" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
