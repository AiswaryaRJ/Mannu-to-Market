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
                throw new Error("Verification request failed");
            }

            const verifyData = await verifyResponse.json();

            resultSection.classList.remove('hidden');

            if (verifyData.match_status === 'inconsistent') {
                // Show warning
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
            
            // Photo Preview
            const photoInput = document.getElementById('photo');
            const photoPreviewContainer = document.getElementById('photo-preview-container');
            const photoPreviewImg = document.getElementById('photo-preview-img');
            
            if (photoInput.files && photoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    photoPreviewImg.src = e.target.result;
                    photoPreviewContainer.classList.remove('hidden');
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
