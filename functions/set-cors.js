const admin = require('firebase-admin');

// サービスアカウントキーなしでもローカル環境で Application Default Credentials または Firebase CLI auth を使う
// もしくは環境変数 GOOGLE_APPLICATION_CREDENTIALS があればそれを使う
admin.initializeApp({
  storageBucket: 'shapeshare3d.firebasestorage.app'
});

async function setCors() {
  const bucket = admin.storage().bucket();
  const corsConfig = [
    {
      origin: [
        "https://sekkeiya.com",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
      ],
      method: [
        "GET",
        "HEAD",
        "OPTIONS"
      ],
      responseHeader: [
        "Content-Type",
        "Authorization"
      ],
      maxAgeSeconds: 3600
    }
  ];

  try {
    await bucket.setCorsConfiguration(corsConfig);
    console.log("CORS configuration successfully set!");
    
    const [metadata] = await bucket.getMetadata();
    console.log("Current CORS:", JSON.stringify(metadata.cors, null, 2));
  } catch (error) {
    console.error("Error setting CORS:", error);
  }
}

setCors();
