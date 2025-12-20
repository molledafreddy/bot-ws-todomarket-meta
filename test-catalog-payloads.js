// Test catalog payload structures for WhatsApp Meta API
// This file helps validate the correct structure before sending

// ✅ CORRECT: Native catalog message structure
const correctCatalogPayload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual", 
    "to": "1234567890",
    "type": "interactive",
    "interactive": {
        "type": "catalog_message",
        "body": {
            "text": "Revisa nuestros productos disponibles 🛒"
        },
        "action": {
            "name": "catalog_message"
        }
    }
};

// ✅ CORRECT: Text message with link preview
const correctLinkPayload = {
    "messaging_product": "whatsapp", 
    "recipient_type": "individual",
    "to": "1234567890",
    "type": "text",
    "text": {
        "preview_url": true,
        "body": "Mira todos nuestros productos 🛒\n\n🔗 Ver catálogo completo:\nhttps://wa.me/c/56979643935\n\n📱 Toca el enlace para ver todos nuestros productos disponibles."
    }
};

// ❌ INCORRECT: This structure causes serialization errors
const incorrectPayload = {
    "messaging_product": "whatsapp", 
    "recipient_type": "individual",
    "to": "1234567890",
    "type": "interactive",
    "interactive": {
        "preview_url": true,  // ❌ Wrong: preview_url doesn't belong in interactive
        "body": "Direct string body"  // ❌ Wrong: body should be an object
    }
};

// Function to validate payload structure
function validateCatalogPayload(payload) {
    console.log('🔍 Validating payload structure...');
    
    if (payload.type === 'interactive') {
        if (payload.interactive.type === 'catalog_message') {
            if (payload.interactive.body && typeof payload.interactive.body === 'object' && payload.interactive.body.text) {
                if (payload.interactive.action && payload.interactive.action.name === 'catalog_message') {
                    console.log('✅ Valid catalog_message structure');
                    return true;
                }
            }
        }
        console.log('❌ Invalid interactive structure');
        return false;
    }
    
    if (payload.type === 'text') {
        if (payload.text && payload.text.body) {
            console.log('✅ Valid text message structure');
            return true;
        }
        console.log('❌ Invalid text structure');
        return false;
    }
    
    console.log('❌ Unknown payload type');
    return false;
}

// Test validation
console.log('\n📋 Testing Catalog Payload Validation:');
console.log('==========================================');

console.log('\n1. Testing CORRECT catalog payload:');
validateCatalogPayload(correctCatalogPayload);

console.log('\n2. Testing CORRECT link payload:');
validateCatalogPayload(correctLinkPayload);

console.log('\n3. Testing INCORRECT payload:');
validateCatalogPayload(incorrectPayload);

console.log('\n✨ Use these structures to avoid serialization errors!');
