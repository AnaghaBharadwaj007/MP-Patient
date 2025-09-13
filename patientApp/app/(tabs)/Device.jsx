import { MaterialCommunityIcons } from "@expo/vector-icons"; // Import the icon library
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Device() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Button handlers
  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate a connection process
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
      Alert.alert("Success", "Your device is now connected!");
    }, 2000);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    Alert.alert("Disconnected", "Your device has been disconnected.");
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 p-5">
        <Text className="text-white text-3xl font-bold">Device Pairing</Text>
        <Text className="text-gray-400 mt-1 mb-6">
          Connect your wearable device to begin monitoring.
        </Text>

        {/* Device icon and connection status */}
        <View className="mt-4 flex items-center">
          <View
            className={`w-44 h-44 rounded-full border-4 ${
              isConnected
                ? "border-green-500"
                : isConnecting
                  ? "border-yellow-500"
                  : "border-red-500"
            } flex items-center justify-center mb-2`}
          >
            {/* Replaced watch symbol with a chip/device icon */}
            <MaterialCommunityIcons
              name="chip"
              size={120}
              color={
                isConnected
                  ? "rgb(34,197,94)"
                  : isConnecting
                    ? "rgb(255,200,50)"
                    : "rgb(239,68,68)"
              }
            />
          </View>
          <Text
            className={`text-xl font-bold ${
              isConnected
                ? "text-green-500"
                : isConnecting
                  ? "text-yellow-500"
                  : "text-red-500"
            }`}
          >
            {isConnected
              ? "Connected"
              : isConnecting
                ? "Connecting..."
                : "Disconnected"}
          </Text>
        </View>

        {/* How to pair */}
        <View className="mt-8">
          <Text className="text-white text-2xl font-bold mb-2">
            How to pair
          </Text>
          <Text className=" text-white mb-1">
            1. Make sure your device Bluetooth is enabled.
          </Text>
          <Text className="text-white mb-1">
            2. Place the device near your phone.
          </Text>
          <Text className="text-white mb-4">
            3. Tap the button below to connect.
          </Text>
        </View>

        {/* Device card */}
        {isConnected && (
          <View className="bg-[#232936] p-4 rounded-xl mt-2 mb-6">
            <Text className="text-white font-bold text-lg">Paired Device</Text>
            <Text className="text-gray-300 mt-2">Model: SmartWatch v2</Text>
            <Text className="text-gray-300 mt-1">Battery: 75%</Text>
          </View>
        )}

        {/* Connect/Disconnect Button */}
        <TouchableOpacity
          className={`rounded-full p-5 mt-3 ${
            isConnected
              ? "bg-red-500"
              : isConnecting
                ? "bg-gray-600"
                : "bg-green-500"
          } opacity-100`}
          onPress={
            isConnected
              ? handleDisconnect
              : isConnecting
                ? () => {}
                : handleConnect
          }
          activeOpacity={0.8}
          pointerEvents={isConnecting ? "none" : "auto"}
        >
          <Text className="text-black text-lg font-bold text-center">
            {isConnected
              ? "Disconnect"
              : isConnecting
                ? "Connecting..."
                : "Connect"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
