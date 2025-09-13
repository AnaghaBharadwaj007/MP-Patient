import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile() {
  const router = useRouter();
  const [userName, setUserName] = useState("Jane Smith");
  const [userRole, setUserRole] = useState("Patient");
  const [email, setEmail] = useState("jane.smith@example.com");

  const handleUpdate = () => {
    // Placeholder function to handle profile update logic
    Alert.alert("Profile Updated", "Your information has been saved.");
    console.log("Profile update requested.");
  };

  const handleChangePassword = () => {
    // Placeholder function for password change
    Alert.alert(
      "Password Change",
      "You will be redirected to the password change screen."
    );
    console.log("Change password requested.");
  };

  const handleLogout = () => {
    // Placeholder function for logout logic
    Alert.alert("Logged Out", "You have successfully logged out.");
    console.log("Logout requested.");
  };

  const back = () => {
    router.push("/(tabs)/Dashboard");
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 p-5 pb-24">
        {/* Header with Back Button */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={back}>
            <Ionicons
              name="arrow-back-circle-outline"
              size={32}
              color="white"
            />
          </TouchableOpacity>
          <View className="flex-1 ml-4">
            <Text className="text-white text-3xl font-bold">User Profile</Text>
            <Text className="text-gray-400 mt-1">
              View and manage your personal information.
            </Text>
          </View>
        </View>

        {/* Profile Card */}
        <View className="bg-gray-800 p-6 rounded-lg mb-6 items-center">
          <View className="p-4 bg-gray-600 rounded-full mb-4">
            <FontAwesome5 name="user-circle" size={60} color="white" />
          </View>
          <Text className="text-white text-2xl font-bold">{userName}</Text>
          <Text className="text-green-500 text-sm mt-1">{userRole}</Text>
        </View>

        {/* Update Information Form */}
        <View className="bg-gray-800 p-5 rounded-lg mb-6">
          <Text className="text-white text-lg font-bold mb-4">
            Update Information
          </Text>
          <Text className="text-gray-400 mb-2">Full Name</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-md p-3 mb-4"
            value={userName}
            onChangeText={setUserName}
          />
          <Text className="text-gray-400 mb-2">Email Address</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-md p-3 mb-4"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <TouchableOpacity
            className="p-4 bg-green-500 rounded-full"
            onPress={handleUpdate}
          >
            <Text className="text-black text-lg font-bold text-center">
              Update Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Password and Logout Section */}
        <View className="bg-gray-800 p-5 rounded-lg">
          <Text className="text-white text-lg font-bold mb-4">
            Security & Account
          </Text>
          <TouchableOpacity
            className="p-4 bg-gray-700 rounded-lg mb-4"
            onPress={handleChangePassword}
          >
            <Text className="text-white text-center font-bold">
              Change Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="p-4 bg-red-500 rounded-full"
            onPress={handleLogout}
          >
            <Text className="text-white text-lg font-bold text-center">
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
