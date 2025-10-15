import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [age, setAge] = useState("");
  const [dob, setDob] = useState(new Date());
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("Male");

  const handleDobChange = (event, selectedDate) => {
    setShowDobPicker(Platform.OS === "ios");
    if (selectedDate) {
      setDob(selectedDate);
    }
  };

  const handleSignUp = async () => {
    try {
      const token = await SecureStore.getItemAsync("jwt");
      if (!token) throw new Error("User not authenticated");

      const payload = parseJwt(token);
      if (!payload || !payload.sub) throw new Error("Invalid token data");

      const patientId = payload.sub;
      const formattedDob = dob.toISOString().split("T")[0]; // "YYYY-MM-DD"

      // 1. First-time password set API
      const firstPassRes = await fetch(
        `http://YOUR_BACKEND_URL/patient/${patientId}/first-time-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            newPassword: password,
          }),
        }
      );
      if (!firstPassRes.ok) {
        throw new Error("Failed to set password");
      }

      // 2. Update patient profile API
      const updateRes = await fetch(
        `https://35.224.59.87:8443/patient/${patientId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            phone: phoneNumber,
            dateOfBirth: formattedDob,
            gender,
            // age,
            // email,
          }),
        }
      );
      if (!updateRes.ok) {
        throw new Error("Failed to update profile");
      }

      // On success navigate to dashboard
      router.push("/(tabs)/Dashboard");
    } catch (error) {
      Alert.alert("Signup Failed", error.message);
    }
  };

  const handleGoogleSignUp = () => {
    console.log("Google Sign Up button pressed.");
  };

  const goToSignin = () => {
    router.push("/Signin");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#101013]">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 p-6 justify-between">
          <View>
            <Text className="text-4xl font-extrabold text-white mt-12 mb-4">
              Join Our Community
            </Text>
            <Text className="text-lg text-gray-400 mb-8">
              Create an account to begin your journey.
            </Text>
            <TextInput
              className="w-full px-4 py-3 bg-[#181B1F] rounded-lg text-white mb-4"
              placeholder="Full Name"
              placeholderTextColor="#656ca9"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              className="w-full px-4 py-3 bg-[#181B1F] rounded-lg text-white mb-4"
              placeholder="Phone Number"
              placeholderTextColor="#656ca9"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
            <TextInput
              className="w-full px-4 py-3 bg-[#181B1F] rounded-lg text-white mb-4"
              placeholder="Age"
              placeholderTextColor="#656ca9"
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
            <TouchableOpacity
              onPress={() => setShowDobPicker(true)}
              className="w-full px-4 py-4 bg-[#181B1F] rounded-lg mb-4"
            >
              <Text className="text-white">{`DOB: ${dob.toDateString()}`}</Text>
            </TouchableOpacity>
            {showDobPicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={handleDobChange}
              />
            )}
            <View className="flex-row justify-between mb-4">
              {["Male", "Female", "Other"].map((option) => (
                <TouchableOpacity
                  key={option}
                  className={`flex-1 px-4 py-3 rounded-lg border ${
                    gender === option
                      ? "border-green-500 bg-green-600"
                      : "border-gray-700"
                  } mx-1`}
                  onPress={() => setGender(option)}
                  activeOpacity={1}
                >
                  <Text className={`text-center font-bold text-white`}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              className="w-full px-4 py-3 bg-[#181B1F] rounded-lg text-white mb-4"
              placeholder="Email"
              placeholderTextColor="#656ca9"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="w-full px-4 py-3 bg-[#181B1F] rounded-lg text-white mb-4"
              placeholder="Password"
              placeholderTextColor="#656ca9"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              className="w-full px-4 py-4 bg-green-500 rounded-full mt-8 shadow-lg shadow-green-400"
              onPress={handleSignUp}
            >
              <Text className="text-center text-[#101013] text-lg font-bold">
                Sign Up
              </Text>
            </TouchableOpacity>
            <View className="flex-row items-center my-8">
              <View className="flex-1 h-[1px] bg-gray-600" />
              <Text className="text-gray-400 px-4">OR</Text>
              <View className="flex-1 h-[1px] bg-gray-600" />
            </View>
            <TouchableOpacity
              className="flex-row items-center justify-center p-3 rounded-full border border-gray-600"
              onPress={handleGoogleSignUp}
            >
              <Ionicons name="logo-google" size={24} color="#fff" />
              <Text className="text-white ml-2">Continue with Google</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row justify-center mb-8">
            <Text className="text-gray-400">Already have an account? </Text>
            <TouchableOpacity onPress={goToSignin}>
              <Text className="text-green-400 font-semibold">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
