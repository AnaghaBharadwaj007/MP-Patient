import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const gotoSignup = () => {
    router.push("/Signup");
  };

  const handleSignIn = async () => {
    try {
      const response = await fetch(
        "https://heimdall-server.servehttp.com:8443/patient/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await response.json();

      // Save JWT securely only if login successful
      if (data.token) {
        await SecureStore.setItemAsync("jwt", data.token);
      }

      // Check firstLogin flag & navigate accordingly
      if (data.firstLogin) {
        router.push("/Signup");
      } else {
        router.push("/(tabs)/Dashboard");
      }
    } catch (error) {
      Alert.alert("Login Failed", "Wrong Credentials: " + error.message);
    }
  };

  const handleGoogleSignIn = () => {
    console.log("Google Sign In button pressed.");
  };

  const handleForgotPassword = () => {
    console.log("Forgot Password link pressed.");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#101013]">
      <View className="flex-1 p-6 justify-between">
        <View>
          <Text className="text-4xl font-extrabold text-white mt-12 mb-4">
            Welcome Back
          </Text>
          <Text className="text-lg text-gray-400 mb-8">
            Please sign in to continue.
          </Text>
          <TextInput
            className="w-full px-4 py-3 bg-[#181B1F] rounded-lg text-white mb-4"
            placeholder="Email"
            placeholderTextColor="#656ca9"
            value={email}
            onChangeText={setEmail}
          />
          <View className="w-full flex-row items-center bg-[#181B1F] rounded-lg mb-2">
            <TextInput
              style={{ flex: 1, color: "white", padding: 12 }}
              placeholder="Password"
              placeholderTextColor="#656ca9"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={24}
                color="#656ca9"
                style={{ marginRight: 12 }}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleForgotPassword}>
            <Text className="text-right text-gray-500 font-semibold text-sm">
              Forgot Password?
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="w-full px-4 py-4 bg-green-500 rounded-full mt-8 shadow-lg shadow-green-400"
            onPress={handleSignIn}
          >
            <Text className="text-center text-[#101013] text-lg font-bold">
              Sign In
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center my-8">
            <View className="flex-1 h-[1px] bg-gray-600" />
            <Text className="text-gray-400 px-4">OR</Text>
            <View className="flex-1 h-[1px] bg-gray-600" />
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center p-3 rounded-full border border-gray-600"
            onPress={handleGoogleSignIn}
          >
            <Ionicons name="logo-google" size={24} color="#fff" />
            <Text className="text-white ml-2">Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mb-8">
          <Text className="text-gray-400">Do not have an account? </Text>
          <TouchableOpacity onPress={gotoSignup}>
            <Text className="text-green-400 font-semibold">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
