import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes.js";
import { config } from './config.js';
import { backgroundScheduler } from "./services/background-scheduler.js";
import cors from "cors";
import multer from "multer";
import fileUpload from "express-fileupload";
const app = express();
// Increase body size limits for JSON and URL-encoded payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
// Enable file upload middlewares (choose one or both as needed)
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } })); // 50MB
app.use(multer({ limits: { fileSize: 50 * 1024 * 1024 } }).any());
// Configure CORS - FIXED VERSION
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // Check if origin is in allowed list
        if (config.server.cors.origins.includes(origin)) {
            return callback(null, true);
        }
        else {
            console.error(`CORS blocked origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
}));
// Handle preflight requests explicitly
app.options('*', cors());
app.use(cookieParser());
app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse = undefined;
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
            let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
            if (capturedJsonResponse) {
                logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
            }
            if (logLine.length > 80) {
                logLine = logLine.slice(0, 79) + "…";
            }
            console.log(logLine);
        }
    });
    next();
});
const startServer = async (server, retries = 3) => {
    const basePort = config.server.port;
    for (let i = 0; i < retries; i++) {
        const port = basePort + i;
        try {
            await new Promise((resolve, reject) => {
                server.listen({
                    port,
                    host: config.server.host, // CHANGED: Use config.server.host instead of hardcoded "localhost"
                }, () => {
                    console.log(`Server is running on ${config.server.host}:${port}`);
                    console.log(`CORS enabled for origins:`, config.server.cors.origins);
                    resolve(undefined);
                }).on('error', (err) => {
                    if (err.code === 'EADDRINUSE' && i < retries - 1) {
                        console.log(`Port ${port} is in use, trying ${port + 1}`);
                        return;
                    }
                    reject(err);
                });
            });
            return port; // Successfully started server
        }
        catch (err) {
            if (i === retries - 1) {
                throw err;
            }
        }
    }
    throw new Error('Could not find an available port');
};
(async () => {
    try {
        const server = await registerRoutes(app);
        app.use((err, _req, res, _next) => {
            const status = err.status || err.statusCode || 500;
            const message = err.message || "Internal Server Error";
            res.status(status).json({ message });
            throw err;
        });
        console.log("Server starting in production mode");
        const port = await startServer(server);
        // Start background scheduler for order status progression
        try {
            backgroundScheduler.start();
            console.log("Background scheduler started for order status progression");
        }
        catch (error) {
            console.error("Failed to start background scheduler:", error);
        }
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
})();
