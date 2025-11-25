import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- CONSTANTS ---
const API_BASE = "https://heimdall-server.servehttp.com:8443";

// Helper to decode JWT
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

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- FETCH DATA ---
  useEffect(() => {
    async function fetchActivities() {
      setIsLoading(true);
      try {
        // 1. Get Token
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) throw new Error("User not authenticated");

        // 2. Extract ID
        const payload = parseJwt(token);
        if (!payload || !payload.sub) throw new Error("Invalid token");
        const patientId = payload.sub;

        console.log(`Fetching activities for Patient ID: ${patientId}`);

        // 3. Fetch from API
        const response = await fetch(
          `${API_BASE}/activity/patient/${patientId}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch activities");
        }

        const data = await response.json();

        // 4. Add local 'completed' state to each item
        // We map the API data to include a 'completed: false' property for UI logic
        const initializedData = (Array.isArray(data) ? data : []).map(
          (item) => ({
            ...item,
            completed: false,
          })
        );

        setActivities(initializedData);
      } catch (error) {
        Alert.alert("Error", error.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchActivities();
  }, []);

  // --- TOGGLE COMPLETION ---
  const handleToggleComplete = (activityId) => {
    setActivities((prev) =>
      prev.map((item) => {
        if (item.id === activityId) {
          return { ...item, completed: !item.completed };
        }
        return item;
      })
    );
  };

  // Filter lists for UI (Pending vs Completed)
  const pendingActivities = activities.filter((a) => !a.completed);
  const completedActivities = activities.filter((a) => a.completed);

  // --- RENDER ITEM COMPONENT ---
  const renderActivityItem = (item, isCompleted) => (
    <View
      key={item.id}
      className={`p-4 rounded-lg flex-row items-center justify-between mb-3 border-l-4 ${
        isCompleted
          ? "bg-gray-900 border-gray-600 opacity-60"
          : "bg-gray-800 border-blue-500"
      }`}
    >
      <View className="flex-1 mr-3">
        <Text
          className={`text-lg font-bold ${isCompleted ? "text-gray-500 line-through" : "text-white"}`}
        >
          {item.name}
        </Text>
        <Text className="text-blue-400 font-semibold mt-1">
          {item.quantity} {item.unit}
        </Text>
        {item.instructions ? (
          <Text className="text-gray-500 text-sm mt-1 italic">
            {item.instructions}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={() => handleToggleComplete(item.id)}>
        <FontAwesome5
          name={isCompleted ? "check-circle" : "circle"}
          size={28}
          color={isCompleted ? "#0FFF73" : "#4B5563"} // Green if done, Gray if pending
          solid={isCompleted} // Solid icon when checked
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 p-5 pb-24">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-white text-3xl font-bold">Daily Activity</Text>
          <View className="bg-blue-900/30 p-2 rounded-full">
            <Ionicons name="walk" size={32} color="#60A5FA" />
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#60A5FA" className="mt-10" />
        ) : activities.length === 0 ? (
          <View className="items-center mt-10">
            <Text className="text-gray-500">
              No activities assigned by your doctor.
            </Text>
          </View>
        ) : (
          <View>
            {/* 1. PENDING LIST (Up Top) */}
            {pendingActivities.length > 0 && (
              <View className="mb-6">
                <Text className="text-gray-400 font-bold mb-3 uppercase tracking-wider text-xs">
                  To Do
                </Text>
                {pendingActivities.map((item) =>
                  renderActivityItem(item, false)
                )}
              </View>
            )}

            {/* 2. COMPLETED LIST (Slides Down) */}
            {completedActivities.length > 0 && (
              <View>
                <Text className="text-gray-400 font-bold mb-3 uppercase tracking-wider text-xs mt-4 pt-4 border-t border-gray-800">
                  Completed
                </Text>
                {completedActivities.map((item) =>
                  renderActivityItem(item, true)
                )}
              </View>
            )}

            {/* Congratulatory Message if all done */}
            {pendingActivities.length === 0 &&
              completedActivities.length > 0 && (
                <View className="mt-6 p-4 bg-green-900/20 rounded-lg border border-green-800 items-center">
                  <Ionicons name="trophy" size={30} color="#4ade80" />
                  <Text className="text-green-400 font-bold mt-2 text-center">
                    All activities completed! Good job.
                  </Text>
                </View>
              )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
