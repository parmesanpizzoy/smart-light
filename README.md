Connecting ESP32 to Web Dashboard via MQTT over WebSocketsThis section provides a practical guide on how to establish a real-time, bi-directional communication pipeline between the ESP32 hardware node and the web-based frontend dashboard using the MQTT protocol.📡 Architecture OverviewSince standard web browsers cannot handle raw MQTT (TCP) communication directly, this system utilizes MQTT over WebSockets. A public MQTT broker acts as an intermediary bridge that translates data packages between the hardware and the application layer.[ ESP32 (Hardware Node) ] ---(Native MQTT / Port 1883)---> [ MQTT Broker ][ Web Dashboard (JS) ] <---(MQTT WebSockets / Port 8000)--- [ MQTT Broker ]Communication Channels (Topics)To ensure independent control and prevent network conflicts, specific communication channels (topics) are assigned for each device:smartlight/device_01/power : Web publishes switch commands (1 for ON, 0 for OFF) $\rightarrow$ ESP32 subscribes.smartlight/device_01/brightness : Web publishes PWM ranges (1 to 100) $\rightarrow$ ESP32 subscribes.smartlight/device_01/temp : ESP32 publishes live ambient temperature $\rightarrow$ Web dashboard subscribes.🛠️ Prerequisites & Setup1. Hardware Environment (ESP32)Open Arduino IDE.Go to Tools > Manage Libraries...Search for PubSubClient (by Nick O'Leary) and click Install.Upload the following firmware to your ESP32 board. Make sure to change the Wi-Fi credentials to match your local network setup.C++#include <WiFi.h>
#include <PubSubClient>

// Network Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker Configurations (HiveMQ Public Broker)
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883; 

WiFiClient espClient;
PubSubClient client(espClient);

const int RELAY_PIN = 2; // Built-in LED / Relay GPIO Pin
unsigned long lastSensorMillis = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); 

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback); 
}

void setup_wifi() {
  delay(10);
  Serial.println("\nConnecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected!");
}

// Real-Time Callback Listener for Incoming Web Dashboard Commands
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.printf("Command received on topic [%s]: %s\n", topic, message.c_str());

  if (String(topic) == "smartlight/device_01/power") {
    if (message == "1") {
      digitalWrite(RELAY_PIN, HIGH); // Actuate Relay ON
      Serial.println("Living Room Light state adjusted to: ON");
    } else if (message == "0") {
      digitalWrite(RELAY_PIN, LOW);  // Actuate Relay OFF
      Serial.println("Living Room Light state adjusted to: OFF");
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-Device01-" + String(random(0, 9999));
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Connected to Broker!");
      // Re-subscribe to control channels upon successful reconnection
      client.subscribe("smartlight/device_01/power");
      client.subscribe("smartlight/device_01/brightness");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" trying again in 5 seconds");
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); 

  // Publish telemetry data every 5 seconds
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorMillis >= 5000) {
    lastSensorMillis = currentMillis;
    
    float currentTemp = 24.5; // Placeholder value for DHT22/LDR integration
    String tempPayload = String(currentTemp);
    
    Serial.printf("Publishing temperature telemetry: %s°C\n", tempPayload.c_str());
    client.publish("smartlight/device_01/temp", tempPayload.c_str());
  }
}
2. Software Environment (Web Dashboard Frontend)Ensure that the frontend client imports the official Paho MQTT WebSockets library inside the <head> tag of your index.html file before invoking your custom scripts:HTML<script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js" type="text/javascript"></script>
<script src="script.js"></script>
🚀 Execution & Verification StepsDeploy Device: Power up your ESP32 hardware module and open the Serial Monitor (Baudrate: 115200). Verify that the connection initializes and prints Connected to Broker!.Launch Application: Open your localized index.html file inside any internet-enabled browser. Open the developer tools console (F12 $\rightarrow$ Console) to view the status log: Dashboard sukses terhubung ke MQTT Broker!.Control Evaluation (Web to Hardware): Toggle the Power Control switch on the Living Room interface. The physical onboard LED/Relay on the ESP32 should actuate with sub-second latency, accompanied by real-time time-stamp logging under the "Last sync" display card.Telemetry Evaluation (Hardware to Web): The ESP32 will continuously update the broker with periodic sensor data payloads every 5 seconds. The temperature readings and trend lines inside the active application interface will display progressive state increments dynamically without demanding manually forced page reloads.
