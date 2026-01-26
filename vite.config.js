var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Minimal wrapper to adapt Node's ServerResponse to a Vercel-like response
function wrapRes(res) {
    var r = res;
    r.status = function (code) {
        res.statusCode = code;
        return r;
    };
    r.json = function (obj) {
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
        }
        res.end(JSON.stringify(obj));
    };
    r.send = function (data) {
        if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json');
            }
            res.end(JSON.stringify(data));
        }
        else {
            res.end(String(data));
        }
    };
    return r;
}
// Compute a build identifier at build time:
// - Prefer VITE_BUILD_ID if provided (from Vercel env or local)
// - Else use VERCEL_GIT_COMMIT_SHA when building on Vercel
// - Else fallback to ISO timestamp
var __rawBuildId = (process.env.VITE_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || new Date().toISOString());
// If it looks like a git SHA, shorten to 7 characters
var __buildId = /^[a-f0-9]{7,40}$/i.test(__rawBuildId) ? __rawBuildId.slice(0, 7) : __rawBuildId;
/**
 * Build-time plugin to assert debug routes are protected in production.
 * Fails the build if debug routes would be exposed without proper guards.
 *
 * Note: This check ensures that production builds require explicit opt-in
 * for debug access via VITE_DIAGNOSTICS or VITE_DEBUG_KEY.
 * Runtime protection in RootRouter.tsx provides the actual access control.
 */
