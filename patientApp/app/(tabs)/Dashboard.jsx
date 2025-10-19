import { FontAwesome5 } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Added react-native-permissions imports
import { PERMISSIONS, request, RESULTS } from "react-native-permissions";

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
  const [recording, setRecording] = useState(null);

  // Sensor metrics, default values for example
  const [tremorFrequency, setTremorFrequency] = useState(6.2);
  const [tremorAmplitude, setTremorAmplitude] = useState(85);
  const [jitter, setJitter] = useState(0.1);
  const [shimmer, setShimmer] = useState(0.1);
  const [nhr, setNhr] = useState(0.2);
  const [hnr, setHnr] = useState(0.8);

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
          `https://heimdall-server.servehttp.com:8443/patient/${patientId}`,
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
        // TODO: Fetch sensor data here and update states (tremorFrequency, etc.)
      } catch (error) {
        Alert.alert("Error", error.message);
      }
    }
    fetchPatientName();
  }, []);

  // Audio recording start with permission
  const startRecording = async () => {
    try {
      // --- UPDATED PERMISSION LOGIC ---
      const platformPermission =
        Platform.OS === "ios"
          ? PERMISSIONS.IOS.MICROPHONE
          : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const permissionStatus = await request(platformPermission);

      if (permissionStatus !== RESULTS.GRANTED) {
        // --- END OF UPDATE ---
        Alert.alert(
          "Permission Required",
          "Please grant audio recording permission."
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      // const { recording } = await Audio.Recording.createAsync(
      //   Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      // );
      // setRecording(recording);
      Alert.alert("Recording Started", "Audio recording is now active.");
    } catch (error) {
      Alert.alert("Recording Error", error.message);
    }
  };

  // Stop audio recording
  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      setRecording(null);
      Alert.alert("Recording Stopped", "Audio recording has been stopped.");
      // Optional: process or save audio here if implemented later
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

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
    if (isVoiceSensorActive) startRecording();
  };

  const handleStopDetection = () => {
    Alert.alert(
      "Detection Stopped",
      "Data recording has been stopped. We will analyze the results and provide an update."
    );
    setIsDetectionActive(false);
    if (recording) stopRecording();
  };

  const gotoProfile = () => {
    router.push("/Profile");
  };

  const isDetectionButtonActive = isVoiceSensorActive || isSensorOnlyActive;

  return (
    <SafeAreaView className="flex-1 bg-black ">
      <ScrollView className="flex-1 p-5">
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

        {/* Circles for Tremor Frequency and Amplitude */}
        <View className="mt-10 flex-row items-center justify-center space-x-8">
          <TremorFrequencyCircle value={tremorFrequency} threshold={7} />
          <GaitAnalysisCircle value={tremorAmplitude} threshold={80} />
        </View>

        {/* Monitoring Status */}
        <View className="mt-10">
          <Text className="text-white text-2xl font-bold mb-4">
            Current Status
          </Text>
          <View className="flex-row justify-between">
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">
                {jitter}
              </Text>
              <Text className="text-gray-400 mt-2 text-sm">Jitter</Text>
            </View>
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">
                {shimmer}
              </Text>
              <Text className="text-gray-400 mt-2 text-sm">Shimmer</Text>
            </View>
          </View>

          <Text className="text-white text-2xl font-bold mb-4 mt-8">
            Voice Signal Quality
          </Text>
          <View className="flex-row justify-between">
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">{nhr}</Text>
              <Text className="text-gray-400 mt-2 text-sm">
                Noise-to-Harmonics Ratio (NHR)
              </Text>
            </View>
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">{hnr}</Text>
              <Text className="text-gray-400 mt-2 text-sm">
                Harmonics-to-Noise Ratio (HNR)
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
                  isSensorOnlyActive ? "text-green-500" : "text-red-5Same"
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
      </ScrollView>
    </SafeAreaView>
  );
}
