import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Helper to decode JWT and extract payload
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

export default function Medication() {
  const [prescriptions, setPrescriptions] = useState([]);

  // Fetch prescriptions from API on component mount
  useEffect(() => {
    async function fetchPrescriptions() {
      try {
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) throw new Error("User not authenticated");
        const payload = parseJwt(token);
        if (!payload || !payload.sub) throw new Error("Invalid token");
        const patientId = payload.sub;

        const response = await fetch(
          `https://35.224.59.87:8443/prescription/patient/${patientId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch prescriptions");
        }

        const data = await response.json();
        setPrescriptions(data);
      } catch (error) {
        Alert.alert("Error", error.message);
      }
    }
    fetchPrescriptions();
  }, []);

  // Toggle 'taken' state per medication (example UI behavior)
  const handleToggleTaken = (prescriptionId, medIndex) => {
    setPrescriptions((prevPrescriptions) =>
      prevPrescriptions.map((prescription) => {
        if (prescription.id === prescriptionId) {
          const updatedMedicines = prescription.medicines.map((med, index) => {
            if (index === medIndex) {
              return { ...med, taken: !med.taken };
            }
            return med;
          });
          return { ...prescription, medicines: updatedMedicines };
        }
        return prescription;
      })
    );
  };

  const handleScheduleNotification = () => {
    // Placeholder for notifications
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

        {/* Prescription List */}
        {prescriptions.length === 0 ? (
          <Text className="text-gray-400">No prescriptions found.</Text>
        ) : (
          prescriptions.map((prescription) => (
            <View
              key={prescription.id}
              className="mb-8 border-b border-gray-700 pb-4"
            >
              <Text className="text-white text-lg font-semibold mb-1">
                Prescribed at:{" "}
                {new Date(prescription.prescribedAt).toLocaleString()}
              </Text>
              <Text className="text-gray-300 mb-3">
                Doctor: {prescription.doctor.name} (
                {prescription.doctor.specialization})
              </Text>

              {prescription.medicines.map((med, idx) => (
                <View
                  key={`${prescription.id}-${idx}`}
                  className="bg-gray-800 p-4 rounded-lg flex-row items-center justify-between mb-4"
                >
                  <View className="flex-1">
                    <Text className="text-white text-lg font-bold">
                      {med.name}
                    </Text>
                    <Text className="text-gray-400 mt-1">
                      {med.quantity} {med.unit}, {med.frequency}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-1">
                      {med.instructions}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleToggleTaken(prescription.id, idx)}
                  >
                    <FontAwesome5
                      name="check-circle"
                      size={30}
                      color={med.taken ? "#0FFF73" : "gray"}
                      solid
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))
        )}

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
