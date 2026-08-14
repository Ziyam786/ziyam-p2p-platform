import axios from 'axios';
import { config } from '../config';

export class TelematicsService {
  private static baseUrl = config.telematics.gatewayUrl;
  private static apiKey = config.telematics.apiKey;

  /** Sends a remote unlock command to the vehicle's OBD-II / IoT relay. */
  static async unlockVehicle(telematicsImei: string, userId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/vehicles/${telematicsImei}/unlock`,
        { initiatedBy: userId },
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );
      return response.data.status === 'SUCCESS';
    } catch (error) {
      console.error(`Failed to unlock vehicle IMEI ${telematicsImei}`, error);
      throw new Error('Hardware command failed. Use manual backup or contact support.');
    }
  }

  /** Sends a remote lock command at trip end. */
  static async lockVehicle(telematicsImei: string, userId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/vehicles/${telematicsImei}/lock`,
        { initiatedBy: userId },
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );
      return response.data.status === 'SUCCESS';
    } catch (error) {
      console.error(`Failed to lock vehicle IMEI ${telematicsImei}`, error);
      throw new Error('Hardware command failed.');
    }
  }

  /** Fetches live GPS + odometer + fuel telemetry. */
  static async getVehicleState(telematicsImei: string) {
    const response = await axios.get(`${this.baseUrl}/vehicles/${telematicsImei}/telemetry`, {
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
