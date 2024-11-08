//% color=#126180 icon="\uf0fb" block="Tello Drone Control"
//% groups="['ESP8266', 'Tello']"
namespace TelloControl {
    // Initialize the connection variables
    let telloIP = "192.168.10.1";
    let commandPort = 8889;

    // Command function to send UDP packets to Tello
    function sendCommand(command: string): void {
        serial.writeLine(`Sending command: ${command}`);
        // Send command to ESP8266 via serial, modify this part based on your ESP8266 connection setup
        serial.writeString("AT+CIPSEND=" + command.length + "\r\n");
        basic.pause(100);
        serial.writeString(command + "\r\n");
    }

    // Function to initialize Tello control mode
    //% block="initialize Tello into SDK mode"
    //% group="Tello"
    export function initialize(): void {
        sendCommand("command"); // Puts Tello into SDK mode
        basic.pause(500);
    }



    //% block="land"
    //% group="Tello"
    export function land(): void {
        sendCommand("land");
    }

    //% block="takeoff"
    //% group="Tello"
    export function takeOff(): void {
        sendCommand("takeoff");
    }

}

namespace ESP8266_IoT {
    enum Cmd {
        None,
        ConnectWifi,
        ConnectThingSpeak,
    }


    export enum SchemeList {
        //% block="TCP"
        TCP = 1,
        //% block="TLS"
        TLS = 2
    }

    export enum QosList {
        //% block="0"
        Qos0 = 0,
        //% block="1"
        Qos1,
        //% block="2"
        Qos2
    }

    let wifi_connected: boolean = false
    let thingspeak_connected: boolean = false
    let userToken_def: string = ""
    let topic_def: string = ""
    let thingSpeakDatatemp = ""

    let serialCnt = 0
    let recvString = ""
    let scanWIFIAPFlag = 0
    let currentCmd: Cmd = Cmd.None

    const THINGSPEAK_HOST = "api.thingspeak.com"
    const THINGSPEAK_PORT = "80"
    // export function change(a:any,b:any){
    //     SMARTIOT_HOST = a
    //     SMARTIOT_PORT = b
    // }

    const EspEventSource = 3000
    const EspEventValue = {
        None: Cmd.None,
        ConnectWifi: Cmd.ConnectWifi,
        ConnectThingSpeak: Cmd.ConnectThingSpeak,
    }


    let TStoSendStr = ""

    // write AT command with CR+LF ending
    function sendAT(command: string, wait: number = 0) {
        serial.writeString(`${command}\u000D\u000A`)
        basic.pause(wait)
    }

    function restEsp8266() {
        sendAT("AT+RESTORE", 1000) // restore to factory settings
        sendAT("AT+RST", 1000) // rest
        serial.readString()
        sendAT("AT+CWMODE=1", 500) // set to STA mode
        sendAT("AT+SYSTIMESTAMP=1634953609130", 100) // Set local timestamp.
        sendAT(`AT+CIPSNTPCFG=1,8,"ntp1.aliyun.com","0.pool.ntp.org","time.google.com"`, 100)
        basic.pause(3000)
    }

    function scanWIFIAP(ssid: string) {

        let scanflag = 0
        let mscnt = 0
        recvString = " "
        sendAT(`AT+CWLAPOPT=1,2,-100,255`)
        sendAT(`AT+CWLAP`)
        while (!(scanflag)) {

            recvString = recvString + serial.readString()
            basic.pause(1)
            mscnt += 1
            if (mscnt >= 3000) {
                scanWIFIAPFlag = 0
                break
            }

            if (recvString.includes("+CWLAP:(")) {

                mscnt = 0
                recvString = recvString.slice(recvString.indexOf("+CWLAP:("))
                scanflag = 1
                while (1) {

                    recvString += serial.readString()
                    basic.pause(1)
                    mscnt += 1

                    // OLED.clear()
                    // OLED.writeStringNewLine(_recvString)
                    if (recvString.includes("OK") || mscnt >= 3000) {

                        if (mscnt >= 3000) {
                            scanWIFIAPFlag = 0
                        } else if (recvString.includes(ssid)) {
                            scanWIFIAPFlag = 1
                        } else {
                            scanWIFIAPFlag = 0
                        }
                        break
                    }
                }
            }

        }
        recvString = " "
    }

