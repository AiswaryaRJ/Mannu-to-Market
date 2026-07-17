const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
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

app.post('/api/verify', async (req, res) => {
  try {
    const { crop, region, date, method } = req.body;

    const monthNames = ["January","February","March","April","May","June",
      "July","August","September","October","November","December"];
    const dateObj = new Date(date);
    const harvestMonthName = monthNames[dateObj.getMonth()];

    const methodMap = {
      "Shade-grown/Traditional": "shade-grown",
      "Intensive/Modern": "intensive"
    };
    const normalizedMethod = methodMap[method] || method;

    const promptText = `You are a supply-chain verification assistant. Compare the farmer
submission against this reference data ONLY. Do not use outside
knowledge.

REFERENCE DATA:
{
  'wayanad_pepper': {region: 'Wayanad', harvest_months: ['December','January','February'], method: 'shade-grown'},
  'idukki_cardamom': {region: 'Idukki', harvest_months: ['August','September','October','November'], method: 'shade-grown'}
}

SUBMISSION: crop=${crop}, region=${region}, harvest_month=${harvestMonthName}, method=${normalizedMethod}

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

    res.json(jsonResponse);

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Failed to verify submission. Please try again later." });
  }
});

app.post('/api/certificate', async (req, res) => {
  try {
    const { crop, region, date, method } = req.body;

    const monthNames = ["January","February","March","April","May","June",
      "July","August","September","October","November","December"];
    const dateObj = new Date(date);
    const harvestMonthName = monthNames[dateObj.getMonth()];

    const promptText = `Write a short 3-4 sentence provenance certificate in English, then
translate it to Malayalam. Use only these verified facts: crop=${crop},
region=${region}, date=${harvestMonthName}, method=${method}. Do not invent details.
Format output as:
ENGLISH: <text>
MALAYALAM: <text>`;

    const { content: response } = await callGemma(promptText);
    res.json({ certificate: response });

  } catch (error) {
    console.error("Certificate generation error:", error);
    res.status(500).json({ error: "Failed to generate certificate." });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
