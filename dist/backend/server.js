"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const payoutEngine_1 = require("./services/payoutEngine");
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const host_routes_1 = __importDefault(require("./routes/host.routes"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: config_1.config.clientUrl }));
app.use(express_1.default.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ZiyamSelfDrive API' }));
app.use('/api', booking_routes_1.default);
app.use('/api', host_routes_1.default);
// Background N+1 settlement cron
payoutEngine_1.PayoutEngine.initializePayoutCron();
app.listen(config_1.config.port, () => {
    console.log(`🚀 ZiyamSelfDrive API running on port ${config_1.config.port} (${config_1.config.nodeEnv})`);
});
//# sourceMappingURL=server.js.map