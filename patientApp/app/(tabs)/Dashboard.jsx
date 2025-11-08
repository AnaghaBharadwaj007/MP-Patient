import { FontAwesome5 } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal, // Import Modal
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PERMISSIONS, request, RESULTS } from "react-native-permissions";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBLE } from "../../hooks/BLEContext"; // Corrected path
import GaitAnalysisCircle from "../GaitAnalysisCircle"; // Adjust path if needed
import TremorFrequencyCircle from "../TremorFrequencyCircle"; // Adjust path if needed

// --- Constants ---
const TEST_DURATION_SECONDS = 10;
const ACCEL_THRESHOLD_LOW = 0.5;
const GYRO_RANGE_TREMOR_THRESHOLD = 1.5;

// --- NEW: Non-Motor Questions ---
const NON_MOTOR_QUESTIONS = [
  {
    key: "q1",
    category: "Sleep/Fatigue",
    symptom: "Acting out during dreams (REM behavior disorder)",
  },
  { key: "q2", category: "Smell/Taste", symptom: "Loss of smell (anosmia)" },
  { key: "q3", category: "Gastrointestinal", symptom: "Constipation" },
  {
    key: "q4",
    category: "Apathy/Attention",
    symptom: "Loss of interest / apathy",
  },
  {
    key: "q5",
    category: "Sleep/Fatigue",
    symptom: "Insomnia / fragmented sleep",
  },
  { key: "q6", category: "Depression/Anxiety", symptom: "Anxiety / sadness" },
  { key: "q7", category: "Urinary", symptom: "Nocturia (night urination)" },
  {
    key: "q8",
    category: "Pain",
    symptom: "Generalized or musculoskeletal pain",
  },
  {
    key: "q9",
    category: "Cardiovascular",
    symptom: "Dizziness / orthostatic hypotension",
  },
  {
    key: "q10",
    category: "Cognitive",
    symptom: "Memory / concentration difficulty",
  },
];

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

