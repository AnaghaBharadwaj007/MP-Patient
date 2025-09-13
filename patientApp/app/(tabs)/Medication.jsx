import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Placeholder data for medications
const initialMedications = [
  {
    id: 1,
    name: "Levodopa",
    dosage: "2 tablet",
    time: "8:00 AM",
    taken: false,
    instructions: "Take with a glass of water, 30 minutes before food.",
  },
  {
    id: 2,
    name: "Carbidopa",
    dosage: "2 tablet",
    time: "1:00 PM",
    taken: false,
    instructions: "Can be taken with or without food.",
  },
  {
    id: 3,
    name: "Rasagiline",
    dosage: "0.5 mg",
    time: "8:00 PM",
    taken: false,
    instructions: "Take before bedtime.",
  },
  {
    id: 4,
    name: "Amantadine",
    dosage: "100 mg",
    time: "9:00 AM",
    taken: false,
    instructions: "Take with food.",
  },
  {
    id: 5,
    name: "Entacapone",
    dosage: "200 mg",
    time: "1:00 PM",
    taken: false,
    instructions: "Take with levodopa.",
  },
];

export default function Medication() {
  const [medications, setMedications] = useState(initialMedications);

  const handleToggleTaken = (id) => {
    setMedications(
      medications.map((med) =>
        med.id === id ? { ...med, taken: !med.taken } : med
      )
    );
  };

  const handleScheduleNotification = () => {
    // This is a placeholder function.
    // You would use `expo-notifications` here to schedule a local notification.
    Alert.alert(
      "Notification Scheduled",
      "An alarm has been set for your medication reminders."
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 p-5 pb-24">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-white text-3xl font-bold">
            Medication Schedule
          </Text>
          <TouchableOpacity onPress={() => Alert.alert("Add new medication")}>
            <Ionicons name="add-circle" size={36} color="#0FFF73" />
          </TouchableOpacity>
        </View>

        {/* Medication List */}
        {medications.map((med) => (
          <View
            key={med.id}
            className="bg-gray-800 p-4 rounded-lg flex-row items-center justify-between mb-4"
          >
            <View className="flex-1">
              <Text className="text-white text-lg font-bold">{med.name}</Text>
              <Text className="text-gray-400 mt-1">{med.dosage}</Text>
              <Text className="text-green-500 font-bold mt-2">{med.time}</Text>
              <Text className="text-gray-500 text-sm mt-1">
                {med.instructions}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleToggleTaken(med.id)}>
              <FontAwesome5
                name="check-circle"
                size={30}
                color={med.taken ? "#0FFF73" : "gray"}
                solid
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* Additional information */}
        <View className="bg-gray-800 p-4 rounded-lg mt-6">
          <Text className="text-white font-bold text-lg">Important</Text>
          <Text className="text-gray-400 mt-2">
            Always follow your doctors instructions. Do not change your dosage
            without consulting a healthcare professional.
          </Text>
          <TouchableOpacity
            onPress={handleScheduleNotification}
            className="mt-4 p-3 bg-green-500 rounded-full"
          >
            <Text className="text-center font-bold text-black">
              Set Reminder
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
