import express from "express";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
// Define base vite config here instead of importing
const viteConfig = {
    plugins: [],
    root: path.resolve(process.cwd(), "../FROUNT-END-FLOWER"),
    base: "/",
    server: {
        middlewareMode: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(process.cwd(), "../FROUNT-END-FLOWER/src"),
            '@shared': path.resolve(process.cwd(), "../FROUNT-END-FLOWER/shared"),
            '@assets': path.resolve(process.cwd(), "../FROUNT-END-FLOWER/attached_assets"),
        }
    }
};
// Create a simple logger
const viteLogger = {
    info: (msg) => console.log(msg),
    warn: (msg) => console.warn(msg),
    warnOnce: (msg) => console.warn(msg),
    error: (msg) => console.error(msg),
    clearScreen: () => { },
    hasErrorLogged: () => false,
    hasWarned: false
};
export function log(message, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
}
export async function setupVite(app, server) {
    const serverOptions = {
        middlewareMode: true,
        hmr: { server },
        allowedHosts: true,
    };
    // Use require to avoid module resolution issues
    const { createServer: createViteServer } = require('vite');
    const viteServer = await createViteServer({
        ...viteConfig,
        configFile: false,
        customLogger: {
            ...viteLogger,
            error: (msg) => {
                console.error(msg);
                // Don't exit on error, just log it
                // process.exit(1);
            },
        },
        server: serverOptions,
        appType: "custom",
    });
    // Skip Vite middleware for API routes
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        viteServer.middlewares(req, res, next);
    });
    // Handle non-API routes
    app.use("*", async (req, res, next) => {
        // Skip this middleware for API routes
        if (req.originalUrl.startsWith('/api/')) {
            return next();
        }
        const url = req.originalUrl;
        try {
            const clientTemplate = path.resolve(process.cwd(), "../FROUNT-END", "index.html");
            // Check if template exists
            if (!fs.existsSync(clientTemplate)) {
                console.warn(`[VITE] Template not found at ${clientTemplate}, skipping Vite middleware`);
                return next();
            }
            // always reload the index.html file from disk incase it changes
            let template = await fs.promises.readFile(clientTemplate, "utf-8");
            template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
            try {
                const page = await viteServer.transformIndexHtml(url, template);
                res.status(200).set({ "Content-Type": "text/html" }).end(page);
            }
            catch (transformError) {
                console.error("[VITE] Error transforming HTML:", transformError);
                next();
            }
        }
        catch (e) {
            console.error("[VITE] Error reading template:", e);
            next();
        }
    });
}
export function serveStatic(app) {
    const distPath = path.resolve(import.meta.dirname, "public");
    if (!fs.existsSync(distPath)) {
        throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
    }
    app.use(express.static(distPath));
    // fall through to index.html if the file doesn't exist
    app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
    });
}