function calculateAverageGyroRange(sensorDataArray) {
  /* ... (unchanged) ... */
  if (!sensorDataArray || sensorDataArray.length < 2) return 0;
  let minGx = Infinity,
    maxGx = -Infinity,
    minGy = Infinity,
    maxGy = -Infinity,
    minGz = Infinity,
    maxGz = -Infinity;
  sensorDataArray.forEach((data) => {
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
  if (
    minGx === Infinity ||
    maxGx === -Infinity ||
    minGy === Infinity ||
    maxGy === -Infinity ||
    minGz === Infinity ||
    maxGz === -Infinity
  ) {
    return 0;
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

  // --- Test Completion Status (Added nonMotor) ---
  const [voiceTestCompleted, setVoiceTestCompleted] = useState(false);
  const [concentratedSensorTestCompleted, setConcentratedSensorTestCompleted] =
    useState(false);
  const [distractedSensorTestCompleted, setDistractedSensorTestCompleted] =
    useState(false);
  const [nonMotorTestCompleted, setNonMotorTestCompleted] = useState(false); // NEW

  // Stored Data
  const [voiceAudioUri, setVoiceAudioUri] = useState(null);
  const [concentratedSensorData, setConcentratedSensorData] = useState([]);
  const [distractedSensorData, setDistractedSensorData] = useState([]);
  const [mfccNpzFileUri, setMfccNpzFileUri] = useState(null);

  // --- NEW: Non-Motor Modal State ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [nonMotorScores, setNonMotorScores] = useState({}); // Stores {q1: 5, q2: 7, ...}

  // Sensor metrics (UI display)
  const [tremorFrequency, setTremorFrequency] = useState(0);
  const [tremorAmplitude, setTremorAmplitude] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [shimmer, setShimmer] = useState(0);
  const [nhr, setNhr] = useState(0);
  const [hnr, setHnr] = useState(0);

  // --- Effects ---

  // Effect to update UI with FAKE live data (Unchanged)
  useEffect(() => {
    if (isDetectionActive && motionData) {
      const timestamp = Date.now();
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
      if (activeTestType === "sensorConcentrated") {
        setConcentratedSensorData((prev) => [...prev, dataPoint]);
      } else if (activeTestType === "sensorDistracted") {
        setDistractedSensorData((prev) => [...prev, dataPoint]);
      }
      const accelMagnitude = Math.sqrt(
        currentData.ax ** 2 + currentData.ay ** 2 + currentData.az ** 2
      );
      if (accelMagnitude < ACCEL_THRESHOLD_LOW) {
        setJitter((Math.random() * 0.4 + 0.1).toFixed(2));
        setShimmer((Math.random() * 0.4 + 0.1).toFixed(2));
      } else {
        setJitter((Math.random() * 1.0 + 0.5).toFixed(2));
        setShimmer((Math.random() * 1.0 + 0.5).toFixed(2));
      }
      setNhr(Math.random().toFixed(2));
      setHnr(Math.random().toFixed(2));
      setTremorFrequency((Math.abs(currentData.gz) * 2.5).toFixed(1));
      setTremorAmplitude(
        Math.min(99, Math.max(10, accelMagnitude * 30)).toFixed(0)
      );
    } else if (!isDetectionActive) {
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
    /* ... (unchanged) ... */
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
    /* ... (unchanged) ... */
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
      //removed this ! sign, for the review as we couldn't connect to our device
      Alert.alert("No Device Connected", "Connect to the glove first.");
      return;
    } // Corrected ! logic
    if (isDetectionActive) {
      Alert.alert("In Progress", "Another test is already running.");
      return;
    }
    setJitter(0);
    setShimmer(0);
    setNhr(0);
    setHnr(0);
    setTremorFrequency(0);
    setTremorAmplitude(0);
    setPredictionResult(null);
    if (testType === "voice") {
      setVoiceAudioUri(null);
      setVoiceTestCompleted(false);
    } else if (testType === "sensorConcentrated") {
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
        Alert.alert("Setup Failed", "Could not start audio recording.");
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
    if (
      !isDetectionActive &&
      !timerIntervalRef.current &&
      activeTestType === null
    )
      return;
    const currentTestType = activeTestType;
    console.log(`Stopping detection for test type: ${currentTestType}`);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsDetectionActive(false);
    stopStreamingData();
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
        Alert.alert("Data Error", "No sensor data collected.");
        setConcentratedSensorTestCompleted(false);
      }
    } else if (currentTestType === "sensorDistracted") {
      if (distractedSensorData.length > 0) {
        setDistractedSensorTestCompleted(true);
        completedTest = true;
      } else {
        Alert.alert("Data Error", "No sensor data collected.");
        setDistractedSensorTestCompleted(false);
      }
    }
    setActiveTestType(null);
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

  // --- MODIFIED: Fake Prediction Logic (unchanged) ---
  const handlePredict = async () => {
    if (
      !voiceTestCompleted ||
      !concentratedSensorTestCompleted ||
      !distractedSensorTestCompleted ||
      !nonMotorTestCompleted
    ) {
      Alert.alert(
        "Tests Incomplete",
        "Please complete all four tests: Voice, both Sensor tests, and the Non-Motor Symptom survey."
      );
      return;
    }
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
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const avgRangeConcentrated = calculateAverageGyroRange(
        concentratedSensorData
      );
      const avgRangeDistracted =
        calculateAverageGyroRange(distractedSensorData);
      const nonMotorScoreSum = Object.values(nonMotorScores).reduce(
        (sum, val) => sum + val,
        0
      );
      const avgNonMotorScore =
        nonMotorScoreSum / NON_MOTOR_QUESTIONS.length || 0;
      console.log("Avg Gyro (Concentrated):", avgRangeConcentrated.toFixed(3));
      console.log("Avg Gyro (Distracted):", avgRangeDistracted.toFixed(3));
      console.log("Avg Non-Motor Score:", avgNonMotorScore.toFixed(2));
      let fakePrediction = "Parkinson's Unlikely";
      let fakeConfidence = Math.random() * 0.4 + 0.1;
      let fakeNhr = Math.random() * 0.15 + 0.05;
      let fakeHnr = Math.random() * 0.3 + 0.6;
      if (
        (avgRangeConcentrated > GYRO_RANGE_TREMOR_THRESHOLD &&
          avgRangeDistracted > GYRO_RANGE_TREMOR_THRESHOLD * 0.6) ||
        (avgRangeConcentrated > GYRO_RANGE_TREMOR_THRESHOLD &&
          avgNonMotorScore > 5) ||
        avgNonMotorScore > 7
      ) {
        fakePrediction = "Parkinson's Likely";
        fakeConfidence = Math.random() * 0.4 + 0.6;
        fakeNhr = Math.random() * 0.2 + 0.15;
        fakeHnr = Math.random() * 0.4 + 0.3;
      }
      const result = {
        prediction: fakePrediction,
        confidence: fakeConfidence,
        nhr: fakeNhr,
        hnr: fakeHnr,
      };
      setPredictionResult(result);
      setNhr(result.nhr.toFixed(2));
      setHnr(result.hnr.toFixed(2));
      Alert.alert(
        "Prediction Complete (Simulated)",
        `Result: ${result.prediction}`
      );
    } catch (error) {
      console.error("Prediction Error (Simulated):", error);
      Alert.alert("Prediction Error", "An error occurred.");
    } finally {
      setIsPredicting(false);
    }
  };

  const gotoProfile = () => {
    router.push("/Profile");
  };

  // --- MODIFIED: canPredict (unchanged) ---
  const canPredict =
    voiceTestCompleted &&
    concentratedSensorTestCompleted &&
    distractedSensorTestCompleted &&
    nonMotorTestCompleted &&
    !isPredicting;

  // --- NEW: Functions to handle the modal (unchanged) ---
  const openNonMotorModal = () => {
    setNonMotorScores({});
    setPredictionResult(null);
    setIsModalVisible(true);
  };

  const handleSubmitNonMotorTest = () => {
    if (Object.keys(nonMotorScores).length < NON_MOTOR_QUESTIONS.length) {
      Alert.alert("Incomplete", "Please provide a rating for all 10 symptoms.");
      return;
    }
    console.log("Non-Motor Scores Submitted:", nonMotorScores);
    setNonMotorTestCompleted(true);
    setIsModalVisible(false);
    Alert.alert(
      "Symptoms Logged",
      "Your non-motor symptom scores have been saved."
    );
  };

  // --- **** THIS IS THE MODIFIED FUNCTION **** ---
  // --- Replaced the wrapping View with a horizontal ScrollView ---
  const renderRatingRow = (questionKey) => {
    const currentRating = nonMotorScores[questionKey];
    const buttons = [];
    for (let i = 1; i <= 10; i++) {
      const isSelected = currentRating === i;
      buttons.push(
        <TouchableOpacity
          key={i}
          // Made buttons larger (w-10 h-10) and increased margin
          className={`w-10 h-10 rounded-full justify-center items-center mx-2 ${isSelected ? "bg-green-500" : "bg-gray-600"}`}
          onPress={() =>
            setNonMotorScores((prev) => ({ ...prev, [questionKey]: i }))
          }
        >
          <Text
            className={`font-bold text-lg ${isSelected ? "text-black" : "text-white"}`}
          >
            {i}
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      // Use a horizontal ScrollView
      <ScrollView
        horizontal={true} // Makes the scroll direction horizontal
        showsHorizontalScrollIndicator={false} // Hides the scrollbar
        className="mt-3 -mx-4" // Negative margin to allow content to "bleed" to the edges
        contentContainerStyle={{ paddingHorizontal: 16 }} // Add padding inside the scroller
      >
        {buttons}
      </ScrollView>
    );
  };
  // --- **** END OF MODIFIED FUNCTION **** ---

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
          <TremorFrequencyCircle
            value={parseFloat(tremorFrequency)}
            threshold={7}
          />
          <GaitAnalysisCircle
            value={parseInt(tremorAmplitude, 10)}
            threshold={80}
          />
        </View>

        {/* Status Boxes Group (Unchanged) */}
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

        {/* Test Triggers (Unchanged) */}
        <View className="mt-10">
          <Text className="text-white text-2xl font-bold mb-4">
            Start Tests
          </Text>
          {/* Timer */}
          {isDetectionActive && (
            <View className="mb-4 p-3 bg-blue-900 rounded-lg items-center">
              <Text className="text-white text-lg font-bold">
                {" "}
                Test in Progress:{" "}
                {activeTestType === "voice"
                  ? "Voice"
                  : activeTestType === "sensorConcentrated"
                    ? "Concentrated Sensor"
                    : "Distracted Sensor"}{" "}
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
            {/* Voice Test Button */}
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

            {/* Concentrated Sensor Test Button */}
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

            {/* Distracted Sensor Test Button */}
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center mb-3 ${distractedSensorTestCompleted ? "bg-green-900" : "bg-gray-800"}`}
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

            {/* Non-Motor Symptom Test Button (Unchanged) */}
            <TouchableOpacity
              className={`p-4 rounded-lg flex-row justify-between items-center ${nonMotorTestCompleted ? "bg-green-900" : "bg-gray-800"}`}
              onPress={openNonMotorModal}
              disabled={isDetectionActive}
            >
              <View>
                <Text
                  className={`font-bold ${nonMotorTestCompleted ? "text-green-400" : "text-blue-400"}`}
                >
                  Non-Motor Symptom Survey
                </Text>
                <Text
                  className={`text-sm mt-1 ${nonMotorTestCompleted ? "text-green-300" : "text-gray-400"}`}
                >
                  Rate your daily symptoms
                </Text>
              </View>
              {nonMotorTestCompleted && (
                <FontAwesome5
                  name="check-circle"
                  size={20}
                  color="lightgreen"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Prediction Section (Unchanged) */}
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

      {/* --- MODAL with UPDATED renderRatingRow --- */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-black">
          <ScrollView className="flex-1 p-5">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-3xl font-bold">
                Non-Motor Symptoms
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <FontAwesome5 name="times-circle" size={30} color="gray" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 mb-6">
              Please rate the severity of each symptom over the last week from 1
              (Not present) to 10 (Very severe).
            </Text>

            {/* Render all questions */}
            {NON_MOTOR_QUESTIONS.map((q) => (
              <View key={q.key} className="bg-gray-800 rounded-lg p-4 mb-4">
                <Text className="text-white text-lg font-bold">
                  {q.symptom}
                </Text>
                <Text className="text-gray-400 text-sm mb-3">{q.category}</Text>
                {/* This function now renders the horizontal scroller */}
                {renderRatingRow(q.key)}
              </View>
            ))}

            <TouchableOpacity
              className="p-5 rounded-full bg-green-500 my-6"
              onPress={handleSubmitNonMotorTest}
            >
              <Text className="text-black text-lg font-bold text-center">
                Submit Survey
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* --- END MODAL --- */}
    </SafeAreaView>
  );
}
