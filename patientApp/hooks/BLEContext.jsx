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
const BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_LEVEL_CHARACTERISTIC_UUID =
  "00002a19-0000-1000-8000-00805f9b34fb";

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
        // Handle Bluetooth being turned off while connected/scanning
        console.log("Bluetooth powered off. Cleaning up connection.");
        // Optionally alert the user
        // Alert.alert("Bluetooth Off", "Please turn Bluetooth back on.");
        if (connectedDevice) {
          // Clean up connection state if Bluetooth is turned off
          setConnectedDevice(null);
          setMotionData(null);
          if (motionSubscriptionRef.current) {
            motionSubscriptionRef.current.remove();
            motionSubscriptionRef.current = null;
          }
        }
      }
    }, true); // Immediately emit the current state

    return () => {
      console.log("Removing Bluetooth state listener.");
      stateSubscription.remove();
      // Clean up manager on unmount? Maybe not if used globally.
      // bleManager.destroy(); // Causes issues if provider remounts
    };
  }, [connectedDevice]); // Rerun if connectedDevice changes might be needed if cleanup logic depends on it

  // --- Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      console.log("BLEProvider unmounting. Cleaning up resources.");
      // Stop any active subscription
      if (motionSubscriptionRef.current) {
        console.log("Removing motion subscription on unmount.");
        motionSubscriptionRef.current.remove();
        motionSubscriptionRef.current = null;
      }
      // Disconnect if a device is still connected
      // Be cautious with disconnect on unmount, might be unexpected for user
      // if (connectedDevice) {
      //   console.log("Disconnecting device on unmount.");
      //   connectedDevice.cancelConnection(); // Best effort
      // }
      // Consider if bleManager.destroy() is appropriate here or at app exit
    };
  }, []); // Empty dependency array means this runs only once on unmount

  const connectToDevice = async (device) => {
    try {
      console.log(`Context: Connecting to ${device.id}`);
      const connected = await bleManager.connectToDevice(device.id);
      console.log(`Context: Connected to ${connected.id}. Discovering...`);
      await connected.discoverAllServicesAndCharacteristics();
      console.log(`Context: Discovery complete for ${connected.id}`);
      setConnectedDevice(connected); // Update global state

      // Set up disconnection listener *after* successful connection
      const disconnectionListener = connected.onDisconnected(
        (error, disconnectedDevice) => {
          console.log(
            `Context: onDisconnected triggered for ${disconnectedDevice.id}. Error: ${error ? error.message : "No error"}`
          );
          setConnectedDevice(null); // Clear global state
          setMotionData(null); // Clear motion data
          // Clean up the motion subscription if it exists
          if (motionSubscriptionRef.current) {
            console.log("Removing motion subscription due to disconnection.");
            motionSubscriptionRef.current.remove();
            motionSubscriptionRef.current = null;
          }
          // Note: Do not remove the onDisconnected listener itself here.
          // It should persist on the device object until explicitly cancelled or object is gone.
        }
      );

      // Storing the listener handle isn't strictly necessary if managed by device object lifecycle
      // But useful if you need explicit cleanup control, e.g., in useEffect return

      return connected; // Return the connected device object
    } catch (error) {
      console.error(`Context: Failed to connect or setup ${device.id}`, error);
      // Ensure state is cleared if connection fails mid-way
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
        motionSubscriptionRef.current.remove();
        motionSubscriptionRef.current = null;
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
        // Re-throw or handle as needed
        // throw error;
      }
    } else {
      console.log("Context: disconnectDevice called but no device connected.");
    }
  };

  // --- Function to START streaming motion data ---
  const startStreamingData = () => {
    if (connectedDevice && !motionSubscriptionRef.current) {
      // Only subscribe if connected and not already subscribed
      console.log(
        `Context: Subscribing to motion data for ${connectedDevice.id}`
      );
      motionSubscriptionRef.current =
        connectedDevice.monitorCharacteristicForService(
          GLOVE_SERVICE_UUID,
          MOTION_CHAR_UUID,
          (error, characteristic) => {
            if (error) {
              console.error(
                `Context: Motion Subscription Error for ${connectedDevice.id}:`,
                error
              );
              // Handle critical errors, e.g., device disconnected during monitoring
              if (
                error.errorCode === 205 ||
                error.message.includes("was disconnected")
              ) {
                // Example error check
                setConnectedDevice(null); // Clear connection state
                setMotionData(null);
                if (motionSubscriptionRef.current) {
                  motionSubscriptionRef.current.remove(); // Attempt cleanup
                  motionSubscriptionRef.current = null;
                }
              }
              // Decide if we should stop trying or just log the error
              // stopStreamingData(); // Optionally stop if errors persist
              return;
            }

            if (!characteristic?.value) {
              console.warn(
                "Context: Received characteristic update with no value."
              );
              return;
            }

            try {
              const rawData = decode(characteristic.value);
              const buffer = Uint8Array.from(rawData, (c) => c.charCodeAt(0));
              const dataView = new DataView(buffer.buffer);

              // --- CHECK Arduino Code: Expecting 6 x int16_t = 12 bytes, scaled by 1000 ---
              if (dataView.byteLength >= 12) {
                const ax = dataView.getInt16(0, true) / 1000.0; // Scale factor 1000
                const ay = dataView.getInt16(2, true) / 1000.0;
                const az = dataView.getInt16(4, true) / 1000.0;
                const gx = dataView.getInt16(6, true) / 1000.0; // Gyro data
                const gy = dataView.getInt16(8, true) / 1000.0;
                const gz = dataView.getInt16(10, true) / 1000.0;

                // Update the motionData state
                setMotionData({ ax, ay, az, gx, gy, gz });
              } else {
                console.warn(
                  `Context: Received unexpected data length: ${dataView.byteLength} bytes.`
                );
              }
            } catch (decodeError) {
              console.error(
                "Context: Error decoding characteristic data:",
                decodeError
              );
            }
          }
        );
      console.log("Context: Motion subscription initiated.");
    } else if (!connectedDevice) {
      console.warn("Context: Cannot start streaming, no device connected.");
    } else {
      console.log("Context: Already streaming motion data.");
    }
  };

  // --- Function to STOP streaming motion data ---
  const stopStreamingData = () => {
    if (motionSubscriptionRef.current) {
      console.log("Context: Removing motion subscription.");
      motionSubscriptionRef.current.remove();
      motionSubscriptionRef.current = null;
      // Optionally clear the last motion data point?
      // setMotionData(null); // Or keep the last value displayed
    } else {
      console.log("Context: No active motion subscription to remove.");
    }
  };

  // Expose the necessary values and functions
  const value = {
    bleManager, // Expose manager if needed by components (e.g., Device page for scanning)
    connectedDevice,
    motionData,
    connectToDevice, // Function to initiate connection
    disconnectDevice, // Function to initiate disconnection
    startStreamingData, // Function to start listening to motion data
    stopStreamingData, // Function to stop listening
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
}

// Custom hook remains the same
export const useBLE = () => {
  return useContext(BLEContext);
};
