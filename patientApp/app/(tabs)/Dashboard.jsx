import { FontAwesome5 } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PERMISSIONS, request, RESULTS } from "react-native-permissions";
import { SafeAreaView } from "react-native-safe-area-context";

import GaitAnalysisCircle from "../GaitAnalysisCircle"; // Adjust path if needed
import TremorFrequencyCircle from "../TremorFrequencyCircle"; // Adjust path if needed
// --- CORRECTED Import Path ---
import { useBLE } from "../../hooks/BLEContext";

// --- Constants ---
const TEST_DURATION_SECONDS = 10;

function parseJwt(token) {
  // ... (function remains the same)
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
  const { connectedDevice, motionData, startStreamingData, stopStreamingData } =
    useBLE();
  const router = useRouter();

  // --- State Variables ---
  const [patientName, setPatientName] = useState("Jane");
  const [recording, setRecording] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);

  // Test Management State
  const [activeTestType, setActiveTestType] = useState(null);
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [timerValue, setTimerValue] = useState(TEST_DURATION_SECONDS);
  const timerIntervalRef = useRef(null);

  // Test Completion Status
  const [voiceTestCompleted, setVoiceTestCompleted] = useState(false);
  const [concentratedSensorTestCompleted, setConcentratedSensorTestCompleted] =
    useState(false);
  const [distractedSensorTestCompleted, setDistractedSensorTestCompleted] =
    useState(false);

  // Stored Data
  const [voiceAudioUri, setVoiceAudioUri] = useState(null);
  const [concentratedSensorData, setConcentratedSensorData] = useState([]);
  const [distractedSensorData, setDistractedSensorData] = useState([]);
  const [mfccNpzFileUri, setMfccNpzFileUri] = useState(null); // Placeholder

  // Sensor metrics (UI display)
  const [tremorFrequency, setTremorFrequency] = useState(6.2);
  const [tremorAmplitude, setTremorAmplitude] = useState(85);
  const [jitter, setJitter] = useState(0.1);
  const [shimmer, setShimmer] = useState(0.1);
  const [nhr, setNhr] = useState(0.2);
  const [hnr, setHnr] = useState(0.8);

  // --- Effects ---
  useEffect(() => {
    if (isDetectionActive && motionData) {
      const timestamp = Date.now();
      const dataPoint = { ...motionData, timestamp };
      if (activeTestType === "sensorConcentrated") {
        setConcentratedSensorData((prev) => [...prev, dataPoint]);
      } else if (activeTestType === "sensorDistracted") {
        setDistractedSensorData((prev) => [...prev, dataPoint]);
      }
      setJitter(motionData.ax.toFixed(2));
      setShimmer(motionData.ay.toFixed(2));
    }
  }, [motionData, isDetectionActive, activeTestType]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    async function fetchPatientName() {
      /* ... (fetch logic unchanged) ... */
      try {
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) {
          console.log("No token found, skipping fetch.");
          return;
        } // Handle no token case
        const payload = parseJwt(token);
        if (!payload || !payload.sub) throw new Error("Invalid token");
        const patientId = payload.sub;
        const response = await fetch(
          `https://heimdall-server.servehttp.com:8443/patient/${patientId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.status === 401) {
          console.error("Unauthorized fetching patient name.");
          throw new Error("Unauthorized");
        }
        if (!response.ok)
          throw new Error(
            `Failed to fetch patient details (Status: ${response.status})`
          );
        const data = await response.json();
        setPatientName(data.name || "Jane");
      } catch (error) {
        console.error("Error fetching patient name:", error);
        // Avoid alert for auth errors if handled elsewhere (e.g., redirect to login)
        if (error.message !== "Unauthorized") {
          Alert.alert(
            "Error",
            `Could not load patient details: ${error.message}`
          );
        }
      }
    }
    fetchPatientName();
  }, []);

  // --- Audio Recording Functions ---
  const startRecording = async () => {
    /* ... (function unchanged) ... */
    try {
      const platformPermission =
        Platform.OS === "ios"
          ? PERMISSIONS.IOS.MICROPHONE
          : PERMISSIONS.ANDROID.RECORD_AUDIO;
      const permissionStatus = await request(platformPermission);
      if (permissionStatus !== RESULTS.GRANTED) {
        Alert.alert(
          "Permission Required",
          "Please grant audio recording permission."
        );
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1, // DoNotMix
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // DoNotMix
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      console.log("Starting Recording...");
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY // Keep simple for now
      );
      setRecording(newRecording);
      console.log("Recording started");
      return true;
    } catch (error) {
      console.error("Recording Error:", error);
      Alert.alert("Recording Error", error.message);
      return false;
    }
  };

  const stopRecording = async () => {
    /* ... (function unchanged) ... */
    console.log("Stopping Recording...");
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log("Recording stopped and stored at", uri);
      setRecording(null);
      return uri;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error stopping recording", error.message);
      setRecording(null);
      return null;
    }
  };

  // --- Test Control Functions ---
  const startTimer = () => {
    /* ... (function unchanged) ... */
    setTimerValue(TEST_DURATION_SECONDS);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerValue((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          handleStopDetection(); // Auto-stop
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStartDetection = async (testType) => {
    /* ... (logic unchanged) ... */
    if (!connectedDevice) {
      Alert.alert("No Device Connected", "Connect to the glove first.");
      return;
    }
    if (isDetectionActive) {
      Alert.alert("In Progress", "Another test is already running.");
      return;
    }

    if (testType === "voice") setVoiceAudioUri(null);
    else if (testType === "sensorConcentrated") setConcentratedSensorData([]);
    else if (testType === "sensorDistracted") setDistractedSensorData([]);

    setActiveTestType(testType);
    setIsDetectionActive(true);
    startTimer();
    startStreamingData();

    if (testType === "voice") {
      const recordingStarted = await startRecording();
      if (!recordingStarted) {
        handleStopDetection();
        Alert.alert(
          "Setup Failed",
          "Could not start audio recording. Test cancelled."
        );
        return;
      }
    }
    Alert.alert(
      "Detection Started",
      `Starting ${testType.replace("sensor", " Sensor ")} test for ${TEST_DURATION_SECONDS} seconds.`
    );
  };

  const handleStopDetection = async () => {
    /* ... (logic unchanged) ... */
    if (!isDetectionActive && !timerIntervalRef.current) return;
    console.log(`Stopping detection for test type: ${activeTestType}`);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsDetectionActive(false);
    stopStreamingData();

    let completedTest = false;
    let savedUri = null;

    if (activeTestType === "voice") {
      savedUri = await stopRecording();
      if (savedUri) {
        setVoiceAudioUri(savedUri);
        setVoiceTestCompleted(true); // Mark complete *now*
        completedTest = true;
        // Trigger processing immediately after saving
        processAudioAndGenerateNpz(savedUri);
      } else {
        Alert.alert("Audio Error", "Failed to save audio recording.");
        setVoiceTestCompleted(false);
      }
    } else if (activeTestType === "sensorConcentrated") {
      if (concentratedSensorData.length > 0) {
        setConcentratedSensorTestCompleted(true);
        completedTest = true;
      } else {
        Alert.alert(
          "Data Error",
          "No sensor data collected for Concentrated test."
        );
        setConcentratedSensorTestCompleted(false);
      }
    } else if (activeTestType === "sensorDistracted") {
      if (distractedSensorData.length > 0) {
        setDistractedSensorTestCompleted(true);
        completedTest = true;
      } else {
        Alert.alert(
          "Data Error",
          "No sensor data collected for Distracted test."
        );
        setDistractedSensorTestCompleted(false);
      }
    }

    const currentTestType = activeTestType; // Capture before resetting
    setActiveTestType(null); // Reset active test type

    if (completedTest) {
      Alert.alert(
        "Detection Stopped",
        `${currentTestType.replace("sensor", " Sensor ")} test data collected.`
      );
    } else {
      Alert.alert(
        "Detection Stopped",
        `${currentTestType.replace("sensor", " Sensor ")} test stopped.`
      );
    }
  };

  // --- Placeholder Functions ---
  const calculateMFCC = async (audioUri) => {
    /* ... (placeholder unchanged) ... */
    console.warn("MFCC calculation not implemented yet.");
    Alert.alert("WIP", "MFCC calculation needs to be implemented.");
    return null;
  };
  const createNpzFile = async (mfccMatrix) => {
    /* ... (placeholder unchanged) ... */
    console.warn(
      ".npz file creation in React Native is non-standard and likely problematic."
    );
    Alert.alert(
      "WIP",
      ".npz file creation needs implementation (may require backend)."
    );
    return null;
  };
  const processAudioAndGenerateNpz = async (uri) => {
    /* ... (logic unchanged) ... */
    if (!uri) return;
    try {
      console.log("Calculating MFCCs for:", uri);
      const mfccMatrix = await calculateMFCC(uri);
      if (mfccMatrix) {
        console.log("MFCCs calculated, attempting to create .npz file...");
        const npzUri = await createNpzFile(mfccMatrix);
        if (npzUri) {
          setMfccNpzFileUri(npzUri);
          console.log(".npz file created at:", npzUri);
          // Voice test completion is already set in handleStopDetection
        } else {
          console.error("Failed to create .npz file.");
          setVoiceTestCompleted(false);
        } // Mark incomplete if NPZ fails
      } else {
        console.error("Failed to calculate MFCCs.");
        setVoiceTestCompleted(false);
      } // Mark incomplete if MFCC fails
    } catch (error) {
      console.error("Error processing audio:", error);
      Alert.alert(
        "Processing Error",
        `Failed to process audio: ${error.message}`
      );
      setVoiceTestCompleted(false);
    }
  };
  const handlePredict = async () => {
    /* ... (placeholder unchanged) ... */
    if (
      !voiceTestCompleted ||
      !concentratedSensorTestCompleted ||
      !distractedSensorTestCompleted
    ) {
      Alert.alert("Tests Incomplete", "Please complete all three tests.");
      return;
    }
    if (
      !mfccNpzFileUri ||
      concentratedSensorData.length === 0 ||
      distractedSensorData.length === 0
    ) {
      Alert.alert("Missing Data", "Could not find data/file for all tests.");
      return;
    }
    setIsPredicting(true);
    setPredictionResult(null);
    console.log("Starting prediction process...");
    try {
      console.log("Sending data to backend for prediction...");
      // --- Placeholder ---
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockResult = {
        prediction: "Condition A Likely",
        confidence: 0.82,
        nhr: 0.21,
        hnr: 0.81,
      };
      console.log("Mock prediction result:", mockResult);
      setPredictionResult(mockResult);
      if (mockResult.nhr !== undefined) setNhr(mockResult.nhr.toFixed(2));
      if (mockResult.hnr !== undefined) setHnr(mockResult.hnr.toFixed(2));
      Alert.alert("Prediction Complete", `Result: ${mockResult.prediction}`);
    } catch (error) {
      console.error("Prediction Error:", error);
      Alert.alert("Prediction Error", error.message);
      setPredictionResult(null);
    } finally {
      setIsPredicting(false);
    }
  };

  const gotoProfile = () => {
    router.push("/Profile");
  };
  const canPredict =
    voiceTestCompleted &&
    concentratedSensorTestCompleted &&
    distractedSensorTestCompleted &&
    !isPredicting;

  return (
    <SafeAreaView className="flex-1 bg-black ">
      <ScrollView className="flex-1 p-5">
        {/* Header (Unchanged) */}
        <View className="flex-row items-center justify-between mb-6">
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

        {/* Circles (Unchanged) */}
        <View className="mt-4 flex-row items-center justify-center space-x-8">
          <TremorFrequencyCircle value={tremorFrequency} threshold={7} />
          <GaitAnalysisCircle value={tremorAmplitude} threshold={80} />
        </View>

        {/* --- UI REORDERING: Status Boxes Grouped Together --- */}
        <View className="mt-10">
          <Text className="text-white text-2xl font-bold mb-4">
            Live Sensor Status
          </Text>
          <View className="flex-row justify-between">
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">
                {jitter}
              </Text>
              <Text className="text-gray-400 mt-2 text-sm">
                Jitter (Live Ax)
              </Text>
            </View>
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">
                {shimmer}
              </Text>
              <Text className="text-gray-400 mt-2 text-sm">
                Shimmer (Live Ay)
              </Text>
            </View>
          </View>

          {/* Moved Voice Quality Metrics Here */}
          <Text className="text-white text-2xl font-bold mb-4 mt-8">
            Voice Quality Metrics
          </Text>
          <View className="flex-row justify-between">
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">{nhr}</Text>
              <Text className="text-gray-400 mt-2 text-sm text-center">
                Noise-to-Harmonics Ratio (NHR)
              </Text>
            </View>
            <View className="p-4 bg-gray-800 rounded-lg w-[48%] items-center">
              <Text className="text-green-500 font-bold text-3xl">{hnr}</Text>
              <Text className="text-gray-400 mt-2 text-sm text-center">
                Harmonics-to-Noise Ratio (HNR)
              </Text>
            </View>
          </View>
        </View>
        {/* --- END OF STATUS BOXES GROUP --- */}

        {/* Monitoring Modes / Test Triggers */}
        <View className="mt-10">
          <Text className="text-white text-2xl font-bold mb-4">
            Start Tests
          </Text>

          {/* Timer Display */}
          {isDetectionActive && (
            <View className="mb-4 p-3 bg-blue-900 rounded-lg items-center">
              <Text className="text-white text-lg font-bold">
                {" "}
                Test in Progress: {/* ... */}{" "}
              </Text>
              <Text className="text-yellow-400 text-4xl font-bold mt-1">
                {" "}
                {timerValue}s{" "}
              </Text>
              <TouchableOpacity
                className="mt-2 bg-red-600 px-4 py-1 rounded-full"
                onPress={handleStopDetection}
              >
                <Text className="text-white font-semibold">Stop Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* --- UI FIX: Added mb-3 (margin-bottom) to each button for spacing --- */}
          <View>
            {/* Voice Test Button */}
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center mb-3 ${voiceTestCompleted ? "bg-green-900" : "bg-gray-800"}`} // Added mb-3
              onPress={() => handleStartDetection("voice")}
              disabled={isDetectionActive}
            >
              <View>
                <Text
                  className={`font-bold ${voiceTestCompleted ? "text-green-400" : "text-blue-400"}`}
                >
                  Voice Test
                </Text>
                <Text
                  className={`text-sm mt-1 ${voiceTestCompleted ? "text-green-300" : "text-gray-400"}`}
                >
                  Record voice for analysis
                </Text>
              </View>
              {voiceTestCompleted && (
                <FontAwesome5
                  name="check-circle"
                  size={20}
                  color="lightgreen"
                />
              )}
            </TouchableOpacity>

            {/* Concentrated Sensor Test Button */}
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center mb-3 ${concentratedSensorTestCompleted ? "bg-green-900" : "bg-gray-800"}`} // Added mb-3
              onPress={() => handleStartDetection("sensorConcentrated")}
              disabled={isDetectionActive}
            >
              <View>
                <Text
                  className={`font-bold ${concentratedSensorTestCompleted ? "text-green-400" : "text-blue-400"}`}
                >
                  Sensor Test (Concentrated)
                </Text>
                <Text
                  className={`text-sm mt-1 ${concentratedSensorTestCompleted ? "text-green-300" : "text-gray-400"}`}
                >
                  Focus on hand movement
                </Text>
              </View>
              {concentratedSensorTestCompleted && (
                <FontAwesome5
                  name="check-circle"
                  size={20}
                  color="lightgreen"
                />
              )}
            </TouchableOpacity>

            {/* Distracted Sensor Test Button */}
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center ${distractedSensorTestCompleted ? "bg-green-900" : "bg-gray-800"}`} // NOTE: No mb-3 on the last item
              onPress={() => handleStartDetection("sensorDistracted")}
              disabled={isDetectionActive}
            >
              <View>
                <Text
                  className={`font-bold ${distractedSensorTestCompleted ? "text-green-400" : "text-blue-400"}`}
                >
                  Sensor Test (Distracted)
                </Text>
                <Text
                  className={`text-sm mt-1 ${distractedSensorTestCompleted ? "text-green-300" : "text-gray-400"}`}
                >
                  Count numbers during test
                </Text>
              </View>
              {distractedSensorTestCompleted && (
                <FontAwesome5
                  name="check-circle"
                  size={20}
                  color="lightgreen"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Prediction Section */}
        <View className="mt-10 mb-10">
          <TouchableOpacity
            className={`p-5 rounded-full ${canPredict ? "bg-purple-600" : "bg-gray-600"}`}
            onPress={handlePredict}
            disabled={!canPredict}
          >
            {isPredicting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white text-lg font-bold text-center">
                Predict Results
              </Text>
            )}
          </TouchableOpacity>

          {/* Display Prediction Result */}
          {predictionResult && (
            <View className="mt-6 p-4 bg-gray-800 rounded-lg items-center">
              <Text className="text-white text-xl font-bold mb-2">
                Prediction Result
              </Text>
              <Text className="text-lg text-cyan-400">
                {predictionResult.prediction || "N/A"}
              </Text>
              {predictionResult.confidence !== undefined && (
                <Text className="text-gray-400 mt-1">
                  Confidence: {(predictionResult.confidence * 100).toFixed(1)}%
                </Text>
              )}
              <View className="flex-row justify-around w-full mt-4">
                <View className="items-center">
                  <Text className="text-gray-400 text-sm">NHR</Text>
                  <Text className="text-white font-bold text-xl">{nhr}</Text>
                </View>
                <View className="items-center">
                  <Text className="text-gray-400 text-sm">HNR</Text>
                  <Text className="text-white font-bold text-xl">{hnr}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
