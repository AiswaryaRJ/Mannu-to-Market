# Mannu to Market

## Problem Statement

Kerala grows some of the world's most valuable spices — Wayanad pepper, Idukki cardamom — spices that are GI-tagged, meaning they are legally recognized as authentic to their region. That recognition should mean farmers get a premium price for genuine produce. But today, there is no way for a farmer to actually prove their pepper is real Wayanad pepper, and no way for a buyer to tell it apart from cheaper, mixed, or fake produce sold under the same name. As a result, genuine farmers lose the premium they've earned, while fakes ride on the region's reputation.

## Project Description

**Mannu to Market** is an AI-powered platform that generates verified provenance certificates for spice harvests, so farmers can prove authenticity and buyers can trust what they're paying for.

**How it works:**

1. A farmer brings their harvest to their local cooperative, as they already do. Instead of filling out a form, they simply *speak* — in Malayalam — about their harvest: crop, region, harvest date, and cultivation method. The cooperative agent enters this through our app.
2. A GPS-tagged photo is taken at that moment, so the location claim isn't just words.
3. **Gemma** checks the submission against a small reference dataset of known harvest seasons and cultivation methods for that region. If it's consistent, Gemma generates a certificate — in English for buyers, in Malayalam for the farmer — with a QR code attached.
4. If something looks off (e.g. a wrong harvest month), the system doesn't reject it outright — it asks a simple clarifying question first, since most mismatches are honest mistakes rather than fraud.
5. The farmer receives an independent SMS on their own phone confirming exactly what was logged in their name, giving them a chance to catch any agent errors.
6. Any buyer or consumer down the supply chain can scan the QR code to instantly see the verified story: origin, cultivation method, an indicative fair price range, and a sustainability score.

**Trust and anti-fraud layers:** GPS verification, tamper-evident hashing so certificates can't be secretly edited, anomaly detection to catch a QR code being copied onto fake products, and agent accountability scoring to flag suspicious patterns over time — backed up by random physical spot-checks, the same way organic or ISO certification works. The goal isn't to claim AI eliminates fraud alone, but to make it harder and route anything suspicious to human follow-up.

**Scope of this build:** Within a 16-hour build window, the project focuses on two pilot crops — Idukki cardamom and Wayanad pepper — with the full verification, certificate, and fraud-detection pipeline working end-to-end. Full satellite-based farm verification and blockchain storage are on the roadmap but not part of this build.

**End result:** Farmers who are already growing genuine, high-value spice finally have a way to prove it — without needing to read, type, or own a smartphone — so they can access buyers and prices that were previously out of reach.

## Google AI Usage

### Tools / Models Used
- Gemma

### Tech Stack Used
- *(add your stack here, e.g. frontend, backend, database, APIs)*

### How Google AI Was Used
Gemma was chosen for this project because it is lightweight enough to run in low-connectivity rural areas and strong at multilingual reasoning. It powers:
- Voice-to-structured-data conversion for the Malayalam harvest description
- Consistency checks against regional harvest-season and cultivation-method reference data
- Bilingual (English/Malayalam) certificate generation
- Clarifying-question generation when a submission looks inconsistent, rather than an outright rejection

## GitHub Repo Link of the Project

[Link of the github repository]

## Proof of Google AI Usage

Included in the `/proofs` folder.

## Screenshots

Added in the `/screenshots` folder.

## Demo Video

[Watch Demo](#) *(upload to Google Drive and paste the shareable link — max 3 minutes)*

## Installation Steps

*(add step-by-step instructions to run the project here)*
