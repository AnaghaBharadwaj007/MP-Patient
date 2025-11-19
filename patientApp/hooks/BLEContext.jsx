import { decode } from "base-64";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"; // Added useRef, useEffect
import { BleManager, State as BluetoothState } from "react-native-ble-plx"; // Added State

// Create a new BleManager instance only once
const bleManager = new BleManager();

// Define the UUIDs
const GLOVE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const MOTION_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const BATTERY_SERVICE_UUID = "180F";
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2A19";

// Create the context
const BLEContext = createContext();

export function BLEProvider({ children }) {
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [motionData, setMotionData] = useState(null); // Live sensor data
  const motionSubscriptionRef = useRef(null); // Ref to store the subscription

  // --- Monitor Bluetooth State ---
  useEffect(() => {
    const stateSubscription = bleManager.onStateChange((state) => {
      console.log("Bluetooth State Changed:", state);
      if (state === BluetoothState.PoweredOff) {
        console.log("Bluetooth powered off. Cleaning up connection.");
        if (connectedDevice) {
          setConnectedDevice(null);
          setMotionData(null);
          if (motionSubscriptionRef.current) {
            try{
              motionSubscriptionRef.current?.remove();
              motionSubscriptionRef.current = null;
            }
            catch(err){
              console.warn("Error while removing in monitor bluetooth state useEffect")
            }
          }
        }
      }
    }, true);

    return () => {
      console.log("Removing Bluetooth state listener.");
      stateSubscription.remove();
    };
  }, []); // Rerun if connectedDevice changes might be needed if cleanup logic depends on it

  // --- Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      console.log("BLEProvider unmounting. Cleaning up resources.");
      // Stop any active subscription
      if (motionSubscriptionRef.current) {
        console.log("Removing motion subscription on unmount.");
        try{
          motionSubscriptionRef.current?.remove();
          motionSubscriptionRef.current = null;
        }
        catch(err){
          console.warn("Error while removing in clean on unmount useEffect")
        }
      }
    };
  }, []);

  const connectToDevice = async (device) => {
    try {
      console.log(`Context: Connecting to ${device.id}`);
      const connected = await bleManager.connectToDevice(device.id);
      console.log(`Context: Connected to ${connected.id}. Discovering...`);
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      console.log(`Context: Discovery complete for ${discovered.id}`);
      setConnectedDevice(discovered);

      discovered.onDisconnected((error, disconnectedDevice) => {
        console.log(
          `Context: onDisconnected triggered for ${disconnectedDevice.id}. Error: ${error ? error.message : "No error"}`
        );
        stopStreamingData();
        setConnectedDevice(null); // Clear global state
        setMotionData(null); // Clear motion data
      });

      return discovered; 
    } catch (error) {
      console.error(`Context: Failed to connect or setup ${device.id}`, error);
      setConnectedDevice(null);
      setMotionData(null);
      throw error; // Re-throw error so UI can handle it (e.g., show Alert)
    }
  };

  const disconnectDevice = async () => {
    const deviceToDisconnect = connectedDevice; // Capture current device
    if (deviceToDisconnect) {
      console.log(
        `Context: Attempting to disconnect from ${deviceToDisconnect.id}`
      );
      // Stop subscription before disconnecting
      if (motionSubscriptionRef.current) {
        console.log("Context: Removing motion subscription before disconnect.");
        try{
          motionSubscriptionRef.current?.remove();
          motionSubscriptionRef.current = null;
        }
        catch(err){
          console.warn("Error while removing in disconnect device")
        }
      }
      try {
        await deviceToDisconnect.cancelConnection();
        console.log(
          `Context: Disconnected successfully from ${deviceToDisconnect.id}`
        );
        // State is cleared by the onDisconnected listener
      } catch (error) {
        console.error(
          `Context: Failed to disconnect ${deviceToDisconnect.id}`,
          error
        );
        // Force clear state even if cancelConnection fails, listener might not fire
        setConnectedDevice(null);
        setMotionData(null);
      }
    } 
    else {
      console.log("Context: disconnectDevice called but no device connected.");
    }
  };

  // --- Function to START streaming motion data ---
  const startStreamingData = async (device = connectedDevice) => {
    const isConn = await device.isConnected();
    if (isConn.valueOf() && !motionSubscriptionRef.current) {      
      console.log(
        `Context: Subscribing to motion data for ${device.id}`
      );
      motionSubscriptionRef.current =
        device.monitorCharacteristicForService(
          GLOVE_SERVICE_UUID,
          MOTION_CHAR_UUID,
          (error, characteristic) => {
            if (error) {
              console.error(
                `Context: Motion Subscription Error for ${connectedDevice.id}:`,
                error
              );
              stopStreamingData();
              // Handle critical errors, e.g., device disconnected during monitoring
              if (
                error.errorCode === 205 ||
                error.message.includes("was disconnected")
              ) {
                setConnectedDevice(null);
                setMotionData(null);
              }else{
                console.warn(error.errorCode)
              }
              return;
            }

            if (!characteristic?.value) {
              console.warn(
                "Context: Received characteristic update with no value."
              );
              return;
            }

            try {
              const rawData = decode(characteristic?.value);
              const buffer = Uint8Array.from(rawData, (c) => c.charCodeAt(0));
              const dataView = new DataView(buffer.buffer);

              if (dataView.byteLength >= 8) {
                const ax = dataView.getInt16(0, true) / 100.0; // Scale factor 100
                const ay = dataView.getInt16(2, true) / 100.0;
                const az = dataView.getInt16(4, true) / 100.0;
                const gx = dataView.getInt16(6, true) / 100.0;
                const gy = dataView.getInt16(8, true) / 100.0;
                const gz = dataView.getInt16(10, true) / 100.0;
                // console.debug({ax, ay, az, gx, gy, gz});
                setMotionData({ ax, ay, az, gx, gy, gz });
              } 
              else {
                console.warn(
                  `Context: Received unexpected data length: ${dataView.byteLength} bytes.`
                );
              }
            } 
            catch (decodeError) {
              console.error(
                "Context: Error decoding characteristic data:",
                decodeError
              );
            }
          }
        );
      console.log("Context: Motion subscription initiated.");
    } else if (!device) {
      console.warn("Context: Cannot start streaming, no device connected.");
    } else {
      console.log("Context: Already streaming motion data.");
    }
  };

  // --- Function to STOP streaming motion data ---
  const stopStreamingData = () => {
    const subscription = motionSubscriptionRef.current;
    if (subscription) {
      console.log("Context: Removing motion subscription.");
      motionSubscriptionRef.current = null;
      try{
        motionSubscriptionRef.current?.remove();
      }
      catch(err){
        console.warn("Error while removing in stop streaming data")
      }
    } 
    else {
      console.log("Context: No active motion subscription to remove.");
    }
  };

  // Expose the necessary values and functions
  const value = {
    bleManager, 
    connectedDevice,
    motionData,
    connectToDevice, 
    disconnectDevice, 
    startStreamingData, 
    stopStreamingData
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
}

// Custom hook remains the same
export const useBLE = () => {
  return useContext(BLEContext);
};
