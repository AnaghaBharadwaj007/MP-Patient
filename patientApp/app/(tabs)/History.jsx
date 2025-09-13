import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

const tremorData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      data: [6.2, 5.8, 6.5, 6.1, 5.9, 6.3, 6.0],
    },
  ],
};

const severityData = {
  labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
  datasets: [
    {
      data: [3, 4, 2, 5, 3],
    },
  ],
};

const symptomLog = [
  {
    date: "Sep 13, 2025",
    time: "10:30 AM",
    symptom: "Mild tremor in right hand.",
    notes: "Symptoms increased after walking for 15 minutes.",
  },
  {
    date: "Sep 12, 2025",
    time: "8:00 AM",
    symptom: "No symptoms reported.",
    notes: "Feeling good after morning medication.",
  },
  {
    date: "Sep 11, 2025",
    time: "6:00 PM",
    symptom: "Difficulty with gait.",
    notes: "Felt a bit off balance, especially when turning corners.",
  },
  {
    date: "Sep 10, 2025",
    time: "1:30 PM",
    symptom: "Voice tremor detected.",
    notes: "Noticed a slight shake in voice during a phone call.",
  },
];

const screenWidth = Dimensions.get("window").width;

export default function History() {
  const [activeTab, setActiveTab] = useState("tremor");

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 p-5 pb-24">
        <View className="mb-6">
          <Text className="text-white text-3xl font-bold">
            Symptoms History
          </Text>
          <Text className="text-gray-400 mt-1">
            View your progress over time.
          </Text>
        </View>

        <View className="flex-row items-center justify-between bg-gray-800 rounded-full p-1 mb-6">
          <TouchableOpacity
            className={`flex-1 items-center py-2 rounded-full opacity-100 ${
              activeTab === "tremor" ? "bg-green-500" : ""
            }`}
            onPress={() => setActiveTab("tremor")}
            activeOpacity={0.7}
          >
            <Text
              className={`font-bold ${
                activeTab === "tremor" ? "text-black" : "text-white"
              }`}
            >
              Tremor
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 items-center py-2 rounded-full opacity-100 ${
              activeTab === "severity" ? "bg-green-500" : ""
            }`}
            onPress={() => setActiveTab("severity")}
            activeOpacity={0.7}
          >
            <Text
              className={`font-bold ${
                activeTab === "severity" ? "text-black" : "text-white"
              }`}
            >
              Severity
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mb-8 p-4 bg-gray-800 rounded-lg">
          {activeTab === "tremor" ? (
            <View>
              <Text className="text-white font-bold text-lg mb-4">
                Tremor Frequency Over Time (Hz)
              </Text>
              <LineChart
                data={tremorData}
                width={screenWidth - 60}
                height={220}
                chartConfig={{
                  backgroundGradientFrom: "#1f2937",
                  backgroundGradientTo: "#1f2937",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    `rgba(255, 255, 255, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={{ borderRadius: 16 }}
              />
            </View>
          ) : (
            <View>
              <Text className="text-white font-bold text-lg mb-4">
                Symptom Severity Score
              </Text>
              <BarChart
                data={severityData}
                width={screenWidth - 60}
                height={220}
                yAxisLabel=""
                chartConfig={{
                  backgroundGradientFrom: "#1f2937",
                  backgroundGradientTo: "#1f2937",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    `rgba(255, 255, 255, ${opacity})`,
                }}
                style={{ borderRadius: 16 }}
              />
            </View>
          )}
        </View>

        <View>
          <Text className="text-white text-2xl font-bold mb-4">
            Recent Activity
          </Text>
          {symptomLog.map((item, index) => (
            <View key={index} className="bg-gray-800 p-4 rounded-lg mb-3">
              <View className="flex-row items-center mb-1">
                <Ionicons name="calendar-outline" size={16} color="gray" />
                <Text className="text-gray-400 ml-2">
                  {item.date} at {item.time}
                </Text>
              </View>
              <Text className="text-white font-bold text-lg">
                {item.symptom}
              </Text>
              <Text className="text-gray-400 mt-1 text-sm">{item.notes}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
