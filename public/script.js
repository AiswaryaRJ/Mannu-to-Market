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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide results initially
        resultSection.classList.add('hidden');
        warningBox.classList.add('hidden');
        certificateCard.classList.add('hidden');
        
        // Set loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Verifying...';
        loader.classList.remove('hidden');

        const formData = {
            farmerId: document.getElementById('farmerId').value.trim(),
            crop: document.getElementById('crop').value,
            region: document.getElementById('region').value,
            date: document.getElementById('date').value,
            method: document.getElementById('method').value
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

            if (verifyData.match_status === 'inconsistent') {
                // Show warning
                warningBox.querySelector('h3').textContent = "Submission Needs Review";
                warningFlags.textContent = verifyData.flags ? verifyData.flags.join(', ') : 'Unknown issues';
                warningBox.classList.remove('hidden');
                resetBtn();
                return;
            }

            // Step 2: Consistent - Generate Certificate
            btnText.textContent = 'Generating Certificate...';
            
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
                text: `https://mannu-to-market.local/verify?crop=${encodeURIComponent(formData.crop)}&region=${encodeURIComponent(formData.region)}&date=${encodeURIComponent(formData.date)}`,
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