    /**
     * Initialize ESP8266 module
     */
    //% block="set ESP8266|RX %tx|TX %rx|Baud rate %baudrate"
    //% tx.defl=SerialPin.P8
    //% rx.defl=SerialPin.P12
    //% ssid.defl=your_ssid
    //% pw.defl=your_password weight=100
    export function initWIFI(tx: SerialPin, rx: SerialPin, baudrate: BaudRate) {
        serial.redirect(tx, rx, BaudRate.BaudRate115200)
        basic.pause(100)
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)
        restEsp8266()
    }

    /**
     * connect to Wifi router
     */
    //% block="connect Wifi SSID = %ssid|KEY = %pw"
    //% ssid.defl=your_ssid
    //% pw.defl=your_pwd weight=95
    export function connectWifi(ssid: string, pw: string) {

        while (1) {
            scanWIFIAP(ssid)
            if (scanWIFIAPFlag) {
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`) // connect to Wifi router
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                while (!wifi_connected) {
                    restEsp8266()
                    sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                    control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                }
                break
            } else {
                restEsp8266()
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                if (wifi_connected) {
                    break
                }
            }
        }
    }

    /**
     * Warning: Deprecated.
     * Check if ESP8266 successfully connected to Wifi
     */
    //% block="Wifi connected %State" weight=70
    export function wifiState(state: boolean) {
        return wifi_connected === state
    }

    /**
     * Connect to ThingSpeak
     */
    //% block="connect thingspeak"
    //% write_api_key.defl=your_write_api_key
    //% subcategory="ThingSpeak" weight=90
    export function connectThingSpeak() {
        thingspeak_connected = true
        // connect to server
        // recvString = " "
        // serialCnt = 0
        // sendAT(`AT+CIPSTART="TCP","${THINGSPEAK_HOST}",${THINGSPEAK_PORT}`)
        // currentCmd = Cmd.ConnectThingSpeak
        // basic.pause(1)
        // recvString += serial.readString()
        // if (recvString == " ") {
        //     thingspeak_connected = false
        //     //basic.showIcon(IconNames.Sad)
        // } else {
        //     control.waitForEvent(EspEventSource, EspEventValue.ConnectThingSpeak)

        // } 
    }

    /**
     * Connect to ThingSpeak and set data.
     */
    //% block="set data to send ThingSpeak | Write API key = %write_api_key|Field 1 = %n1||Field 2 = %n2|Field 3 = %n3|Field 4 = %n4|Field 5 = %n5|Field 6 = %n6|Field 7 = %n7|Field 8 = %n8"
    //% write_api_key.defl=your_write_api_key
    //% expandableArgumentMode="enabled"
    //% subcategory="ThingSpeak" weight=85
    export function setData(write_api_key: string, n1: number = 0, n2: number = 0, n3: number = 0, n4: number = 0, n5: number = 0, n6: number = 0, n7: number = 0, n8: number = 0) {
        TStoSendStr = "AT+HTTPCLIENT=2,0,\"http://api.thingspeak.com/update?api_key="
            + write_api_key
            + "&field1="
            + n1
            + "&field2="
            + n2
            + "&field3="
            + n3
            + "&field4="
            + n4
            + "&field5="
            + n5
            + "&field6="
            + n6
            + "&field7="
            + n7
            + "&field8="
            + n8
            + "\",,,1"
    }

    /**
     * upload data. It would not upload anything if it failed to connect to Wifi or ThingSpeak.
     */
    //% block="Upload data to ThingSpeak"
    //% subcategory="ThingSpeak" weight=80
    export function uploadData() {
        let mscnt = 0
        //sendAT(`AT+CIPSEND=${TStoSendStr.length + 2}`, 300)
        sendAT(TStoSendStr, 100) // upload data

        while (1) {

            recvString += serial.readString()
            basic.pause(1)
            mscnt += 1

            // OLED.clear()
            // OLED.writeStringNewLine(_recvString)
            if (recvString.includes("OK") || mscnt >= 3000 || recvString.includes("ERROR")) {

                break
            }
        }

        recvString = " "
        basic.pause(200)
    }

    /*
     * Check if ESP8266 successfully connected to ThingSpeak
     */
    //% block="ThingSpeak connected %State"
    //% subcategory="ThingSpeak" weight=65
    export function thingSpeakState(state: boolean) {
        return thingspeak_connected === state
    }


}