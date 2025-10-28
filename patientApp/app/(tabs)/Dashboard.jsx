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
// --- Demo thresholds ---
const ACCEL_THRESHOLD_LOW = 0.5; // m/s^2 for distinguishing low/high jitter/shimmer
const GYRO_RANGE_TREMOR_THRESHOLD = 1.5; // rad/s difference (max-min) for fake prediction

function parseJwt(token) {
  /* ... (unchanged) ... */
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

// --- Helper function for fake prediction ---
function calculateAverageGyroRange(sensorDataArray) {
  if (!sensorDataArray || sensorDataArray.length < 2) return 0; // Need at least 2 points for range

  let minGx = Infinity,
    maxGx = -Infinity;
  let minGy = Infinity,
    maxGy = -Infinity;
  let minGz = Infinity,
    maxGz = -Infinity;

  sensorDataArray.forEach((data) => {
    // Basic validation
    if (
      typeof data.gx !== "number" ||
      typeof data.gy !== "number" ||
      typeof data.gz !== "number"
    )
      return;
    if (isNaN(data.gx) || isNaN(data.gy) || isNaN(data.gz)) return;

    if (data.gx < minGx) minGx = data.gx;
    if (data.gx > maxGx) maxGx = data.gx;
    if (data.gy < minGy) minGy = data.gy;
    if (data.gy > maxGy) maxGy = data.gy;
    if (data.gz < minGz) minGz = data.gz;
    if (data.gz > maxGz) maxGz = data.gz;
  });

  // Check if any valid data was processed
  if (
    minGx === Infinity ||
    maxGx === -Infinity ||
    minGy === Infinity ||
    maxGy === -Infinity ||
    minGz === Infinity ||
    maxGz === -Infinity
  ) {
    return 0; // Return 0 if no valid range could be calculated
  }

  const rangeX = maxGx - minGx;
  const rangeY = maxGy - minGy;
  const rangeZ = maxGz - minGz;

  return (rangeX + rangeY + rangeZ) / 3.0;
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
  const [activeTestType, setActiveTestType] = useState(null);
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [timerValue, setTimerValue] = useState(TEST_DURATION_SECONDS);
  const timerIntervalRef = useRef(null);
  const [voiceTestCompleted, setVoiceTestCompleted] = useState(false);
  const [concentratedSensorTestCompleted, setConcentratedSensorTestCompleted] =
    useState(false);
  const [distractedSensorTestCompleted, setDistractedSensorTestCompleted] =
    useState(false);
  const [voiceAudioUri, setVoiceAudioUri] = useState(null);
  const [concentratedSensorData, setConcentratedSensorData] = useState([]);
  const [distractedSensorData, setDistractedSensorData] = useState([]);
  const [mfccNpzFileUri, setMfccNpzFileUri] = useState(null);

  // --- Sensor metrics (UI display) ---
  const [tremorFrequency, setTremorFrequency] = useState(0); // Displayed in circle
  const [tremorAmplitude, setTremorAmplitude] = useState(0); // Displayed in circle
  const [jitter, setJitter] = useState(0); // Displayed in box
  const [shimmer, setShimmer] = useState(0); // Displayed in box
  const [nhr, setNhr] = useState(0); // Displayed in box
  const [hnr, setHnr] = useState(0); // Displayed in box

  // --- Effects ---

  // --- MODIFIED: Effect to update UI with FAKE live data ---
  useEffect(() => {
    if (isDetectionActive && motionData) {
      const timestamp = Date.now();
      // Ensure motionData has valid numbers before processing
      const currentData = {
        ax:
          typeof motionData.ax === "number" && !isNaN(motionData.ax)
            ? motionData.ax
            : 0,
        ay:
          typeof motionData.ay === "number" && !isNaN(motionData.ay)
            ? motionData.ay
            : 0,
        az:
          typeof motionData.az === "number" && !isNaN(motionData.az)
            ? motionData.az
            : 0,
        gx:
          typeof motionData.gx === "number" && !isNaN(motionData.gx)
            ? motionData.gx
            : 0,
        gy:
          typeof motionData.gy === "number" && !isNaN(motionData.gy)
            ? motionData.gy
            : 0,
        gz:
          typeof motionData.gz === "number" && !isNaN(motionData.gz)
            ? motionData.gz
            : 0,
        timestamp: timestamp,
      };

      const dataPoint = currentData;

      // Append data to correct array
      if (activeTestType === "sensorConcentrated") {
        setConcentratedSensorData((prev) => [...prev, dataPoint]);
      } else if (activeTestType === "sensorDistracted") {
        setDistractedSensorData((prev) => [...prev, dataPoint]);
      }
      // Note: We are not storing sensor data during voice test in this setup

      // --- Fake Jitter/Shimmer Logic ---
      const accelMagnitude = Math.sqrt(
        currentData.ax ** 2 + currentData.ay ** 2 + currentData.az ** 2
      );
      if (accelMagnitude < ACCEL_THRESHOLD_LOW) {
        // Low movement: low jitter/shimmer
        setJitter((Math.random() * 0.4 + 0.1).toFixed(2)); // Random between 0.1 - 0.5
        setShimmer((Math.random() * 0.4 + 0.1).toFixed(2)); // Random between 0.1 - 0.5
      } else {
        // High movement: higher random jitter/shimmer
        setJitter((Math.random() * 1.0 + 0.5).toFixed(2)); // Random between 0.5 - 1.5
        setShimmer((Math.random() * 1.0 + 0.5).toFixed(2)); // Random between 0.5 - 1.5
      }

      // --- Fake NHR/HNR Logic ---
      setNhr(Math.random().toFixed(2)); // Random between 0.00 - 1.00
      setHnr(Math.random().toFixed(2)); // Random between 0.00 - 1.00

      // --- Fake Tremor Freq/Amp Logic ---
      // Freq: Based on Gyro Z absolute value (scaled arbitrarily)
      setTremorFrequency((Math.abs(currentData.gz) * 2.5).toFixed(1)); // Arbitrary scaling
      // Amp: Based on Accel magnitude (scaled arbitrarily)
      setTremorAmplitude(
        Math.min(99, Math.max(10, accelMagnitude * 30)).toFixed(0)
      ); // Clamp between 10-99
    } else if (!isDetectionActive) {
      // Reset values when detection stops
      setJitter(0);
      setShimmer(0);
      setNhr(0);
      setHnr(0);
      setTremorFrequency(0);
      setTremorAmplitude(0);
    }
  }, [motionData, isDetectionActive, activeTestType]);

  useEffect(() => {
    /* ... (cleanup timer unchanged) ... */
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    /* ... (fetch patient name unchanged) ... */
    async function fetchPatientName() {
      try {
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) {
          console.log("No token found, skipping fetch.");
          return;
        }
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

  // --- Audio Recording Functions (unchanged) ---
  const startRecording = async () => {
    /* ... */
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
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
      console.log("Starting Recording...");
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
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
    /* ... */
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
    /* ... (unchanged) ... */
    setTimerValue(TEST_DURATION_SECONDS);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerValue((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          handleStopDetection();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStartDetection = async (testType) => {
    /* ... (logic unchanged) ... */
    if (connectedDevice) {
      //change it to not or add !, for the sake of review, i removed the !.
      Alert.alert("No Device Connected", "Connect to the glove first.");
      return;
    }
    if (isDetectionActive) {
      Alert.alert("In Progress", "Another test is already running.");
      return;
    }

    // Reset Metrics for the demo
    setJitter(0);
    setShimmer(0);
    setNhr(0);
    setHnr(0);
    setTremorFrequency(0);
    setTremorAmplitude(0);
    setPredictionResult(null); // Clear previous prediction

    if (testType === "voice") {
      setVoiceAudioUri(null);
      setVoiceTestCompleted(false);
    } // Reset completion status too
    else if (testType === "sensorConcentrated") {
      setConcentratedSensorData([]);
      setConcentratedSensorTestCompleted(false);
    } else if (testType === "sensorDistracted") {
      setDistractedSensorData([]);
      setDistractedSensorTestCompleted(false);
    }

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
    /* ... (logic unchanged, includes setting completion flags) ... */
    // Guard against multiple calls
    if (
      !isDetectionActive &&
      !timerIntervalRef.current &&
      activeTestType === null
    )
      return;

    const currentTestType = activeTestType; // Capture before resetting state
    console.log(`Stopping detection for test type: ${currentTestType}`);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsDetectionActive(false);
    stopStreamingData(); // Stop BLE before processing audio

    let completedTest = false;
    let savedUri = null;

    if (currentTestType === "voice") {
      savedUri = await stopRecording();
      if (savedUri) {
        setVoiceAudioUri(savedUri);
        setVoiceTestCompleted(true);
        completedTest = true;
        processAudioAndGenerateNpz(savedUri);
      } else {
        Alert.alert("Audio Error", "Failed to save audio recording.");
        setVoiceTestCompleted(false);
      }
    } else if (currentTestType === "sensorConcentrated") {
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
    } else if (currentTestType === "sensorDistracted") {
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

    setActiveTestType(null); // Reset active test type AFTER processing

    if (completedTest) {
      Alert.alert(
        "Detection Stopped",
        `${currentTestType.replace("sensor", " Sensor ")} test data collected.`
      );
    } else {
      Alert.alert(
        "Detection Stopped",
        `${currentTestType ? currentTestType.replace("sensor", " Sensor ") : ""} test stopped.`
      );
    }

    // Reset live display values after stopping
    setJitter(0);
    setShimmer(0);
    setNhr(0);
    setHnr(0);
    setTremorFrequency(0);
    setTremorAmplitude(0);
  };

  // --- Placeholder Functions (unchanged) ---
  const calculateMFCC = async (audioUri) => {
    console.warn("MFCC calculation not implemented.");
    return null;
  };
  const createNpzFile = async (mfccMatrix) => {
    console.warn(".npz creation not implemented.");
    return null;
  };
  const processAudioAndGenerateNpz = async (uri) => {
    /* ... */
  };

  // --- MODIFIED: Fake Prediction Logic ---
  const handlePredict = async () => {
    if (
      !voiceTestCompleted ||
      !concentratedSensorTestCompleted ||
      !distractedSensorTestCompleted
    ) {
      Alert.alert("Tests Incomplete", "Please complete all three tests.");
      return;
    }
    // No need to check mfccNpzFileUri for fake prediction
    if (
      concentratedSensorData.length === 0 ||
      distractedSensorData.length === 0
    ) {
      Alert.alert("Missing Data", "Sensor data not found for all tests.");
      return;
    }

    setIsPredicting(true);
    setPredictionResult(null);
    console.log("Starting FAKE prediction...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate delay

      // --- Fake Logic using Gyro Range ---
      const avgRangeConcentrated = calculateAverageGyroRange(
        concentratedSensorData
      );
      const avgRangeDistracted =
        calculateAverageGyroRange(distractedSensorData);
      console.log(
        "Avg Gyro Range (Concentrated):",
        avgRangeConcentrated.toFixed(3)
      );
      console.log(
        "Avg Gyro Range (Distracted):",
        avgRangeDistracted.toFixed(3)
      );

      let fakePrediction = "Parkinson's Unlikely";
      let fakeConfidence = Math.random() * 0.4 + 0.1;
      let fakeNhr = Math.random() * 0.15 + 0.05;
      let fakeHnr = Math.random() * 0.3 + 0.6;

      // Simple rule: If movement range is high in concentrated AND still notable in distracted
      if (
        avgRangeConcentrated > GYRO_RANGE_TREMOR_THRESHOLD &&
        avgRangeDistracted > GYRO_RANGE_TREMOR_THRESHOLD * 0.6
      ) {
        // Adjusted threshold for distracted
        fakePrediction = "Parkinson's Likely";
        fakeConfidence = Math.random() * 0.4 + 0.6;
        fakeNhr = Math.random() * 0.2 + 0.15;
        fakeHnr = Math.random() * 0.4 + 0.3;
      }
      // --- End Fake Logic ---

      const result = {
        prediction: fakePrediction,
        confidence: fakeConfidence,
        nhr: fakeNhr,
        hnr: fakeHnr,
      };

      console.log("Fake prediction result:", result);
      setPredictionResult(result);
      setNhr(result.nhr.toFixed(2)); // Update display with fake result
      setHnr(result.hnr.toFixed(2)); // Update display with fake result

      Alert.alert(
        "Prediction Complete (Simulated)",
        `Result: ${result.prediction}`
      );
    } catch (error) {
      console.error("Prediction Error (Simulated):", error);
      Alert.alert(
        "Prediction Error",
        "An error occurred during simulated prediction."
      );
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
        {/* Header */}
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

        {/* Circles */}
        <View className="mt-4 flex-row items-center justify-center space-x-8">
          <TremorFrequencyCircle
            value={parseFloat(tremorFrequency)}
            threshold={7}
          />
          <GaitAnalysisCircle
            value={parseInt(tremorAmplitude, 10)}
            threshold={80}
          />
        </View>

        {/* Status Boxes Group */}
        <View className="mt-10">
          <Text className="text-white text-2xl font-bold mb-4">
            Live / Result Metrics
          </Text>
          {/* Jitter / Shimmer */}
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
          {/* NHR / HNR */}
          <View className="flex-row justify-between mt-4">
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

        {/* Test Triggers */}
        <View className="mt-10">
          <Text className="text-white text-2xl font-bold mb-4">
            Start Tests
          </Text>
          {/* Timer */}
          {isDetectionActive && (
            <View className="mb-4 p-3 bg-blue-900 rounded-lg items-center">
              <Text className="text-white text-lg font-bold">
                Test in Progress:{" "}
                {activeTestType === "voice"
                  ? "Voice"
                  : activeTestType === "sensorConcentrated"
                    ? "Concentrated Sensor"
                    : "Distracted Sensor"}
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
          {/* Buttons */}
          <View>
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center mb-3 ${voiceTestCompleted ? "bg-green-900" : "bg-gray-800"}`}
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
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center mb-3 ${concentratedSensorTestCompleted ? "bg-green-900" : "bg-gray-800"}`}
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
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center ${distractedSensorTestCompleted ? "bg-green-900" : "bg-gray-800"}`}
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
              {/* Display NHR/HNR from prediction */}
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
