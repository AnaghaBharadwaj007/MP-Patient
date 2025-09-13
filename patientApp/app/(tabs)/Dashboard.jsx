import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Dashboard() {
  const [isVoiceSensorActive, setIsVoiceSensorActive] = useState(false);
  const [isSensorOnlyActive, setIsSensorOnlyActive] = useState(false);
  const [isDetectionActive, setIsDetectionActive] = useState(false);

  const handleVoiceSensorToggle = () => {
    setIsVoiceSensorActive((prev) => !prev);
    setIsSensorOnlyActive(false);
  };

  const handleSensorOnlyToggle = () => {
    setIsSensorOnlyActive((prev) => !prev);
    setIsVoiceSensorActive(false);
  };

  const handleStartDetection = () => {
    Alert.alert(
      "Detection Started",
      "We are now recording your tremors and other relevant data."
    );
    setIsDetectionActive(true);
  };

  const handleStopDetection = () => {
    Alert.alert(
      "Detection Stopped",
      "Data recording has been stopped. We will analyze the results and provide an update."
    );
    setIsDetectionActive(false);
  };
  const router = useRouter();
  const gotoProfile = () => {
    router.push("/Profile");
  };

  const isDetectionButtonActive = isVoiceSensorActive || isSensorOnlyActive;

  return (
    <SafeAreaView className="flex-1 bg-black ">
      <ScrollView className="flex-1">
        <View className="p-5">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white text-3xl font-bold">Hi, Jane!</Text>
              <Text className="text-gray-400 mt-1">
                Welcome to your dashboard.
              </Text>
            </View>
            <TouchableOpacity
              className="p-3 bg-gray-800 rounded-full"
              onPress={gotoProfile}
            >
              <FontAwesome5 name="user-circle" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Digital Twin Placeholder */}
          <View className="mt-10 flex items-center justify-center">
            <View
              style={{ height: 250, width: 250 }}
              className="bg-gray-800 rounded-full flex items-center justify-center border border-green-500"
            >
              <Text className="text-white text-lg">
                Digital Twin Placeholder
              </Text>
            </View>
          </View>

          {/* Monitoring Status */}
          <View className="mt-10">
            <Text className="text-white text-2xl font-bold">
              Current Status
            </Text>
            <View className="mt-4 flex-row justify-between">
              <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
                <Text className="text-green-500 font-bold text-3xl">
                  6.2 Hz
                </Text>
                <Text className="text-gray-400 mt-2 text-sm">
                  Tremor Frequency
                </Text>
              </View>
              <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
                <Text className="text-green-500 font-bold text-3xl">85%</Text>
                <Text className="text-gray-400 mt-2 text-sm">
                  Gait Analysis
                </Text>
              </View>
            </View>
          </View>

          {/* Monitoring Toggles */}
          <View className="mt-10">
            <Text className="text-white text-2xl font-bold">
              Monitoring Modes
            </Text>
            <View className="mt-4 flex-row justify-between">
              <TouchableOpacity
                className="p-4 rounded-lg w-[48%] bg-gray-800 opacity-100"
                onPress={handleVoiceSensorToggle}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-center font-bold ${
                    isVoiceSensorActive ? "text-green-500" : "text-red-500"
                  }`}
                >
                  Voice & Sensor
                </Text>
                <Text
                  className={`text-center text-sm mt-1 ${
                    isVoiceSensorActive ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  Voice and tremor detection
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="p-4 rounded-lg w-[48%] bg-gray-800 opacity-100"
                onPress={handleSensorOnlyToggle}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-center font-bold ${
                    isSensorOnlyActive ? "text-green-500" : "text-red-500"
                  }`}
                >
                  Sensor Only
                </Text>
                <Text
                  className={`text-center text-sm mt-1 ${
                    isSensorOnlyActive ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  Only tremor detection
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detection Button */}
          <View className="mt-10">
            <TouchableOpacity
              className={`p-5 rounded-full opacity-100 ${
                isDetectionButtonActive && !isDetectionActive
                  ? "bg-green-500"
                  : isDetectionActive
                    ? "bg-red-500"
                    : "bg-gray-600"
              }`}
              activeOpacity={0.8}
              pointerEvents={
                isDetectionButtonActive || isDetectionActive ? "auto" : "none"
              }
              onPress={
                isDetectionButtonActive
                  ? isDetectionActive
                    ? handleStopDetection
                    : handleStartDetection
                  : () => {}
              }
            >
              <Text className="text-black text-lg font-bold text-center">
                {isDetectionActive ? "Stop Detection" : "Start Detection"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
