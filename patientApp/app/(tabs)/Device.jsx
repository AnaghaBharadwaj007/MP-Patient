import { MaterialCommunityIcons } from "@expo/vector-icons";
import { decode } from "base-64";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
} from "react-native-permissions";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBLE } from "../../hooks/BLEContext";

const DEFAULT_DEVICE_NAME = "Heimdall glove";
const BATTERY_SERVICE_UUID = "180F";
const BATTERY_LEVEL_CHARACTERISTIC_UUID ="2A19";
const GLOVE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const MOTION_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

export default function Device() {
  // --- Get global state and functions from the context ---
  const { bleManager, connectedDevice, connectToDevice, disconnectDevice} = useBLE();

  // --- Restored local state management from your previous version ---
  const [devices, setDevices] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [batteryLevel, setBatteryLevel] = useState(null);

  // Determine connected device details from global state
  const connectedDeviceDetails = connectedDevice
    ? {
        name: connectedDevice.name || DEFAULT_DEVICE_NAME,
        id: connectedDevice.id,
      }
    : null;

  useEffect(() => {
    if (connectedDevice) {
      setConnectionStatus("connected");
      setIsConnecting(false);
      setScanning(false);
    } else {
      if (!isConnecting && !scanning) {
        setConnectionStatus("disconnected");
      }
    }
  }, [connectedDevice]);

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

  // --- Restored startScan function ---
  const startScan = async () => {
    const permission = await requestPermissions();
    if (!permission) {
      Alert.alert("Permission Denied", "Bluetooth permissions are required.");
      return;
    }
    setDevices({});
    setScanning(true);
    setConnectionStatus("scanning");

    bleManager.startDeviceScan(null, { allowDuplicates: false },
      (error, device) => {
        if (error) {
          setScanning(false);
          setConnectionStatus("failed");
          Alert.alert("Scan Error", error.message);
          return;
        }
        if (device?.id) {
          setDevices((prev) => ({ ...prev, [device.id]: device }));
        }
      }
    );

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
      if (connectionStatus === "scanning") {
        setConnectionStatus("disconnected");
      }
    }, 15000);
  };

  const readBatteryLevel = async (device) => {
    try {
      const characteristic = await device.readCharacteristicForService(
        BATTERY_SERVICE_UUID,
        BATTERY_LEVEL_CHARACTERISTIC_UUID
      );
      const battery = decode(characteristic.value).charCodeAt(0);
      setBatteryLevel(battery);
    } catch (error) {
      console.log("Could not read battery level:", error);
      setBatteryLevel(null);
    }
  };

  // --- Restored handleConnect function, but using context ---
  const handleConnect = async (device) => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectionStatus("connecting");
    bleManager.stopDeviceScan();
    setScanning(false);

    try {
      const connected = await connectToDevice(device);
      if (connected) {
        await readBatteryLevel(connected);
      }
    } 
    catch (error) {
      Alert.alert("Connection Failed", error.message);
      setConnectionStatus("failed"); // Or 'disconnected'
      setIsConnecting(false);
    }
  };

  // --- Restored handleDisconnect function, but using context ---
  const handleDisconnect = async () => {
    Alert.alert("Disconnected", "Your device has been disconnected.");
    await disconnectDevice(); // Call global disconnect
    setBatteryLevel(null);
    setConnectionStatus("disconnected"); // Reset local state
  };

  // Re-read battery if the connected device changes (from global state)
  useEffect(() => {
    if (connectedDevice) {
      readBatteryLevel(connectedDevice);
    }
  }, [connectedDevice]);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 p-5">
        <Text className="text-white text-3xl font-bold mb-4">
          Device Pairing
        </Text>
        <Text className="text-gray-400 mb-6">
          Connect your wearable device to begin monitoring.
        </Text>

        {/* This JSX is now driven by the restored local state variables */}
        <View
          className={`w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center mb-6 self-center ${connectionStatus === "connected" ? "border-green-500" : connectionStatus === "connecting" ? "border-yellow-500" : connectionStatus === "scanning" ? "border-blue-500" : "border-red-500"}`}
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
            className={`text-xl font-bold mt-2 ${connectionStatus === "connected" ? "text-green-500" : connectionStatus === "connecting" ? "text-yellow-500" : connectionStatus === "scanning" ? "text-blue-500" : "text-red-500"}`}
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

        {connectionStatus !== "connected" && (
          <>
            {!scanning && !isConnecting && (
              <TouchableOpacity
                className="bg-green-500 rounded-full p-4 mb-4"
                onPress={startScan}
              >
                <Text className="text-black font-bold text-center">
                  Scan Devices
                </Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={Object.values(devices)}
              keyExtractor={(item) => item.id}
              style={{ display: isConnecting ? "none" : "flex" }} // Hide list while connecting
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="bg-gray-800 rounded-lg p-4 mb-3"
                  onPress={() => handleConnect(item)}
                  disabled={isConnecting}
                >
                  <Text className="text-white font-bold">
                    {item.name || DEFAULT_DEVICE_NAME}
                  </Text>
                  <Text className="text-gray-400 text-sm">{item.id}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-gray-400 text-center">
                  {scanning ? "Scanning..." : "No devices found."}
                </Text>
              }
            />
          </>
        )}

        {connectionStatus === "connected" && connectedDeviceDetails && (
          <>
            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-lg text-white font-bold mb-2">
                Device Info
              </Text>
              <Text className="text-gray-300">
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
