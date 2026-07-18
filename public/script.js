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
    let voiceText = '';
    let voiceUsed = false;

    // GPS elements
    const captureGpsBtn = document.getElementById('capture-gps-btn');
    const gpsDisplay = document.getElementById('gps-display');
    const gpsStatus = document.getElementById('gps-status');
    const gpsManualToggle = document.getElementById('gps-manual-toggle');
    const gpsAutoSection = document.getElementById('gps-auto-section');
    const gpsManualSection = document.getElementById('gps-manual-section');
    const manualLatEl = document.getElementById('manualLat');
    const manualLngEl = document.getElementById('manualLng');
    const gpsManualDisplay = document.getElementById('gps-manual-display');
    const gpsErrorMessage = document.getElementById('gps-error-message');

    // Helper: format coordinates in readable notation
    function formatCoordinates(lat, lng) {
        if (lat == null || lng == null) return '';
        const latDirection = lat >= 0 ? 'N' : 'S';
        const lngDirection = lng >= 0 ? 'E' : 'W';
        return `${Math.abs(lat).toFixed(5)}° ${latDirection}, ${Math.abs(lng).toFixed(5)}° ${lngDirection}`;
    }

    // Toggle logic
    gpsManualToggle.addEventListener('change', () => {
        if (gpsManualToggle.checked) {
            gpsAutoSection.classList.add('hidden');
            gpsManualSection.classList.remove('hidden');
            validateLocationInput();
        } else {
            gpsAutoSection.classList.remove('hidden');
            gpsManualSection.classList.add('hidden');
            // If GPS location not captured, enable submit but it's optional unless requested
            submitBtn.disabled = false;
            gpsErrorMessage.classList.add('hidden');
        }
    });

    // Capture GPS coordinates automatically
    captureGpsBtn.addEventListener('click', () => {
        captureGpsBtn.textContent = '📍 Locating...';
        captureGpsBtn.disabled = true;

        if (!navigator.geolocation) {
            gpsStatus.textContent = 'Geolocation not supported by browser.';
            captureGpsBtn.textContent = '📍 Capture Location';
            captureGpsBtn.disabled = false;
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                capturedLat = parseFloat(position.coords.latitude.toFixed(5));
                capturedLng = parseFloat(position.coords.longitude.toFixed(5));
                
                // Show green badge
                gpsDisplay.innerHTML = `<span class="badge high" style="background-color: var(--clr-success); margin-bottom: 0.3rem; display: inline-block;">📍 Location Captured</span><br>${formatCoordinates(capturedLat, capturedLng)}`;
                gpsDisplay.classList.remove('hidden');
                gpsDisplay.classList.add('gps-captured');
                gpsStatus.textContent = 'Location captured';
                captureGpsBtn.textContent = '✅ Location Captured';
                captureGpsBtn.disabled = false;
            },
            (error) => {
                gpsStatus.textContent = 'Location capture failed. Switch to manual entry.';
                captureGpsBtn.textContent = '📍 Capture Location';
                captureGpsBtn.disabled = false;
            },
            { timeout: 8000 }
        );
    });

    // Validate manual coordinate inputs
    function validateLocationInput() {
        if (!gpsManualToggle.checked) {
            submitBtn.disabled = false;
            gpsErrorMessage.classList.add('hidden');
            return;
        }

        const latVal = manualLatEl.value.trim();
        const lngVal = manualLngEl.value.trim();

        if (latVal === '' || lngVal === '') {
            gpsErrorMessage.textContent = 'Latitude and Longitude values are required.';
            gpsErrorMessage.classList.remove('hidden');
            gpsManualDisplay.classList.add('hidden');
            submitBtn.disabled = true;
            return;
        }

        const lat = parseFloat(latVal);
        const lng = parseFloat(lngVal);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            gpsErrorMessage.textContent = 'Latitude must be a valid number between -90 and 90.';
            gpsErrorMessage.classList.remove('hidden');
            gpsManualDisplay.classList.add('hidden');
            submitBtn.disabled = true;
            return;
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            gpsErrorMessage.textContent = 'Longitude must be a valid number between -180 and 180.';
            gpsErrorMessage.classList.remove('hidden');
            gpsManualDisplay.classList.add('hidden');
            submitBtn.disabled = true;
            return;
        }

        // Show yellow badge on success
        gpsErrorMessage.classList.add('hidden');
        gpsManualDisplay.innerHTML = `<span class="badge medium" style="background-color: var(--clr-gold); margin-bottom: 0.3rem; display: inline-block; color: white;">⚠️ Manual Location (Lower Trust)</span><br>${formatCoordinates(lat, lng)}`;
        gpsManualDisplay.classList.remove('hidden');
        submitBtn.disabled = false;
    }

    manualLatEl.addEventListener('input', validateLocationInput);
    manualLngEl.addEventListener('input', validateLocationInput);

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

        const manualEntry = gpsManualToggle.checked;
        const gpsLat = manualEntry ? (manualLatEl.value ? parseFloat(manualLatEl.value) : null) : capturedLat;
        const gpsLng = manualEntry ? (manualLngEl.value ? parseFloat(manualLngEl.value) : null) : capturedLng;

        const formData = {
            farmerId: document.getElementById('farmerId').value.trim(),
            crop: document.getElementById('crop').value,
            region: document.getElementById('region').value,
            harvestMonth: document.getElementById('harvestMonth').value,
            method: document.getElementById('method').value,
            gpsLat,
            gpsLng,
            manualEntry,
            voiceText,
            voiceUsed
        };

        const voiceWarning = document.getElementById('voice-warning');
        if (!voiceUsed && voiceWarning) {
            voiceWarning.classList.remove('hidden');
        } else if (voiceWarning) {
            voiceWarning.classList.add('hidden');
        }

        const photoInput = document.getElementById('photo');
        const photoPreviewContainer = document.getElementById('photo-preview-container');
        const photoPreviewImg = document.getElementById('photo-preview-img');
        const visionBadge = document.getElementById('vision-badge');
        
        if (visionBadge) {
            visionBadge.className = 'vision-badge hidden';
            visionBadge.textContent = '';
        }

        let imageResult = null;
        let base64Image = null;

        try {
            // STEP 1: Image Analysis Integration (if image uploaded)
            if (photoInput.files && photoInput.files[0]) {
                btnText.textContent = 'Analyzing image...';
                
                base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result);
                    reader.onerror = (err) => reject(err);
                    reader.readAsDataURL(photoInput.files[0]);
                });

                photoPreviewImg.src = base64Image;
                photoPreviewContainer.classList.remove('hidden');

                const visionResponse = await fetch('/api/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: base64Image,
                        fileName: photoInput.files[0].name,
                        crop: formData.crop,
                        region: formData.region,
                        harvestMonth: formData.harvestMonth,
                        method: formData.method
                    })
                });

                if (!visionResponse.ok) {
                    throw new Error("Vision classification failed");
                }

                const visionData = await visionResponse.json();
                imageResult = visionData.image_detected || 'UNCLEAR';

                const claimedCrop = formData.crop.toLowerCase();
                const isMismatch = (claimedCrop.includes('cardamom') && imageResult === 'PEPPER') ||
                                   (claimedCrop.includes('pepper') && imageResult === 'CARDAMOM');

                if (isMismatch) {
                    // BLOCK submission immediately
                    resultSection.classList.remove('hidden');
                    warningBox.querySelector('h3').textContent = "Mismatch Detected";
                    warningFlags.textContent = `❌ Mismatch Detected: ${imageResult} image uploaded for ${formData.crop}`;
                    warningBox.classList.remove('hidden');
                    
                    if (visionBadge) {
                        const titleCasedResult = imageResult.charAt(0).toUpperCase() + imageResult.slice(1).toLowerCase();
                        const titleCasedClaimed = claimedCrop.includes('cardamom') ? 'Cardamom' : 'Pepper';
                        visionBadge.textContent = `❌ Mismatch Detected: ${titleCasedResult} image uploaded for ${titleCasedClaimed}`;
                        visionBadge.className = 'vision-badge warning';
                    }
                    resetBtn();
                    return;
                }

                // UI Feedback for Match or Unclear
                if (imageResult === 'UNCLEAR') {
                    if (visionBadge) {
                        visionBadge.textContent = '⚠️ Image unclear — manual review required';
                        visionBadge.className = 'vision-badge warning';
                    }
                } else {
                    if (visionBadge) {
                        const titleCasedResult = imageResult.charAt(0).toUpperCase() + imageResult.slice(1).toLowerCase();
                        visionBadge.textContent = `✅ Image Verified: ${titleCasedResult}`;
                        visionBadge.className = 'vision-badge success';
                    }
                }
            } else {
                photoPreviewContainer.classList.add('hidden');
                photoPreviewImg.src = '';
            }

            // Include vision result in verification request payload
            formData.imageResult = imageResult;
            btnText.textContent = 'Verifying...';

            // Step 2: Verification
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

            if (imageResult) {
              const visionLabel = imageResult === 'UNCLEAR' ? 'Image analysis: Unclear' : `Image analysis: Consistent (${imageResult})`;
              checks.push({ field: 'vision', label: visionLabel, passed: imageResult !== 'UNCLEAR' });
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
            const isRejected = verifyData.final_decision === 'REJECT' || verifyData.match_status === 'inconsistent';
            const isReview = verifyData.final_decision === 'REVIEW';

            if (isRejected || isReview) {
              setTimeout(() => {
                const li = document.createElement('li');
                li.className = 'checklist-item check-fail';
                li.textContent = isRejected ? '❌ Verification failed — reject certificate' : '⚠️ Verification incomplete — review required';
                checklistItems.appendChild(li);
              }, finalDelay);

              setTimeout(() => {
                warningBox.querySelector('h3').textContent = isRejected ? 'Submission Rejected' : 'Submission Needs Review';
                warningFlags.textContent = verifyData.reason || (flags.length ? `Flagged: ${flags.join(', ')}` : 'Inconsistent verification data');
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
                  },
                  manual_entry: {
                    submitted: 'Manual Entry Used',
                    expected: 'Automatic GPS preferred'
                  },
                  vision_unclear: {
                    submitted: 'Unclear',
                    expected: `Consistent with ${formData.crop}`
                  },
                  image_mismatch: {
                    submitted: imageResult || 'Mismatched',
                    expected: formData.crop
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
                if (isRejected) {
                  resetBtn();
                }
              }, finalDelay + 400);

              if (isRejected) {
                return;
              }
            }

            // Consistent or Review — show progress then proceed to certificate
            setTimeout(() => {
              const li = document.createElement('li');
              li.className = 'checklist-item check-pass';
              li.textContent = isReview ? '⚠️ Proceeding with manual review flag...' : '✅ Provenance Verified. Issuing certificate...';
              checklistItems.appendChild(li);
            }, finalDelay);

            // Step 3: Consistent/Review - Generate Certificate (delayed to let checklist finish)
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

    // --- Voice Confirmation Logic ---
    const cropSelect = document.getElementById('crop');
    const regionSelect = document.getElementById('region');
    const voiceCropName = document.getElementById('voice-crop-name');
    const voiceRegionName = document.getElementById('voice-region-name');
    
    function updateVoicePrompt() {
        if (voiceCropName) voiceCropName.textContent = cropSelect.value ? cropSelect.options[cropSelect.selectedIndex].text : '[വിളയുടെ പേര്]';
        if (voiceRegionName) voiceRegionName.textContent = regionSelect.value ? regionSelect.options[regionSelect.selectedIndex].text : '[പ്രദേശം]';
    }
    
    if (cropSelect) cropSelect.addEventListener('change', updateVoicePrompt);
    if (regionSelect) regionSelect.addEventListener('change', updateVoicePrompt);

    const playSampleBtn = document.getElementById('play-sample-btn');
    if (playSampleBtn) {
        playSampleBtn.addEventListener('click', () => {
            const cropText = cropSelect.value ? cropSelect.options[cropSelect.selectedIndex].text : 'വിളയുടെ പേര്';
            const regionText = regionSelect.value ? regionSelect.options[regionSelect.selectedIndex].text : 'പ്രദേശം';
            const utterance = new SpeechSynthesisUtterance(`ഞാൻ കർഷകനാണ്. ഞാൻ ഇന്ന് ${cropText} ${regionText} നിന്നാണ് വിൽക്കുന്നത്.`);
            utterance.lang = 'ml-IN';
            window.speechSynthesis.speak(utterance);
        });
    }

    const recordVoiceBtn = document.getElementById('record-voice-btn');
    const stopVoiceBtn = document.getElementById('stop-voice-btn');
    const voiceStatus = document.getElementById('voice-status');
    const voiceTranscriptContainer = document.getElementById('voice-transcript-container');
    const voiceTranscriptText = document.getElementById('voice-transcript-text');

    let recognition = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ml-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            voiceStatus.textContent = 'കേൾക്കുന്നു... (Listening)';
            recordVoiceBtn.classList.add('hidden');
            stopVoiceBtn.classList.remove('hidden');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            voiceText = transcript;
            voiceUsed = true;
            voiceTranscriptText.textContent = transcript;
            voiceTranscriptContainer.classList.remove('hidden');
            voiceStatus.textContent = 'റെക്കോർഡ് പൂർത്തിയായി (Recording complete)';
        };

        recognition.onerror = (event) => {
            voiceStatus.textContent = 'ശബ്ദം തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല (Error recognizing voice)';
            recordVoiceBtn.classList.remove('hidden');
            stopVoiceBtn.classList.add('hidden');
        };

        recognition.onend = () => {
            recordVoiceBtn.classList.remove('hidden');
            stopVoiceBtn.classList.add('hidden');
        };

        if (recordVoiceBtn) {
            recordVoiceBtn.addEventListener('click', () => {
                recognition.start();
            });
        }
        if (stopVoiceBtn) {
            stopVoiceBtn.addEventListener('click', () => {
                recognition.stop();
            });
        }
    } else {
        if (voiceStatus) voiceStatus.textContent = 'നിങ്ങളുടെ ബ്രൗസറിൽ ശബ്ദ റെക്കോർഡിംഗ് ലഭ്യമല്ല (Speech recognition not supported in this browser).';
        if (recordVoiceBtn) recordVoiceBtn.disabled = true;
    }
});
