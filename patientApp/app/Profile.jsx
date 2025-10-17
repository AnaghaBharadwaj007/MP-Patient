import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  } catch (e) {
    return null;
  }
}

export default function Profile() {
  const router = useRouter();

  // User state
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("Patient");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState(new Date());
  const [gender, setGender] = useState("Male"); // If you want to let them edit gender, add UI

  // Password modal state
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // On mount, fetch user data
  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) throw new Error("User not authenticated");
        const payload = parseJwt(token);
        if (!payload || !payload.sub) throw new Error("Invalid token");
        const id = payload.sub;
        const response = await fetch(
          `https://heimdall-server.servehttp.com:8443/patient/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!response.ok) throw new Error("Failed to fetch patient details");
        const data = await response.json();
        setUserName(data.name);
        setEmail(data.email);
        setPhone(data.phone);
        setDob(data.dateOfBirth ? new Date(data.dateOfBirth) : new Date());
        setGender(data.gender || "Male");
      } catch (err) {
        Alert.alert("Error", err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // Update patient details
  const handleUpdate = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("jwt");
      if (!token) throw new Error("User not authenticated");
      const payload = parseJwt(token);
      if (!payload || !payload.sub) throw new Error("Invalid token");
      const id = payload.sub;
      const formattedDob = dob.toISOString().split("T")[0];
      const response = await fetch(
        `https://heimdall-server.servehttp.com:8443/patient/${id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: userName,
            phone: phone,
            dateOfBirth: formattedDob,
            gender,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to update profile");
      Alert.alert("Profile Updated", "Your information has been saved.");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Change password handling
  const handleChangePassword = () => {
    setOldPassword("");
    setNewPassword("");
    setIsPasswordModalVisible(true);
  };

  const handleSubmitPasswordChange = async () => {
    try {
      if (!oldPassword || !newPassword) {
        Alert.alert("Error", "Please fill both password fields.");
        return;
      }
      setLoading(true);
      const token = await SecureStore.getItemAsync("jwt");
      if (!token) throw new Error("User not authenticated");
      const payload = parseJwt(token);
      if (!payload || !payload.sub) throw new Error("Invalid token");
      const id = payload.sub;

      const response = await fetch(
        `https://heimdall-server.servehttp.com:8443/change-password/${id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            oldPassword,
            newPassword,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to change password");
      }
      Alert.alert("Success", "Password changed successfully.");
      setIsPasswordModalVisible(false);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logged Out", "You have successfully logged out.");
  };

  const back = () => {
    router.push("/(tabs)/Dashboard");
  };

  const handleDobChange = (event, selectedDate) => {
    setShowDobPicker(Platform.OS === "ios");
    if (selectedDate) setDob(selectedDate);
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
            editable={false}
            keyboardType="email-address"
          />
          <Text className="text-gray-400 mb-2">Phone Number</Text>
          <TextInput
            className="bg-gray-700 text-white rounded-md p-3 mb-4"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Text className="text-gray-400 mb-2">Date of Birth</Text>
          <TouchableOpacity
            onPress={() => setShowDobPicker(true)}
            className="bg-gray-700 rounded-md p-3 mb-4"
          >
            <Text className="text-white">{dob.toLocaleDateString()}</Text>
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
          <TouchableOpacity
            className="p-4 bg-green-500 rounded-full"
            onPress={handleUpdate}
            disabled={loading}
          >
            <Text className="text-black text-lg font-bold text-center">
              {loading ? "Saving..." : "Update Profile"}
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

        {/* Change Password Modal */}
        <Modal
          visible={isPasswordModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPasswordModalVisible(false)}
        >
          <View className="flex-1 justify-center bg-black bg-opacity-70 p-6">
            <View className="bg-gray-800 rounded-lg p-6">
              <Text className="text-white text-2xl font-bold mb-4">
                Change Password
              </Text>
              <Text className="text-gray-400 mb-2">Old Password</Text>
              <TextInput
                className="bg-gray-700 text-white rounded-md p-3 mb-4"
                placeholder="Enter old password"
                placeholderTextColor="#a1a1aa"
                secureTextEntry={true}
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <Text className="text-gray-400 mb-2">New Password</Text>
              <TextInput
                className="bg-gray-700 text-white rounded-md p-3 mb-4"
                placeholder="Enter new password"
                placeholderTextColor="#a1a1aa"
                secureTextEntry={true}
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TouchableOpacity
                className="bg-green-500 p-4 rounded-full"
                onPress={handleSubmitPasswordChange}
                disabled={loading}
              >
                <Text className="text-black font-bold text-center text-lg">
                  {loading ? "Updating..." : "Submit"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-3 p-4 rounded-full bg-red-500"
                onPress={() => setIsPasswordModalVisible(false)}
              >
                <Text className="text-white font-bold text-center text-lg">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
