import { ChatInterface } from "./components/ChatInterface";

// Theme selection lives on <html data-theme>, written by useAppearance inside
// ChatInterface. Nothing needs a wrapper element here.
export default function App() {
  return <ChatInterface />;
}
