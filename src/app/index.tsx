import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ciao EatUp!</Text>
      <Text>Ingredienti scelti: {count}</Text>
      <Pressable style={styles.button} onPress={() => setCount(count + 1)}>
        <Text style={styles.buttonText}>Aggiungi ingrediente</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "bold" },
  button: { backgroundColor: "#2e7d32", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: "white", fontWeight: "600" },
});