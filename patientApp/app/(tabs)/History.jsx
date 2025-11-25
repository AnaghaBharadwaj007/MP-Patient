import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

// --- CONSTANTS ---
const API_BASE = "https://heimdall-server.servehttp.com:8443";
const screenWidth = Dimensions.get("window").width;

// --- HELPER: JWT Decoder ---
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
  } catch {
    return null;
  }
}

export default function History() {
  const router = useRouter();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState({}); // Track expanded states
  const [showVisualization, setShowVisualization] = useState(false); // Toggle Graph Modal
  const [patientId, setPatientId] = useState(null); // Store ID for display if needed

  // --- FETCH HISTORY (Extract ID from JWT) ---
  const fetchHistoryData = useCallback(async () => {
    try {
      // 1. Get Token
      const token = await SecureStore.getItemAsync("jwt");
      if (!token) {
        Alert.alert("Auth Error", "Session expired. Please log in again.");
        return;
      }

      // 2. Extract Patient ID
      const payload = parseJwt(token);
      if (!payload || !payload.sub) {
        throw new Error("Invalid token structure.");
      }
      const extractedId = payload.sub;
      setPatientId(extractedId);

      console.log(`Fetching history for Patient ID: ${extractedId}...`);

      // 3. Fetch Data
      const response = await fetch(
        `${API_BASE}/prediction/${extractedId}/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`);
      }

      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("History Fetch Error:", error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  // --- TOGGLE EXPAND ---
  const toggleExpand = (itemId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // --- CHART DATA PREPARATION ---
  const getChartData = () => {
    // API returns most recent first, reverse for chart (Time -> Right)
    const reversedHistory = [...history].reverse();
    // Slice to last 10 for readability
    const dataSlice = reversedHistory.slice(-10);

    return {
      labels: dataSlice.map((item) => {
        const date = new Date(item.createdAt);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }),
      datasets: [
        {
          data: dataSlice.map((item) => item.probability || 0),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green
          strokeWidth: 2,
        },
        {
          data: dataSlice.map((item) => item.ptremor || 0),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red
          strokeWidth: 2,
        },
        {
          data: dataSlice.map((item) => item.pvoice || 0),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          strokeWidth: 2,
        },
      ],
      legend: ["Prob.", "Tremor", "Voice"],
    };
  };

  // --- RENDER HELPERS ---
  const renderDetailRow = (label, value, colorClass = "text-white") => (
    <View className="flex-row justify-between mb-2">
      <Text className="text-gray-400">{label}</Text>
      <Text className={`font-bold ${colorClass}`}>
        {typeof value === "number" ? value.toFixed(3) : value}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 p-5 pb-24">
        {/* HEADER */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons
                name="arrow-back-circle-outline"
                size={32}
                color="white"
              />
            </TouchableOpacity>
            <View className="ml-4">
              <Text className="text-white text-3xl font-bold">My History</Text>
              <Text className="text-gray-400 text-xs">Track your progress</Text>
            </View>
          </View>

          {/* Visual Toggle Button */}
          <TouchableOpacity
            onPress={() => setShowVisualization(true)}
            className="bg-gray-800 p-2 rounded-full border border-gray-700"
          >
            <Ionicons name="stats-chart" size={24} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* LIST CONTENT */}
        {loading ? (
          <ActivityIndicator size="large" color="#10B981" className="mt-10" />
        ) : history.length === 0 ? (
          <View className="items-center mt-10">
            <Ionicons name="document-text-outline" size={48} color="gray" />
            <Text className="text-gray-500 mt-2">
              No symptom logs found yet.
            </Text>
          </View>
        ) : (
          history.map((item, index) => {
            const isExpanded = !!expandedItems[item.id];
            const dateObj = new Date(item.createdAt);
            const isHighRisk = item.probability > 0.5;

            return (
              <View
                key={index}
                className="mb-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
              >
                {/* Header Row (Always Visible) */}
                <TouchableOpacity
                  onPress={() => toggleExpand(item.id)}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between p-4 bg-gray-800"
                >
                  <View className="flex-row items-center">
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isHighRisk ? "bg-red-900/30" : "bg-green-900/30"}`}
                    >
                      <Ionicons
                        name={isHighRisk ? "alert-circle" : "checkmark-circle"}
                        size={20}
                        color={isHighRisk ? "#f87171" : "#4ade80"}
                      />
                    </View>
                    <View>
                      <Text className="text-white font-bold text-lg">
                        {dateObj.toLocaleDateString()}
                      </Text>
                      <Text className="text-gray-400 text-xs">
                        {dateObj.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center">
                    <View className="mr-3 items-end">
                      <Text className="text-gray-400 text-xs">Risk Score</Text>
                      <Text
                        className={`font-bold ${isHighRisk ? "text-red-400" : "text-green-400"}`}
                      >
                        {(item.probability * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="gray"
                    />
                  </View>
                </TouchableOpacity>

                {/* Details Slide Down */}
                {isExpanded && (
                  <View className="p-4 bg-black/20 border-t border-gray-800">
                    <Text className="text-green-500 font-bold mb-3 uppercase text-xs tracking-widest">
                      Analysis Details
                    </Text>

                    {renderDetailRow(
                      "Overall Probability",
                      item.probability,
                      isHighRisk ? "text-red-400" : "text-green-400"
                    )}
                    {renderDetailRow("Tremor Risk", item.ptremor)}
                    {renderDetailRow("Voice Risk", item.pvoice)}
                    {renderDetailRow("Self-Report Score", item.pquestionnaire)}

                    <View className="mt-2 pt-2 border-t border-gray-800">
                      <Text className="text-gray-500 text-xs mb-2 uppercase">
                        Sensor Readings (Hz)
                      </Text>
                      {renderDetailRow(
                        "Tremor (Action)",
                        item.tremorSessionsFocused,
                        "text-gray-300"
                      )}
                      {renderDetailRow(
                        "Tremor (Rest)",
                        item.tremorSessionsRelaxed,
                        "text-gray-300"
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* VISUALIZATION MODAL */}
      <Modal
        visible={showVisualization}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVisualization(false)}
      >
        <View className="flex-1 bg-black/95 justify-center p-4">
          <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800 w-full">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">
                Your Progress
              </Text>
              <TouchableOpacity onPress={() => setShowVisualization(false)}>
                <Ionicons name="close-circle" size={30} color="gray" />
              </TouchableOpacity>
            </View>

            {history.length > 1 ? (
              <View className="items-center">
                <LineChart
                  data={getChartData()}
                  width={screenWidth - 60}
                  height={250}
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: "#111827",
                    backgroundGradientFrom: "#111827",
                    backgroundGradientTo: "#111827",
                    decimalPlaces: 2,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) =>
                      `rgba(156, 163, 175, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: "#10B981",
                    },
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                />
                <Text className="text-gray-500 text-xs mt-2 text-center">
                  Tracking symptom probability over time
                </Text>
              </View>
            ) : (
              <View className="h-40 justify-center items-center">
                <Text className="text-gray-500 text-center">
                  Not enough data points to show a trend graph yet.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