function debugRoutesProtectionPlugin() {
    return {
        name: 'debug-routes-protection',
        buildStart: function () {
            // Only check in production builds (not dev mode or preview)
            // Skip check if explicitly in dev mode
            var isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
            if (isDev) {
                return;
            }
            // Check if this is a production build
            var isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
            if (!isProduction) {
                return;
            }
            var diagnosticsEnabled = String(process.env.VITE_DIAGNOSTICS || '').toLowerCase() === 'true';
            var hasDebugKey = Boolean(process.env.VITE_DEBUG_KEY && process.env.VITE_DEBUG_KEY.trim().length > 0);
            // Production builds require explicit opt-in for debug access:
            // - If VITE_DIAGNOSTICS=true → allow build (full diagnostics enabled)
            // - Else if VITE_DEBUG_KEY is set (non-empty) → allow build (debug key protection)
            // - Else → fail build (no protection configured)
            if (!diagnosticsEnabled && !hasDebugKey) {
                this.error('[SECURITY] Debug routes must be protected in production builds.\n' +
                    'To enable debug access in production, set one of:\n' +
                    '  - VITE_DIAGNOSTICS=true (enables all debug routes)\n' +
                    '  - VITE_DEBUG_KEY=<secret> (enables access via ?debugKey=<secret> query param)\n' +
                    '\n' +
                    'Current env: NODE_ENV=' + (process.env.NODE_ENV || 'undefined') +
                    ', VITE_DIAGNOSTICS=' + (process.env.VITE_DIAGNOSTICS || 'not set') +
                    ', VITE_DEBUG_KEY=' + (hasDebugKey ? '***set***' : 'not set') +
                    '\n' +
                    'Note: Runtime protection in RootRouter.tsx will enforce access control.');
            }
        }
    };
}
export default defineConfig({
    base: '/',
    define: {
        // Expose a stable, build-time value for the client via a global constant
        __BUILD_ID__: JSON.stringify(__buildId)
    },
    plugins: [
        react(),
        debugRoutesProtectionPlugin(),
        {
            name: 'inject-build-id-html',
            transformIndexHtml: function (html) {
                // Preserve OG/Twitter meta tags if they exist, inject build ID
                var result = html.replace('<div id="root">', "<div id=\"root\"><div data-testid=\"build-id\" style=\"display:none\">".concat(__buildId, "</div>"));
                // Ensure OG tags are preserved (Vite may strip them, so re-add if missing)
                if (!result.includes('og:title')) {
                    // If OG tags are missing, inject them before closing </head>
                    var ogTags = "\n\t\t<!-- Open Graph / Facebook -->\n\t\t<meta property=\"og:type\" content=\"website\" />\n\t\t<meta property=\"og:url\" content=\"https://athlete-ledger.vercel.app/\" />\n\t\t<meta property=\"og:title\" content=\"Athlete Ledger - Connect with College Coaches\" />\n\t\t<meta property=\"og:description\" content=\"The platform for athletes to discover and connect with college coaches. Showcase your profile and find your perfect match.\" />\n\t\t<meta property=\"og:image\" content=\"https://athlete-ledger.vercel.app/athlete-ledger-logo.png\" />\n\t\t\n\t\t<!-- Twitter -->\n\t\t<meta name=\"twitter:card\" content=\"summary_large_image\" />\n\t\t<meta name=\"twitter:url\" content=\"https://athlete-ledger.vercel.app/\" />\n\t\t<meta name=\"twitter:title\" content=\"Athlete Ledger - Connect with College Coaches\" />\n\t\t<meta name=\"twitter:description\" content=\"The platform for athletes to discover and connect with college coaches. Showcase your profile and find your perfect match.\" />\n\t\t<meta name=\"twitter:image\" content=\"https://athlete-ledger.vercel.app/athlete-ledger-logo.png\" />";
                    result = result.replace('</head>', "".concat(ogTags, "\n\t</head>"));
                }
                return result;
            }
        },
        {
            name: 'local-api-middleware',
            configureServer: function (server) {
                var _this = this;
                server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                    var urlStr, url, pathname, modulePath, mod, handler_1, resLike_1, raw_1, resLike, _a, _b;
                    var _this = this;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _c.trys.push([0, 6, , 7]);
                                urlStr = req.url || '/';
                                if (!urlStr.startsWith('/api/'))
                                    return [2 /*return*/, next()];
                                url = new URL(urlStr, 'http://localhost');
                                pathname = url.pathname // e.g. /api/auth/me
                                ;
                                modulePath = "".concat(pathname, ".ts");
                                return [4 /*yield*/, server.ssrLoadModule(modulePath).catch(function () { return null; })];
                            case 1:
                                mod = _c.sent();
                                handler_1 = mod === null || mod === void 0 ? void 0 : mod.default;
                                if (typeof handler_1 !== 'function') {
                                    // Dev fallback for key routes when serverless runtime isn't available
                                    if (pathname === '/api/recruiting/send') {
                                        resLike_1 = wrapRes(res);
                                        resLike_1.status(503).json({ error: 'Email not configured' });
                                        return [2 /*return*/];
                                    }
                                    return [2 /*return*/, next()];
                                }
                                // Augment the request with query/body like VercelRequest
                                ;
                                req.query = Object.fromEntries(url.searchParams.entries());
                                // If body is expected, read and parse it before invoking handler
                                if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                                    raw_1 = '';
                                    req.on('data', function (chunk) {
                                        raw_1 += chunk;
                                    });
                                    req.on('end', function () { return __awaiter(_this, void 0, void 0, function () {
                                        var resLike, _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    try {
                                                        ;
                                                        req.body = raw_1 ? JSON.parse(raw_1) : undefined;
                                                    }
                                                    catch (_c) {
                                                        ;
                                                        req.body = undefined;
                                                    }
                                                    resLike = wrapRes(res);
                                                    _b.label = 1;
                                                case 1:
                                                    _b.trys.push([1, 3, , 4]);
                                                    return [4 /*yield*/, handler_1(req, resLike)];
                                                case 2:
                                                    _b.sent();
                                                    return [3 /*break*/, 4];
                                                case 3:
                                                    _a = _b.sent();
                                                    // Fall through to next on error to not break dev
                                                    return [2 /*return*/, next()];
                                                case 4:
                                                    if (!res.writableEnded)
                                                        res.end();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                    return [2 /*return*/];
                                }
                                resLike = wrapRes(res);
                                _c.label = 2;
                            case 2:
                                _c.trys.push([2, 4, , 5]);
                                return [4 /*yield*/, handler_1(req, resLike)];
                            case 3:
                                _c.sent();
                                return [3 /*break*/, 5];
                            case 4:
                                _a = _c.sent();
                                return [2 /*return*/, next()];
                            case 5:
                                if (!res.writableEnded)
                                    res.end();
                                return [3 /*break*/, 7];
                            case 6:
                                _b = _c.sent();
                                return [2 /*return*/, next()];
                            case 7: return [2 /*return*/];
                        }
                    });
                }); });
            }
        }
    ],
    server: {
        port: 5173,
        // Disable proxy for /api during local development; handled by middleware above
        proxy: {}
    }
});
