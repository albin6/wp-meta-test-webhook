// index.js (or app.js)
import "dotenv/config"
import express from 'express'
import axios from 'axios'

const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

// Webhook verification (GET) - Your existing code
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    console.log('❌ WEBHOOK VERIFICATION FAILED');
    res.status(403).end();
  }
});

// Receive messages (POST) - Enhanced version
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n📩 Webhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  try {
    // Check if this is a WhatsApp message
    if (req.body.object === 'whatsapp_business_account') {
      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from;
        const messageType = message.type;

        console.log(`\n📱 From: ${from}`);
        console.log(`📋 Type: ${messageType}`);

        // Handle text messages
        if (messageType === 'text') {
          const text = message.text.body;
          console.log(`📝 Message: ${text}`);

          // Send reply
          await sendWhatsAppMessage(
            from,
            `You said: "${text}"\n\nSend me a photo of your health document!`
          );
        }

        // Handle images
        else if (messageType === 'image') {
          const imageId = message.image.id;
          const caption = message.image.caption || '(no caption)';
          
          console.log(`📸 Image ID: ${imageId}`);
          console.log(`📝 Caption: ${caption}`);

          // Send acknowledgment
          await sendWhatsAppMessage(
            from,
            '✅ Image received! Processing...'
          );

          // TODO: Download and process image
          // const imageUrl = await getMediaUrl(imageId);
          // const imageData = await downloadMedia(imageUrl);
          // Call AI extraction service here
        }

        // Handle other message types
        else {
          console.log(`ℹ️ Unsupported message type: ${messageType}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
  }

  res.status(200).end();
});

// Send WhatsApp message
async function sendWhatsAppMessage(to, message) {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Message sent successfully`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send message:', error.response?.data || error.message);
    throw error;
  }
}

// Get media URL from media ID
async function getMediaUrl(mediaId) {
  try {
    const url = `https://graph.facebook.com/v18.0/${mediaId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${whatsappToken}`
      }
    });

    return response.data.url;
  } catch (error) {
    console.error('❌ Failed to get media URL:', error.response?.data || error.message);
    throw error;
  }
}

// Download media file
async function downloadMedia(mediaUrl) {
  try {
    const response = await axios.get(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${whatsappToken}`
      },
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('❌ Failed to download media:', error.response?.data || error.message);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`\n🚀 Server listening on port ${port}`);
  console.log(`📞 Phone Number ID: ${phoneNumberId || 'NOT SET'}`);
  console.log(`🔑 Token configured: ${whatsappToken ? 'YES' : 'NO'}\n`);
});