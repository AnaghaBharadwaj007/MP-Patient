import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import your two circle components
import GaitAnalysisCircle from "../GaitAnalysisCircle";
import TremorFrequencyCircle from "../TremorFrequencyCircle";

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function Dashboard() {
  const [patientName, setPatientName] = useState("Jane");
  const [isVoiceSensorActive, setIsVoiceSensorActive] = useState(false);
  const [isSensorOnlyActive, setIsSensorOnlyActive] = useState(false);
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchPatientName() {
      try {
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) throw new Error("User not authenticated");
        const payload = parseJwt(token);
        if (!payload || !payload.sub) throw new Error("Invalid token");

        const patientId = payload.sub;
        const response = await fetch(
          `https://35.224.59.87:8443/patient/${patientId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch patient details");
        }
        const data = await response.json();
        setPatientName(data.name || "Jane");
      } catch (error) {
        Alert.alert("Error", error.message);
      }
    }
    fetchPatientName();
  }, []);

  // Existing handlers unchanged

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
              <Text className="text-white text-3xl font-bold">
                Hi, {patientName}!
              </Text>
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

          {/* Your remaining dashboard UI unchanged */}
          <View className="mt-10 flex-row items-center justify-center space-x-8">
            <TremorFrequencyCircle value={6.2} threshold={7} />
            <GaitAnalysisCircle value={85} threshold={80} />
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
