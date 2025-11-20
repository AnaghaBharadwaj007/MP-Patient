import { FontAwesome5 } from "@expo/vector-icons";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
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

// --- Path is corrected as requested ---
import { useBLE } from "../../hooks/BLEContext";
import GaitAnalysisCircle from "../GaitAnalysisCircle"; // Adjust path if needed
import TremorFrequencyCircle from "../TremorFrequencyCircle"; // Adjust path if needed

// --- Constants ---
const TEST_DURATION_SECONDS = 20;
// --- FIX 1: Re-define the missing constant ---
const ACCEL_THRESHOLD_LOW = 0.5;

const NON_MOTOR_QUESTIONS = [
  /* ... (questions array unchanged) ... */
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

// --- FAKE DATA GENERATOR (unchanged) ---
function generateFakeSensorData() {
  /* ... (unchanged) ... */
  const data = [];
  const points = TEST_DURATION_SECONDS * 100;
  for (let i = 0; i < points; i++) {
    data.push({
      ax: (Math.random() - 0.5) * 2,
      ay: (Math.random() - 0.5) * 2,
      az: (Math.random() - 0.5) * 2 + 9.8,
      gx: (Math.random() - 0.5) * 3,
      gy: (Math.random() - 0.5) * 3,
      gz: (Math.random() - 0.5) * 3,
      timestamp: Date.now() + i * 10,
    });
  }
  return data;
}

export default function Dashboard() {
  const { connectedDevice, motionData, startStreamingData, stopStreamingData } = useBLE();
  const router = useRouter();

  // --- State Variables ---
  const [patientName, setPatientName] = useState("Jane");
  const [recording, setRecording] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  // --- MODIFIED: predictionResult will hold the full object ---
  const [predictionResult, setPredictionResult] = useState(null);
  const [activeTestType, setActiveTestType] = useState(null);
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [timerValue, setTimerValue] = useState(TEST_DURATION_SECONDS);
  const timerIntervalRef = useRef(null);

  const [voiceTestCompleted, setVoiceTestCompleted] = useState(false);
  const [concentratedSensorTestCompleted, setConcentratedSensorTestCompleted] = useState(false);
  const [distractedSensorTestCompleted, setDistractedSensorTestCompleted] = useState(false);
  const [nonMotorTestCompleted, setNonMotorTestCompleted] = useState(false);

  // Stored Data
  const [voiceAudioUri, setVoiceAudioUri] = useState(null);
  const [concentratedSensorData, setConcentratedSensorData] = useState([]);
  const [distractedSensorData, setDistractedSensorData] = useState([]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [nonMotorScores, setNonMotorScores] = useState({});

  // --- NEW: State for the result modal ---
  const [isResultModalVisible, setIsResultModalVisible] = useState(false);

  // Sensor metrics (UI display)
  const [tremorFrequency, setTremorFrequency] = useState(0);
  const [tremorAmplitude, setTremorAmplitude] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [shimmer, setShimmer] = useState(0);
  const [nhr, setNhr] = useState(0);
  const [hnr, setHnr] = useState(0);

  // --- Effects ---

  // Effect to update UI with FAKE live data (unchanged)
  useEffect(() => {
    /* ... (unchanged) ... */
    if (isDetectionActive && Array.isArray(motionData) && motionData.length > 0) {
      const newSamples = motionData; // The array of 20 samples per packet

      // 1. Collect Data Points (Append all 20 samples at once)
      if (activeTestType === "sensorConcentrated") {
        // Use spread operator to append all 20 elements
        setConcentratedSensorData((prev) => [...prev, ...newSamples]);
      } else if (activeTestType === "sensorDistracted") {
        // Use spread operator to append all 20 elements
        setDistractedSensorData((prev) => [...prev, ...newSamples]);
      }

      // 2. Calculate and Display LIVE Metrics using the LAST sample
      const timestamp = Date.now();
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

  // --- MODIFIED: Audio Recording with corrected constants ---
  const startRecording = async () => {
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
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      console.log("Starting Recording (attempting 16kHz mono WAV)...");
      const { recording: newRecording } = await Audio.Recording.createAsync({
        // --- FIX 2: Corrected Audio constants namespaces ---
        android: {
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT, // Corrected
          audioEncoder: Audio.AndroidAudioEncoder.PCM_16BIT, // Corrected
          sampleRate: 16000,
          numberOfChannels: 1,
        },
        ios: {
          extension: ".wav",
          audioQuality: Audio.IOSAudioQuality.MAX, // Corrected
          sampleRate: 16000,
          numberOfChannels: 1,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

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

  // --- MODIFIED: Test Control Functions ---
  const startTimer = () => {
    /* ... (unchanged, still fakes live data) ... */
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
      const accelMag = Math.random() * 2.0;
      if (accelMag < ACCEL_THRESHOLD_LOW) {
        setJitter((Math.random() * 0.4 + 0.1).toFixed(2));
        setShimmer((Math.random() * 0.4 + 0.1).toFixed(2));
      } else {
        setJitter((Math.random() * 1.0 + 0.5).toFixed(2));
        setShimmer((Math.random() * 1.0 + 0.5).toFixed(2));
      }
      setNhr(Math.random().toFixed(2));
      setHnr(Math.random().toFixed(2));
      setTremorFrequency((Math.random() * 5 + 3).toFixed(1));
      setTremorAmplitude(Math.min(99, Math.max(10, accelMag * 40)).toFixed(0));
    }, 1000);
  };

  const handleStartDetection = async (testType) => {
  // Check for device connection only for sensor tests
    if (
      (testType === "sensorConcentrated" || testType === "sensorDistracted") &&
      !connectedDevice
    ) {
      Alert.alert(
        "Device Disconnected",
        "Please connect your BLE device to run a sensor test."
      );
      return;
    }

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
    if (testType === "voice") {
      const recordingStarted = await startRecording();
      if (!recordingStarted) {
        handleStopDetection();
        Alert.alert("Setup Failed", "Could not start audio recording.");
        return;
      }
    } 
    // Sensor Test specific logic: Start BLE Streaming
    else if (
      testType === "sensorConcentrated" ||
      testType === "sensorDistracted"
    ) {
      try {
        await startStreamingData(); // <<< Actual BLE streaming starts here
        console.log("BLE Streaming started.");
      } catch (e) {
        console.error("Failed to start BLE streaming:", e);
        handleStopDetection(); // Clean up state if streaming fails
        Alert.alert("BLE Error", "Could not start data stream. Check connection.");
        return;
      }
    }

    Alert.alert(
      "Detection Started",
      `Starting ${testType.replace("sensor", " Sensor ")} test for ${TEST_DURATION_SECONDS} seconds.`
    );
  };

  const handleStopDetection = async () => {
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
    let completedTest = false;
    let savedUri = null;

    if (currentTestType === "voice") {
      savedUri = await stopRecording();
      if (savedUri) {
        setVoiceAudioUri(savedUri);
        setVoiceTestCompleted(true);
        completedTest = true;
      } else {
        Alert.alert("Audio Error", "Failed to save audio recording.");
        setVoiceTestCompleted(false);
      }
    } else if (currentTestType === "sensorConcentrated") {
      // Sensor Test: Stop BLE Streaming and check collected data
      await stopStreamingData(); // <<< Actual BLE streaming stops here
      await new Promise(resolve => setTimeout(resolve, 100));
      if (concentratedSensorData.length > 0) {
        setConcentratedSensorTestCompleted(true);
        completedTest = true;
        console.log(`Collected ${concentratedSensorData.length} 'concentrated' sensor data points.`);
      } else {
        Alert.alert("Data Error", "No sensor data collected for concentrated test.");
      }
    } else if (currentTestType === "sensorDistracted") {
      // Sensor Test: Stop BLE Streaming and check collected data
      await stopStreamingData(); // <<< Actual BLE streaming stops here
      await new Promise(resolve => setTimeout(resolve, 100));
      if (distractedSensorData.length > 0) {
        setDistractedSensorTestCompleted(true);
        completedTest = true;
        console.log(`Collected ${distractedSensorData.length} 'distracted' sensor data points.`);
      } else {
        Alert.alert("Data Error", "No sensor data collected for distracted test.");
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

  // --- REMOVED FAKE LOGIC: `calculateMFCC`, `createNpzFile`, `processAudioAndGenerateNpz` ---

  // --- MODIFIED: handlePredict - Removed fake logic, now just sends data ---
  const handlePredict = async () => {
    if (
      !voiceTestCompleted ||
      !concentratedSensorTestCompleted ||
      !distractedSensorTestCompleted ||
      !nonMotorTestCompleted
    ) {
      Alert.alert("Tests Incomplete", "Please complete all four tests.");
      return;
    }
    if (
      concentratedSensorData.length === 0 ||
      distractedSensorData.length === 0 ||
      !voiceAudioUri ||
      Object.keys(nonMotorScores).length === 0
    ) {
      Alert.alert(
        "Missing Data",
        "Data for one or more tests is missing. Please run all tests again."
      );
      return;
    }

    setIsPredicting(true);
    setPredictionResult(null);
    console.log("Starting prediction... preparing data for upload.");

    try {
      const formData = new FormData();
      formData.append("sensorFocused", JSON.stringify({ data: concentratedSensorData }));
      formData.append("sensorRelaxed", JSON.stringify({ data: distractedSensorData }));

      formData.append("questionnaireData", JSON.stringify(nonMotorScores));
      formData.append("voice_wav", {
        uri: voiceAudioUri,
        name: "voice_test.wav",
        type: "audio/wave",
      });

      const token = await SecureStore.getItemAsync("jwt");
      if (!token) throw new Error("Authentication token not found.");

      console.log("Uploading data to prediction endpoint...");

      // --- Prediction Endpoint Configuration ---
      const PREDICTION_ENDPOINT =
        "http://192.168.0.118:5000/infer";

      // --- ACTUAL SERVER REQUEST (UNCOMMENTED) ---
      const response = await fetch(PREDICTION_ENDPOINT, {
        method: 'POST',
        // headers: { 
        //   'Authorization': `Bearer ${token}`,
        //   // Note: Do NOT manually set Content-Type: 'multipart/form-data'. 
        //   // fetch handles this automatically with FormData for file uploads.
        // },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Prediction failed: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      
      // --- REMOVED: FAKE PREDICTION FOR DEMO (This block is deleted) ---

      console.log("Actual prediction result:", result);
      setPredictionResult(result); // <-- Store the full result object

      // Show the modal
      setIsResultModalVisible(true);
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
    nonMotorTestCompleted &&
    !isPredicting;

  // --- Modal Functions (unchanged) ---
  const openNonMotorModal = () => {
    /* ... */
    setNonMotorScores({});
    setPredictionResult(null);
    setIsModalVisible(true);
  };
  const handleSubmitNonMotorTest = () => {
    /* ... */
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

  // --- renderRatingRow (horizontal scroller, unchanged) ---
  const renderRatingRow = (questionKey) => {
    /* ... (unchanged) ... */
    const currentRating = nonMotorScores[questionKey];
    const buttons = [];
    for (let i = 0; i <= 10; i++) {
      const isSelected = currentRating === i;
      buttons.push(
        <TouchableOpacity
          key={i}
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
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        className="mt-3 -mx-4"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {buttons}
      </ScrollView>
    );
  };

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

          {/* --- REMOVED: Old inline prediction result view --- */}
        </View>
      </ScrollView>

      {/* --- Non-Motor Symptom Modal (Unchanged) --- */}
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
              Please rate the severity of each symptom over the last week from 0
              (Not present) to 10 (Very severe).
            </Text>
            {NON_MOTOR_QUESTIONS.map((q) => (
              <View key={q.key} className="bg-gray-800 rounded-lg p-4 mb-4">
                <Text className="text-white text-lg font-bold">
                  {q.symptom}
                </Text>
                <Text className="text-gray-400 text-sm mb-3">{q.category}</Text>
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

      {/* --- NEW: Prediction Result Modal --- */}
      <Modal
        visible={isResultModalVisible}
        animationType="slide"
        transparent={true} // Set to true for a "slide up card" effect
        onRequestClose={() => setIsResultModalVisible(false)}
      >
        {/* Semi-transparent background */}
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          {/* Touchable overlay to close modal */}
          <TouchableOpacity
            className="absolute top-0 left-0 right-0 bottom-0"
            activeOpacity={1}
            onPress={() => setIsResultModalVisible(false)}
          />
          {/* Modal Content */}
          <View className="bg-gray-800 p-6 rounded-t-2xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-2xl font-bold">
                Prediction Result
              </Text>
              <TouchableOpacity onPress={() => setIsResultModalVisible(false)}>
                <FontAwesome5 name="times-circle" size={30} color="gray" />
              </TouchableOpacity>
            </View>

            {/* Main Probability */}
            <View className="items-center my-4">
              <Text className="text-gray-400 text-base uppercase tracking-wider">
                Overall Probability
              </Text>
              <Text className="text-cyan-400 text-6xl font-bold mt-1">
                {/* Format probability as percentage */}
                {predictionResult
                  ? (predictionResult.probability * 100).toFixed(1)
                  : 0}
                %
              </Text>
              <Text className="text-cyan-400 text-lg">
                {predictionResult?.probability > 0.6
                  ? "Parkinson's Likely"
                  : "Parkinson's Unlikely"}
              </Text>
            </View>

            {/* Sub-scores */}
            <View className="mt-4">
              <Text className="text-white font-bold text-lg mb-2">
                Score Breakdown:
              </Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-300 text-base">
                  Tremor Score (Concentrated)
                </Text>
                <Text className="text-white text-base font-bold">
                  {(predictionResult?.tremor_sessions[0] * 100).toFixed(1)}%
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-300 text-base">
                  Tremor Score (Distracted)
                </Text>
                <Text className="text-white text-base font-bold">
                  {(predictionResult?.tremor_sessions[1] * 100).toFixed(1)}%
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-300 text-base">Voice Score</Text>
                <Text className="text-white text-base font-bold">
                  {(predictionResult?.p_voice * 100).toFixed(1)}%
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-300 text-base">
                  Symptom Survey Score
                </Text>
                <Text className="text-white text-base font-bold">
                  {(predictionResult?.p_questionnaire * 100).toFixed(1)}%
                </Text>
              </View>
            </View>

            {/* OK Button */}
            <TouchableOpacity
              className="p-4 bg-green-500 rounded-full mt-8 mb-4"
              onPress={() => setIsResultModalVisible(false)}
            >
              <Text className="text-black text-lg font-bold text-center">
                Okay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
