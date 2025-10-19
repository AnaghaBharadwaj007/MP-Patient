import { MaterialCommunityIcons } from "@expo/vector-icons";
import { decode } from "base-64";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BleManager } from "react-native-ble-plx";
import {
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
} from "react-native-permissions";
import { SafeAreaView } from "react-native-safe-area-context";

const bleManager = new BleManager();

const GLOVE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"; // Your glove's service UUID

const BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_LEVEL_CHARACTERISTIC_UUID =
  "00002a19-0000-1000-8000-00805f9b34fb";

// --- NEW: Define the default name ---
const DEFAULT_DEVICE_NAME = "Heimdall glove";

export default function Device() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [devices, setDevices] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [scanning, setScanning] = useState(false);
  const [connectedDeviceDetails, setConnectedDeviceDetails] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);

  async function requestPermissions() {
    if (Platform.OS === "android") {
      if (Platform.Version >= 31) {
        const permissions = await requestMultiple([
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]);
        return (
          permissions[PERMISSIONS.ANDROID.BLUETOOTH_SCAN] === RESULTS.GRANTED &&
          permissions[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] ===
            RESULTS.GRANTED &&
          permissions[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
            RESULTS.GRANTED
        );
      } else {
        const locationPermission = await request(
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        );
        return locationPermission === RESULTS.GRANTED;
      }
    }
    return true;
  }

  const startScan = async () => {
    if (connectionStatus === "connected" || connectionStatus === "connecting") {
      Alert.alert(
        "Busy",
        "Please wait for the current connection or disconnect first."
      );
      return;
    }

    const permission = await requestPermissions();
    if (!permission) {
      Alert.alert("Permission Denied", "Bluetooth permissions are required.");
      return;
    }
    setDevices({});
    setScanning(true);
    setConnectionStatus("scanning");
    console.log("Starting BLE scan for service:", GLOVE_SERVICE_UUID);

    bleManager.startDeviceScan(
      GLOVE_SERVICE_UUID ? [GLOVE_SERVICE_UUID] : null,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error("Scan Error:", error);
          if (error.errorCode === 201) {
            Alert.alert(
              "Bluetooth Off",
              "Please turn on Bluetooth to scan for devices."
            );
            setConnectionStatus("disconnected");
          } else {
            Alert.alert(
              "Scan Error",
              `An error occurred during scan: ${error.message}`
            );
            setConnectionStatus("failed");
          }
          setScanning(false);
          return;
        }
        if (device) {
          console.log(
            `Device found: ${device.name || "Unnamed"} (${device.id})`
          );
          setDevices((prevDevices) => {
            if (!prevDevices[device.id]) {
              return { ...prevDevices, [device.id]: device };
            }
            return prevDevices;
          });
        }
      }
    );

    setTimeout(() => {
      console.log("Stopping scan after 15 seconds.");
      bleManager.stopDeviceScan();
      setScanning(false);
      setConnectionStatus((prevStatus) => {
        if (prevStatus === "scanning") {
          console.log("Scan finished.");
          return "disconnected"; // Set to disconnected after scan finishes naturally
        }
        return prevStatus;
      });
    }, 15000);
  };

  const readBatteryLevel = async (connectedDevice) => {
    try {
      if (
        !connectedDevice ||
        typeof connectedDevice.readCharacteristicForService !== "function"
      ) {
        console.log("Cannot read battery: Invalid device object provided.");
        setBatteryLevel(null);
        return;
      }
      console.log(`Reading battery level for ${connectedDevice.id}`);
      const characteristic = await connectedDevice.readCharacteristicForService(
        BATTERY_SERVICE_UUID,
        BATTERY_LEVEL_CHARACTERISTIC_UUID
      );
      if (characteristic && characteristic.value) {
        const battery = decode(characteristic.value).charCodeAt(0);
        console.log(`Battery level read: ${battery}%`);
        setBatteryLevel(battery);
      } else {
        console.log("Battery characteristic value is null.");
        setBatteryLevel(null);
      }
    } catch (error) {
      console.error(
        `Could not read battery level: ${error.message || error}`,
        error.errorCode ? `(GATT Error Code: ${error.errorCode})` : ""
      );
      setBatteryLevel(null);
    }
  };

  const connectToDevice = async (device) => {
    if (!device || !device.id) {
      Alert.alert("Error", "Cannot connect: Invalid device data.");
      return;
    }
    if (isConnecting || connectionStatus === "connected") {
      console.log(
        "Connection attempt ignored: Already connecting or connected."
      );
      return;
    }

    setIsConnecting(true);
    setConnectionStatus("connecting");
    console.log("Stopping scan before connection attempt.");
    bleManager.stopDeviceScan();
    setScanning(false);

    try {
      console.log(`Attempting connection to device: ${device.id}`);
      const connectedDevice = await bleManager.connectToDevice(device.id);
      console.log(
        `Successfully connected to ${connectedDevice.id}. Discovering services...`
      );

      try {
        await connectedDevice.discoverAllServicesAndCharacteristics();
        console.log("Services and characteristics discovered successfully.");
      } catch (discoveryError) {
        console.error(
          `Failed to discover services for ${connectedDevice.id}:`,
          discoveryError
        );
        try {
          await bleManager.cancelDeviceConnection(connectedDevice.id);
          console.log("Disconnected due to discovery failure.");
        } catch (cancelError) {
          console.error(
            "Failed to disconnect after discovery error:",
            cancelError
          );
        }
        throw new Error(
          `Failed to discover services: ${discoveryError.message}`
        );
      }

      // --- CHANGE 1: Use default name if connected device name is missing ---
      setConnectedDeviceDetails({
        name: connectedDevice.name || DEFAULT_DEVICE_NAME, // Use default name here
        id: connectedDevice.id,
      });

      await readBatteryLevel(connectedDevice);

      setIsConnecting(false);
      setConnectionStatus("connected");
      console.log(`Device ${connectedDevice.id} setup complete.`);

      const subscription = connectedDevice.onDisconnected(
        (error, disconnectedDevice) => {
          console.log(
            `onDisconnected triggered for ${disconnectedDevice?.id}. Error: ${error ? error.message : "No error"}`
          );
          Alert.alert(
            "Device Disconnected",
            error
              ? `Disconnected due to error: ${error.reason || error.message}`
              : "Device disconnected."
          );
          setConnectionStatus("disconnected");
          setDevices({});
          setConnectedDeviceDetails(null);
          setBatteryLevel(null);
        }
      );
      // Store subscription if needed for cleanup: setDisconnectionSubscription(subscription);
    } catch (error) {
      console.error(
        `Connection or setup failed for device ${device.id}:`,
        error
      );
      setIsConnecting(false);
      setConnectionStatus("failed");
      Alert.alert(
        "Connection Failed",
        `Could not connect or setup the device. ${error.message || "Please try again."}`
      );
    }
  };

  const handleDisconnect = async () => {
    const deviceToDisconnectId = connectedDeviceDetails?.id;
    if (deviceToDisconnectId) {
      console.log(`Manual disconnect initiated for ${deviceToDisconnectId}`);
      setConnectionStatus("disconnected"); // Update UI immediately
      setConnectedDeviceDetails(null);
      setBatteryLevel(null);
      setDevices({});

      try {
        await bleManager.cancelDeviceConnection(deviceToDisconnectId);
        console.log(
          `Successfully cancelled connection for ${deviceToDisconnectId}`
        );
        Alert.alert("Disconnected", "Device has been disconnected.");
      } catch (error) {
        console.error(
          `Error during manual disconnection attempt for ${deviceToDisconnectId}:`,
          error
        );
        Alert.alert(
          "Disconnection Info",
          `Could not cleanly disconnect from device: ${error.message}. State has been reset.`
        );
      }
    } else {
      console.log("handleDisconnect called but no device was connected.");
      setConnectionStatus("disconnected"); // Ensure state is reset
      setConnectedDeviceDetails(null);
      setBatteryLevel(null);
      setDevices({});
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 p-5">
        <Text className="text-white text-3xl font-bold mb-4">
          Device Pairing
        </Text>
        <Text className="text-gray-400 mb-6">
          Connect your wearable device to begin monitoring.
        </Text>

        {/* Status circle */}
        <View
          className={`w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center mb-6 self-center ${
            connectionStatus === "connected"
              ? "border-green-500"
              : connectionStatus === "connecting"
                ? "border-yellow-500"
                : connectionStatus === "scanning"
                  ? "border-blue-500"
                  : "border-red-500"
          }`}
        >
          <MaterialCommunityIcons
            name="chip"
            size={100}
            color={
              connectionStatus === "connected"
                ? "rgb(34,197,94)"
                : connectionStatus === "connecting"
                  ? "rgb(255,200,50)"
                  : connectionStatus === "scanning"
                    ? "rgb(70,130,180)"
                    : "rgb(239,68,68)"
            }
          />
          <Text
            className={`text-xl font-bold mt-2 ${
              connectionStatus === "connected"
                ? "text-green-500"
                : connectionStatus === "connecting"
                  ? "text-yellow-500"
                  : connectionStatus === "scanning"
                    ? "text-blue-500"
                    : "text-red-500"
            }`}
          >
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
                ? "Connecting..."
                : connectionStatus === "scanning"
                  ? "Scanning..."
                  : connectionStatus === "failed"
                    ? "Failed"
                    : "Disconnected"}
          </Text>
        </View>

        {/* --- Show this block ONLY WHEN NOT CONNECTED --- */}
        {connectionStatus !== "connected" && (
          <>
            {connectionStatus !== "connecting" &&
              connectionStatus !== "scanning" && (
                <TouchableOpacity
                  className="bg-green-500 rounded-full p-4 mb-4"
                  onPress={startScan}
                  disabled={scanning || isConnecting}
                >
                  <Text className="text-black font-bold text-center">
                    Scan Devices
                  </Text>
                </TouchableOpacity>
              )}

            <FlatList
              data={Object.values(devices)}
              keyExtractor={(item) => item.id}
              style={{
                display: connectionStatus === "connecting" ? "none" : "flex",
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="bg-gray-800 rounded-lg p-4 mb-3"
                  onPress={() => connectToDevice(item)}
                  disabled={isConnecting}
                >
                  <Text className="text-white font-bold">
                    {/* --- CHANGE 2: Use default name in the list if item name is missing --- */}
                    {item.name || DEFAULT_DEVICE_NAME}
                  </Text>
                  <Text className="text-gray-400 text-sm">{item.id}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                connectionStatus !== "connecting" ? (
                  connectionStatus === "scanning" ? (
                    <Text className="text-gray-400 text-center">
                      Scanning for devices...
                    </Text>
                  ) : connectionStatus === "failed" ? (
                    <Text className="text-red-500 text-center">
                      Connection or Scan failed. Please check
                      Bluetooth/Permissions and try again.
                    </Text>
                  ) : (
                    <Text className="text-gray-400 text-center">
                      {Object.keys(devices).length === 0
                        ? "Press 'Scan Devices' to start."
                        : "No devices found."}
                    </Text>
                  )
                ) : null
              }
            />
          </>
        )}

        {/* --- Show this block ONLY WHEN CONNECTED --- */}
        {connectionStatus === "connected" && connectedDeviceDetails && (
          <>
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-lg text-white font-bold mb-2">
                Device Info
              </Text>
              <Text className="text-gray-300">
                {/* Name already defaults to DEFAULT_DEVICE_NAME from connectToDevice */}
                Name: {connectedDeviceDetails.name}
              </Text>
              <Text className="text-gray-400 text-sm">
                ID: {connectedDeviceDetails.id}
              </Text>
              {batteryLevel !== null ? (
                <Text className="text-green-500 font-bold mt-2">
                  Battery: {batteryLevel}%
                </Text>
              ) : (
                <Text className="text-yellow-500 mt-2">
                  Battery level not available
                </Text>
              )}
            </View>

            <TouchableOpacity
              className="bg-red-500 rounded-full p-4 mt-4"
              onPress={handleDisconnect}
            >
              <Text className="text-white font-bold text-center">
                Disconnect
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
