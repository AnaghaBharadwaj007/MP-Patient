import { decode } from "base-64";
import { createContext, useContext, useState } from "react";
import { BleManager } from "react-native-ble-plx";

// Create a new BleManager instance
const bleManager = new BleManager();

// Define the UUIDs for your glove's services and characteristics
const GLOVE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const MOTION_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_LEVEL_CHARACTERISTIC_UUID =
  "00002a19-0000-1000-8000-00805f9b34fb";

// Create the context
const BLEContext = createContext();

export function BLEProvider({ children }) {
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [motionData, setMotionData] = useState(null); // Will hold the live sensor data

  // --- Main function to connect to a device ---
  const connectToDevice = async (device) => {
    try {
      const connected = await bleManager.connectToDevice(device.id);
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);

      // Listen for disconnections
      connected.onDisconnected((error) => {
        console.log("Device disconnected", error);
        setConnectedDevice(null);
        setMotionData(null);
      });

      return connected;
    } catch (error) {
      console.error("Failed to connect", error);
      throw error;
    }
  };

  // --- Main function to disconnect ---
  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
        setConnectedDevice(null);
        setMotionData(null);
      } catch (error) {
        console.error("Failed to disconnect", error);
      }
    }
  };

  // --- Function to subscribe to motion data ---
  const subscribeToMotionData = () => {
    if (connectedDevice) {
      // The monitor function returns a subscription object with a remove() method
      const subscription = connectedDevice.monitorCharacteristicForService(
        GLOVE_SERVICE_UUID,
        MOTION_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.error("Motion Subscription Error:", error);
            return;
          }

          // Decode the incoming Base64 data
          const rawData = decode(characteristic.value);
          // Create a buffer from the raw string
          const buffer = Uint8Array.from(rawData, (c) => c.charCodeAt(0));
          // Use a DataView to read the 16-bit integers (assuming little-endian)
          const dataView = new DataView(buffer.buffer);

          // The ESP32 sends 6 int16_t values (12 bytes)
          if (dataView.byteLength >= 12) {
            const ax = dataView.getInt16(0, true) / 1000; // Dividing by scale factor from ESP32
            const ay = dataView.getInt16(2, true) / 1000;
            const az = dataView.getInt16(4, true) / 1000;
            const gx = dataView.getInt16(6, true) / 1000;
            const gy = dataView.getInt16(8, true) / 1000;
            const gz = dataView.getInt16(10, true) / 1000;

            // Update the motionData state
            setMotionData({ ax, ay, az, gx, gy, gz });
          }
        }
      );

      // Return the subscription so the caller can unsubscribe later
      return subscription;
    }
    return null;
  };

  // Expose the state and functions to the rest of the app
  const value = {
    bleManager,
    connectedDevice,
    motionData,
    connectToDevice,
    disconnectDevice,
    subscribeToMotionData,
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
}

// Custom hook to easily use the BLE context
export const useBLE = () => {
  return useContext(BLEContext);
};
