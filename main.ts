//% color=#126180 icon="\uf0fb" block="Tello Drone Control"
//% groups="['ESP8266', 'Tello']"
namespace TelloControl {
    // Initialize the connection variables
    let telloIP = "192.168.10.1";
    let commandPort = 8889;

    // Function to initialize ESP8266 and redirect serial communication
    //% block="initialize ESP8266 with TX %tx| RX %rx"
    //% tx.defl=SerialPin.P8
    //% rx.defl=SerialPin.P12
    export function initESP8266(tx: SerialPin, rx: SerialPin): void {
        serial.redirect(tx, rx, BaudRate.BaudRate115200); // Redirect TX and RX
        basic.pause(100);
        serial.setTxBufferSize(128);
        serial.setRxBufferSize(128);
        restEsp8266(); // Reset and set up ESP8266 in STA mode
    }

    function restEsp8266() {
        sendAT("AT+RESTORE", 1000); // Restore to factory settings
        sendAT("AT+RST", 1000); // Reset the ESP8266
        sendAT("AT+CWMODE=1", 500); // Set ESP8266 to Station Mode (STA mode)
    }

    // Your existing functions like connectToTelloWiFi and sendCommandToTello follow here...

    function sendAT(command: string, wait: number = 0) {
        serial.writeString('${command}\u000D\u000A');
        basic.pause(wait);
    }

    //% block="connect to Tello WiFi"
    //% group="Tello"
    export function connectToTelloWiFi(): void {
        sendAT('AT+CWJAP="TELLO-D35165",""');
        basic.pause(3000); // Give it time to connect
    }

    function sendCommandToTello(command: string): void {
        // Assuming you're already connected to Tello WiFi
        sendAT('AT+CIPSTART="UDP","telloIP",commandPort', 500); // Set up UDP connection
        basic.pause(500); // Give some time for connection setup

        // Send command length and command
        sendAT('AT+CIPSEND=${command.length}', 100);
        serial.writeString(command + "\r\n"); // Send the actual command
        basic.pause(100);
    }

    //% block="initialize Tello into SDK mode"
    //% group="Tello"
    export function initialize(): void {
        sendCommandToTello("command");
    }


    //% block="land"
    //% group="Tello"
    export function land(): void {
        sendCommandToTello("land");
    }

    //% block="takeoff"
    //% group="Tello"
    export function takeOff(): void {
        sendCommandToTello("takeoff");
    }

}
