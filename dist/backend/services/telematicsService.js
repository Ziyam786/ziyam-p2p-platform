"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelematicsService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
class TelematicsService {
    /** Sends a remote unlock command to the vehicle's OBD-II / IoT relay. */
    static async unlockVehicle(telematicsImei, userId) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/vehicles/${telematicsImei}/unlock`, { initiatedBy: userId }, { headers: { Authorization: `Bearer ${this.apiKey}` } });
            return response.data.status === 'SUCCESS';
        }
        catch (error) {
            console.error(`Failed to unlock vehicle IMEI ${telematicsImei}`, error);
            throw new Error('Hardware command failed. Use manual backup or contact support.');
        }
    }
    /** Sends a remote lock command at trip end. */
    static async lockVehicle(telematicsImei, userId) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/vehicles/${telematicsImei}/lock`, { initiatedBy: userId }, { headers: { Authorization: `Bearer ${this.apiKey}` } });
            return response.data.status === 'SUCCESS';
        }
        catch (error) {
            console.error(`Failed to lock vehicle IMEI ${telematicsImei}`, error);
            throw new Error('Hardware command failed.');
        }
    }
    /** Fetches live GPS + odometer + fuel telemetry. */
    static async getVehicleState(telematicsImei) {
        const response = await axios_1.default.get(`${this.baseUrl}/vehicles/${telematicsImei}/telemetry`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        return {
            latitude: response.data.lat,
            longitude: response.data.lng,
            fuelLevel: response.data.fuelPercentage,
            odometerKm: response.data.odometer,
        };
    }
}
exports.TelematicsService = TelematicsService;
TelematicsService.baseUrl = config_1.config.telematics.gatewayUrl;
TelematicsService.apiKey = config_1.config.telematics.apiKey;
//# sourceMappingURL=telematicsService.js.map