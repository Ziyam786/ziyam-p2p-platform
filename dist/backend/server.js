"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const config_1 = require("./config");
const payoutEngine_1 = require("./services/payoutEngine");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const car_routes_1 = __importDefault(require("./routes/car.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const host_routes_1 = __importDefault(require("./routes/host.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const kyc_routes_1 = __importDefault(require("./routes/kyc.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const promoCode_routes_1 = __importDefault(require("./routes/promoCode.routes"));
const payuCallback_routes_1 = __importDefault(require("./routes/payuCallback.routes"));
const wishlist_routes_1 = __importDefault(require("./routes/wishlist.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
// PayU posts its success/failure callback as a real browser form navigation
// (not a fetch/XHR call), from PayU's own domain, with no cookies involved.
// Mount it ahead of the CORS middleware below so an unrecognized Origin
// header on that navigation can't cause our strict origin check to reject it.
app.use('/api', payuCallback_routes_1.default);
// CORS configuration - allow multiple origins
const allowedOrigins = [
    config_1.config.clientUrl,
    config_1.config.adminUrl,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5000',
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests without Origin header (same-origin requests)
        if (!origin) {
            callback(null, true);
            return;
        }
        // Check hardcoded origins
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        // Allow all Vercel deployments (ziyam-frontend-*.vercel.app, ziyam-admin-*.vercel.app)
        if (origin.includes('vercel.app') && (origin.includes('ziyam-frontend') || origin.includes('ziyam-admin'))) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ZiyamSelfDrive API' }));
app.use('/api', auth_routes_1.default);
app.use('/api', car_routes_1.default);
app.use('/api', booking_routes_1.default);
app.use('/api', host_routes_1.default);
app.use('/api', user_routes_1.default);
app.use('/api', review_routes_1.default);
app.use('/api', kyc_routes_1.default);
app.use('/api', admin_routes_1.default);
app.use('/api', settings_routes_1.default);
app.use('/api', ai_routes_1.default);
app.use('/api', promoCode_routes_1.default);
app.use('/api', wishlist_routes_1.default);
app.use('/api', notification_routes_1.default);
// 404 handler for unmatched API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
// Centralized error handler (catches anything routes forgot to try/catch)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});
// Background N+1 settlement cron
payoutEngine_1.PayoutEngine.initializePayoutCron();
app.listen(config_1.config.port, () => {
    console.log(`🚀 ZiyamSelfDrive API running on port ${config_1.config.port} (${config_1.config.nodeEnv})`);
});
//# sourceMappingURL=server.js.map