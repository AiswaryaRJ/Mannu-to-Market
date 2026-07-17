document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('provenance-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');
    
    const resultSection = document.getElementById('result-section');
    const warningBox = document.getElementById('warning-box');
    const warningFlags = document.getElementById('warning-flags');
    const certificateCard = document.getElementById('certificate-card');
    
    const ecoBadge = document.getElementById('eco-badge');
    const certTextEn = document.getElementById('cert-text-en');
    const certTextMl = document.getElementById('cert-text-ml');
    const priceEstimate = document.getElementById('price-estimate');
    const qrcodeContainer = document.getElementById('qrcode');
    
    let qrCodeInstance = null;
    let capturedLat = null;
    let capturedLng = null;

    // GPS capture
    const captureGpsBtn = document.getElementById('capture-gps-btn');
    const gpsDisplay = document.getElementById('gps-display');
    const gpsManual = document.getElementById('gps-manual');

    captureGpsBtn.addEventListener('click', () => {
        captureGpsBtn.textContent = '📍 Locating...';
        captureGpsBtn.disabled = true;

        if (!navigator.geolocation) {
            showManualFallback();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                capturedLat = parseFloat(position.coords.latitude.toFixed(5));
                capturedLng = parseFloat(position.coords.longitude.toFixed(5));
                gpsDisplay.textContent = `📍 ${capturedLat}°N, ${capturedLng}°E`;
                gpsDisplay.classList.remove('hidden');
                gpsDisplay.classList.add('gps-captured');
                gpsManual.classList.add('hidden');
                captureGpsBtn.textContent = '✅ Location Captured';
                captureGpsBtn.disabled = false;
            },
            () => showManualFallback(),
            { timeout: 8000 }
        );
    });

    function showManualFallback() {
        captureGpsBtn.textContent = '📍 Capture Location';
        captureGpsBtn.disabled = false;
        gpsManual.classList.remove('hidden');
        gpsDisplay.classList.add('hidden');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide results initially
        resultSection.classList.add('hidden');
        warningBox.classList.add('hidden');
        certificateCard.classList.add('hidden');

        const checklistElReset = document.getElementById('verification-checklist');
        const checklistItemsReset = document.getElementById('checklist-items');
        if (checklistElReset) checklistElReset.classList.add('hidden');
        if (checklistItemsReset) checklistItemsReset.innerHTML = '';
        const mismatchBoxReset = document.getElementById('mismatch-metadata');
        if (mismatchBoxReset) { mismatchBoxReset.innerHTML = ''; mismatchBoxReset.classList.add('hidden'); }
        
        // Set loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Verifying...';
        loader.classList.remove('hidden');

        const manualLat = document.getElementById('manualLat').value;
        const manualLng = document.getElementById('manualLng').value;
        const gpsLat = capturedLat !== null ? capturedLat : (manualLat ? parseFloat(manualLat) : null);
        const gpsLng = capturedLng !== null ? capturedLng : (manualLng ? parseFloat(manualLng) : null);

        const formData = {
            farmerId: document.getElementById('farmerId').value.trim(),
            crop: document.getElementById('crop').value,
            region: document.getElementById('region').value,
            harvestMonth: document.getElementById('harvestMonth').value,
            method: document.getElementById('method').value,
            gpsLat,
            gpsLng
        };

        try {
            // Step 1: Verification
            const verifyResponse = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!verifyResponse.ok) {
                const errorData = await verifyResponse.json().catch(() => ({}));
                resultSection.classList.remove('hidden');
                warningBox.querySelector('h3').textContent = "Verification Failed";
                document.getElementById('warning-flags').textContent = errorData.error || "Verification request failed";
                warningBox.classList.remove('hidden');
                resetBtn();
                return;
            }

            const verifyData = await verifyResponse.json();

            resultSection.classList.remove('hidden');

            // --- Animated Verification Checklist ---
            const checklistEl = document.getElementById('verification-checklist');
            const checklistItems = document.getElementById('checklist-items');
            checklistEl.classList.remove('hidden');
            checklistItems.innerHTML = '';

            const flags = verifyData.flags || [];
            const submitted = verifyData.submittedData || {};
            const expected = verifyData.expectedData || {};

            const checks = [
              { field: 'region',       label: `Region: ${submitted.region || ''}`,                         passed: !flags.includes('region') },
              { field: 'harvest_month', label: `Harvest month: ${submitted.harvestMonth || ''}`,            passed: !flags.includes('harvest_month') },
              { field: 'method',       label: `Cultivation method: ${submitted.normalizedMethod || ''}`,   passed: !flags.includes('method') },
            ];

            // Add GPS check item if coordinates were submitted
            if (submitted.gpsLat != null && submitted.gpsLng != null) {
              const gpsLabel = `GPS location: ${submitted.gpsLat}°N, ${submitted.gpsLng}°E`;
              checks.push({ field: 'gps', label: gpsLabel, passed: !flags.includes('gps') });
            }

            checks.forEach((check, i) => {
              setTimeout(() => {
                const li = document.createElement('li');
                li.className = 'checklist-item ' + (check.passed ? 'check-pass' : 'check-fail');
                li.textContent = (check.passed ? '✅ ' : '❌ ') + check.label;
                checklistItems.appendChild(li);
              }, i * 400);
            });

            const finalDelay = checks.length * 400;

            if (verifyData.match_status === 'inconsistent') {
              setTimeout(() => {
                const li = document.createElement('li');
                li.className = 'checklist-item check-fail';
                li.textContent = '⚠️ Verification incomplete — review required';
                checklistItems.appendChild(li);
              }, finalDelay);

              setTimeout(() => {
                warningBox.querySelector('h3').textContent = 'Submission Needs Review';
                warningFlags.textContent = flags.length ? `Flagged fields: ${flags.join(', ')}` : 'Unknown issues';
                warningBox.classList.remove('hidden');

                // --- Mismatch Metadata Box ---
                const mismatchBox = document.getElementById('mismatch-metadata');
                mismatchBox.innerHTML = '';
                let hasMismatches = false;

                const fieldLabels = {
                  region: { submitted: submitted.region, expected: expected.region },
                  harvest_month: { submitted: submitted.harvestMonth, expected: (expected.harvest_months || []).join(' / ') },
                  method: { submitted: submitted.normalizedMethod, expected: expected.method },
                  gps: {
                    submitted: submitted.gpsLat != null ? `${submitted.gpsLat}°N, ${submitted.gpsLng}°E` : 'not provided',
                    expected: `within ${submitted.region || 'claimed region'} boundary`
                  }
                };

                flags.forEach(flag => {
                  const info = fieldLabels[flag];
                  if (info) {
                    hasMismatches = true;
                    const div = document.createElement('div');
                    div.className = 'mismatch-item';
                    div.innerHTML = `<span class="field-name">${flag.replace('_', ' ')}:</span> ` +
                      `<span class="submitted-val">${info.submitted}</span>` +
                      `<span class="expected-val">→ Expected: ${info.expected}</span>`;
                    mismatchBox.appendChild(div);
                  }
                });

                if (hasMismatches) mismatchBox.classList.remove('hidden');
                resetBtn();
              }, finalDelay + 400);
              return;
            }

            // Consistent — show final step then proceed to certificate
            setTimeout(() => {
              const li = document.createElement('li');
              li.className = 'checklist-item check-pass';
              li.textContent = '✅ Provenance Verified. Issuing certificate...';
              checklistItems.appendChild(li);
            }, finalDelay);

            // Step 2: Consistent - Generate Certificate (delayed to let checklist finish)
            btnText.textContent = 'Generating Certificate...';
            await new Promise(r => setTimeout(r, finalDelay + 800));
            
            const certResponse = await fetch('/api/certificate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!certResponse.ok) {
                throw new Error("Certificate generation request failed");
            }

            const certData = await certResponse.json();
            
            // Parse English and Malayalam text
            const certText = certData.certificate;
            let englishText = '';
            let malayalamText = '';
            
            const englishMatch = certText.match(/ENGLISH:\s*([\s\S]*?)(?=MALAYALAM:|$)/i);
            const malayalamMatch = certText.match(/MALAYALAM:\s*([\s\S]*)$/i);
            
            if (englishMatch) englishText = englishMatch[1].trim();
            if (malayalamMatch) malayalamText = malayalamMatch[1].trim();
            
            // Fallback if formatting isn't perfect
            if (!englishText && !malayalamText) {
                englishText = certText; 
            }

            // Populate UI
            certTextEn.textContent = englishText;
            certTextMl.textContent = malayalamText;
            
            const farmerIdDisplay = document.getElementById('farmer-id-display');
            if (farmerIdDisplay) {
                farmerIdDisplay.textContent = `Farmer ID: ${certData.farmerId} (${certData.farmerName}) — Verified at Onboarding`;
            }

            // Certificate ID
            const certIdEl = document.getElementById('cert-id');
            if (certIdEl && certData.certificateId) {
                certIdEl.textContent = certData.certificateId;
            }
            
            // Eco Badge
            if (formData.method === 'Shade-grown/Traditional') {
                ecoBadge.textContent = 'High Sustainability';
                ecoBadge.className = 'badge high';
            } else {
                ecoBadge.textContent = 'Medium Sustainability';
                ecoBadge.className = 'badge medium';
            }
            
            // Price Estimator
            priceEstimate.textContent = `₹1,800–2,200/kg for verified ${formData.crop}`;
            
            // QR Code
            qrcodeContainer.innerHTML = '';
            qrCodeInstance = new QRCode(qrcodeContainer, {
                text: `https://mannu-to-market.local/verify?crop=${encodeURIComponent(formData.crop)}&region=${encodeURIComponent(formData.region)}&month=${encodeURIComponent(formData.harvestMonth)}`,
                width: 100,
                height: 100,
                colorDark : "#2e7d32",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            
            // Photo Preview and Vision Call
            const photoInput = document.getElementById('photo');
            const photoPreviewContainer = document.getElementById('photo-preview-container');
            const photoPreviewImg = document.getElementById('photo-preview-img');
            const visionBadge = document.getElementById('vision-badge');
            
            if (visionBadge) {
                visionBadge.className = 'vision-badge hidden';
                visionBadge.textContent = '';
            }

            if (photoInput.files && photoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    const base64Image = e.target.result;
                    photoPreviewImg.src = base64Image;
                    photoPreviewContainer.classList.remove('hidden');

                    if (visionBadge) {
                        try {
                            visionBadge.textContent = 'Analyzing image...';
                            visionBadge.className = 'vision-badge';
                            
                            const visionResponse = await fetch('/api/vision', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ image: base64Image })
                            });
                            const visionData = await visionResponse.json();
                            
                            const claimedCrop = formData.crop.toUpperCase();
                            let isMatch = false;
                            if (claimedCrop.includes('CARDAMOM') && visionData.result === 'CARDAMOM') isMatch = true;
                            if (claimedCrop.includes('PEPPER') && visionData.result === 'PEPPER') isMatch = true;

                            if (visionData.result === 'UNCLEAR' || visionData.result === 'ERROR') {
                                visionBadge.classList.add('hidden'); 
                            } else if (isMatch) {
                                visionBadge.textContent = '✅ Image consistent with claimed crop type';
                                visionBadge.className = 'vision-badge success';
                            } else {
                                visionBadge.textContent = '⚠️ Uploaded image does not appear to match claimed crop type — flagged for review';
                                visionBadge.className = 'vision-badge warning';
                            }
                        } catch (err) {
                            console.error('Vision API error:', err);
                            visionBadge.classList.add('hidden');
                        }
                    }
                }
                reader.readAsDataURL(photoInput.files[0]);
            } else {
                photoPreviewContainer.classList.add('hidden');
                photoPreviewImg.src = '';
            }

            // Show certificate
            certificateCard.classList.remove('hidden');

        } catch (error) {
            console.error("Error during submission:", error);
            alert("An error occurred during submission. Please try again.");
        } finally {
            resetBtn();
        }
    });

    function resetBtn() {
        submitBtn.disabled = false;
        btnText.textContent = 'Verify & Generate';
        loader.classList.add('hidden');
    }
});
