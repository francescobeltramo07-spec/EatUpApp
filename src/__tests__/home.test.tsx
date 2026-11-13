import { fireEvent, render } from "@testing-library/react-native";
import HomeScreen from "../app";

describe("home screen", () => {
  it("renders the welcome content and updates the ingredient count", async () => {
    const { getByText } = await render(<HomeScreen />);

    expect(getByText("Ciao EatUp!")).toBeTruthy();
    await fireEvent.press(getByText("Aggiungi ingrediente"));
    expect(getByText("Ingredienti scelti: 1")).toBeTruthy();
  });
});
