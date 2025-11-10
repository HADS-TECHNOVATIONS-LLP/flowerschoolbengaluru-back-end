import dotenv from "dotenv";
dotenv.config();
export const config = {
    nodeEnv: process.env.NODE_ENV || "development",
    database: {
        url: process.env.DATABASE_URL || "postgres://postgres:Vyshnudevi7507@localhost:5432/bouquetbar"
    },
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || "rzp_live_RWo2zsTKLIGYbi",
        keySecret: process.env.RAZORPAY_KEY_SECRET || "1juiyC5dHOV8i1x1oK4veoD7"
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || "AC33481cb2b9a8c5cd0e7ebfa5e7ef41be",
        authToken: process.env.TWILIO_AUTH_TOKEN || "03d1c6447ba02b010d89815819c5fe7e",
        verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || "VAb363f196c6b6bf4367dcac40bce2704b",
        sms: {
            fromNumber: process.env.TWILIO_PHONE_NUMBER || "+18633431421",
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || ""
        },
        whatsapp: {
            fromNumber: process.env.TWILIO_WHATSAPP_NUMBER || "+18633431421"
        },
        verify: {
            serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID || "VAb363f196c6b6bf4367dcac40bce2704b"
        }
    },
    server: {
        port: Number(process.env.PORT) || 5000,
        host: process.env.HOST || "0.0.0.0",
        cors: {
            origins: (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : [
                // Local development ports - updated
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:4173",
                "http://localhost:8080",
                "http://localhost:8081",
                "http://localhost:8082",
                "http://localhost:3000",
                "http://localhost:5000",
                "https://localhost:5000",
                // Production domains
                "https://flowerschoolbengaluru.com",
                "https://app.flowerschoolbengaluru.com",
                "http://flowerschoolbengaluru.com",
                "http://app.flowerschoolbengaluru.com"
            ])
        }
    },
    admin: {
        phone: process.env.ADMIN_PHONE || "+919042358932",
        emails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : [
            "vasuchouthri811@gmail.com"
        ]
    },
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY || "",
        fromEmail: process.env.FROM_EMAIL || "info@flowerschoolbengaluru.com"
    },
    session: {
        secret: process.env.SESSION_SECRET || "dev_secret_change_in_production"
    },
    ssl: {
        useSSL: process.env.USE_SSL === "true",
        certPath: process.env.SSL_CERT_PATH || "",
        keyPath: process.env.SSL_KEY_PATH || ""
    }
};
